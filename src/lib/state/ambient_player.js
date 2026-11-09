import { motionDuration } from './motion.js';
import { normalize_ambient_buffer } from './ambient_normalization.js';

const master_volume = 0.7;

export const ambient_tracks = Object.freeze([
    { id: 'rain', category: 'ambience', label: 'Rain', src: '/ambience/rain.mp3', volume: 0 },
    { id: 'campfire', category: 'ambience', label: 'Campfire', src: '/ambience/campfire.mp3', volume: 0 },
    { id: 'street_chatter', category: 'ambience', label: 'Street', src: '/ambience/street_chatter.mp3', volume: 0 },
    { id: 'flute', category: 'music', label: 'Flute', src: '/ambience/flute.mp3', cover: '/backgrounds/thumbnails/lantern_in_the_forest.webp.webp', volume: 0 },
    { id: 'fantasy_music', category: 'music', label: 'Reverie', src: '/ambience/fantasy_music.mp3', cover: '/backgrounds/thumbnails/castle.webp.webp', volume: 0 },
    { id: 'sad_music', category: 'music', label: 'Solitude', src: '/ambience/sad_music.mp3', cover: '/backgrounds/thumbnails/winter_street.webp.webp', volume: 0 }
]);

export function create_ambient_player(on_status) {
    let context;
    let master;
    let playing = false;
    let muted = false;
    let destroyed = false;
    let mix = [];
    const channels = new Map();
    const volume_ramps = new WeakMap();

    function ramp_volume(parameter, value, duration = motionDuration('quick', 100)) {
        const now = context.currentTime;
        const previous = volume_ramps.get(parameter);
        const progress = previous && previous.end > previous.start
            ? Math.max(0, Math.min(1, (now - previous.start) / (previous.end - previous.start))) : 1;
        const current = previous ? previous.from + (previous.to - previous.from) * progress : parameter.value;
        const end = now + duration / 1000;
        parameter.cancelScheduledValues(now);
        parameter.setValueAtTime(current, now);
        parameter.linearRampToValueAtTime(value, end);
        volume_ramps.set(parameter, { from: current, to: value, start: now, end });
    }

    function fade_out_channel(channel) {
        if (channel.target !== 0) {
            channel.target = 0;
            ramp_volume(channel.gain.gain, 0, motionDuration('slow', 400));
        }
        if (channel.source && !channel.stop_timer) {
            channel.stop_timer = setTimeout(() => stop_channel(channel), motionDuration('slow', 400));
        }
    }

    function prepare_loop(buffer) {
        const overlap = Math.min(
            Math.round(buffer.sampleRate * motionDuration('gentle', 600) / 1000),
            Math.floor(buffer.length / 4)
        );
        if (overlap < 2) return buffer;
        const length = buffer.length - overlap;
        const loop = context.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const input = buffer.getChannelData(channel);
            const output = loop.getChannelData(channel);
            output.set(input.subarray(overlap, buffer.length - overlap));
            for (let index = 0; index < overlap; index++) {
                const progress = index / (overlap - 1);
                const angle = progress * Math.PI / 2;
                output[length - overlap + index] = input[buffer.length - overlap + index] * Math.cos(angle)
                    + input[index] * Math.sin(angle);
            }
        }
        return loop;
    }

    function initialize() {
        if (context) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) throw new Error('Ambient audio is not supported in this browser.');
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = muted ? 0 : master_volume;
        master.connect(context.destination);
        for (const track of ambient_tracks) {
            const gain = context.createGain();
            gain.gain.value = 0;
            gain.connect(master);
            channels.set(track.id, { gain, buffer: null, source: null, offset: 0, started: 0, pending: false, abort: null, target: 0, stop_timer: null });
        }
    }

    function stop_channel(channel) {
        clearTimeout(channel.stop_timer);
        channel.stop_timer = null;
        if (!channel.source) return;
        channel.offset = (channel.offset + context.currentTime - channel.started) % channel.buffer.duration;
        channel.source.stop();
        channel.source.disconnect();
        channel.source = null;
    }

    async function update_channel(track, fade_in = motionDuration('slow', 400)) {
        const channel = channels.get(track.id);
        const wanted = playing && track.volume > 0;
        if (!wanted) {
            fade_out_channel(channel);
            return;
        }
        clearTimeout(channel.stop_timer);
        channel.stop_timer = null;
        const target = track.volume / 100;
        const changed = channel.target !== target;
        channel.target = target;
        if (channel.source) {
            if (changed) ramp_volume(channel.gain.gain, target);
            return;
        }
        if (channel.pending) return;
        if (!channel.buffer) {
            channel.pending = true;
            channel.abort = new AbortController();
            try {
                const response = await fetch(track.src, { signal: channel.abort.signal });
                if (!response.ok) throw new Error(`Could not load ${track.label.toLowerCase()}. Try again.`);
                const data = await response.arrayBuffer();
                if (destroyed) return;
                const decoded = await context.decodeAudioData(data);
                if (destroyed) return;
                channel.buffer = await normalize_ambient_buffer(prepare_loop(decoded));
            } catch (error) {
                if (!destroyed && error.name !== 'AbortError') {
                    on_status({ error: `${track.label} could not load. Adjust its volume to retry.` });
                }
                return;
            } finally {
                channel.pending = false;
                channel.abort = null;
            }
        }
        const current = mix.find((item) => item.id === track.id);
        if (destroyed || !playing || !current || current.volume <= 0) return;
        channel.source = context.createBufferSource();
        channel.source.buffer = channel.buffer;
        channel.source.loop = true;
        channel.source.connect(channel.gain);
        channel.started = context.currentTime;
        channel.target = current.volume / 100;
        channel.gain.gain.cancelScheduledValues(context.currentTime);
        channel.gain.gain.setValueAtTime(0, context.currentTime);
        volume_ramps.set(channel.gain.gain, { from: 0, to: 0, start: context.currentTime, end: context.currentTime });
        ramp_volume(channel.gain.gain, channel.target, fade_in);
        channel.source.start(0, channel.offset);
    }

    return {
        set_mix(next) {
            mix = next.map((track) => ({ ...track }));
            if (!context || destroyed) return;
            if (!mix.some((track) => track.volume > 0)) playing = false;
            for (const track of mix) {
                void update_channel(track);
            }
        },
        async play() {
            if (destroyed || !mix.some((track) => track.volume > 0)) return;
            if (playing && context?.state === 'running') return;
            initialize();
            playing = true;
            try {
                await context.resume();
                if (destroyed || !playing) return;
                for (const track of mix) void update_channel(track);
            } catch {
                playing = false;
                throw new Error('Playback could not start. Adjust a sound volume to retry.');
            }
        },
        pause() {
            playing = false;
            for (const channel of channels.values()) fade_out_channel(channel);
        },
        get_track_state(id) {
            const channel = channels.get(id);
            if (!channel) return { position: 0, duration: 0, loading: false };
            const duration = channel.buffer?.duration ?? 0;
            const elapsed = channel.source ? Math.max(0, context.currentTime - channel.started) : 0;
            return { duration, position: duration ? (channel.offset + elapsed) % duration : 0, loading: channel.pending };
        },
        seek_track(id, position) {
            const channel = channels.get(id);
            const track = mix.find((item) => item.id === id);
            if (!channel?.buffer || !track || destroyed || !Number.isFinite(position)) return;
            stop_channel(channel);
            channel.offset = Math.max(0, Math.min(channel.buffer.duration - 1 / channel.buffer.sampleRate, position));
            void update_channel(track, motionDuration('quick', 100));
        },
        set_muted(value) {
            muted = value;
            if (master) ramp_volume(master.gain, muted ? 0 : master_volume, motionDuration('slow', 400));
        },
        destroy() {
            destroyed = true;
            playing = false;
            for (const channel of channels.values()) {
                channel.abort?.abort();
                stop_channel(channel);
            }
            if (context) void context.close();
        }
    };
}
