import { motionDuration } from './motion.js';
import { normalize_ambient_buffer } from './ambient_normalization.js';

export const ambient_tracks = Object.freeze([
    { id: 'rain', label: 'Rain', src: '/ambience/rain.mp3', enabled: false, volume: 0 },
    { id: 'flute', label: 'Flute', src: '/ambience/flute.mp3', enabled: false, volume: 0 },
    { id: 'campfire', label: 'Campfire', src: '/ambience/campfire.mp3', enabled: false, volume: 0 }
]);

export function create_ambient_player(on_status) {
    let context;
    let master;
    let playing = false;
    let muted = false;
    let destroyed = false;
    let mix = [];
    const channels = new Map();

    function ramp_volume(parameter, value) {
        const now = context.currentTime;
        if (parameter.cancelAndHoldAtTime) parameter.cancelAndHoldAtTime(now);
        else {
            const current = parameter.value;
            parameter.cancelScheduledValues(now);
            parameter.setValueAtTime(current, now);
        }
        parameter.linearRampToValueAtTime(value, now + motionDuration('slow', 400) / 1000);
    }

    function fade_out_channel(channel) {
        if (channel.target !== 0) {
            channel.target = 0;
            ramp_volume(channel.gain.gain, 0);
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

    function publish() {
        if (!destroyed) on_status({ playing, loading: [...channels.values()].some((channel) => channel.pending) });
    }

    function initialize() {
        if (context) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) throw new Error('Ambient audio is not supported in this browser.');
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = muted ? 0 : 0.7;
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

    async function update_channel(track) {
        const channel = channels.get(track.id);
        const wanted = playing && track.enabled && track.volume > 0;
        if (!wanted) {
            fade_out_channel(channel);
            return;
        }
        clearTimeout(channel.stop_timer);
        channel.stop_timer = null;
        if (channel.target !== track.volume / 100) {
            channel.target = track.volume / 100;
            ramp_volume(channel.gain.gain, channel.target);
        }
        if (channel.source || channel.pending) return;
        if (!channel.buffer) {
            channel.pending = true;
            channel.abort = new AbortController();
            publish();
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
                publish();
            }
        }
        const current = mix.find((item) => item.id === track.id);
        if (destroyed || !playing || !current?.enabled || current.volume <= 0) return;
        channel.source = context.createBufferSource();
        channel.source.buffer = channel.buffer;
        channel.source.loop = true;
        channel.source.connect(channel.gain);
        channel.started = context.currentTime;
        channel.gain.gain.cancelScheduledValues(context.currentTime);
        channel.gain.gain.setValueAtTime(0, context.currentTime);
        ramp_volume(channel.gain.gain, current.volume / 100);
        channel.source.start(0, channel.offset);
    }

    return {
        set_mix(next) {
            mix = next.map((track) => ({ ...track }));
            if (!context || destroyed) return;
            if (!mix.some((track) => track.enabled && track.volume > 0)) playing = false;
            for (const track of mix) void update_channel(track);
            publish();
        },
        async play() {
            if (destroyed || !mix.some((track) => track.enabled && track.volume > 0)) return;
            initialize();
            playing = true;
            publish();
            try {
                await context.resume();
                if (destroyed || !playing) return;
                for (const track of mix) void update_channel(track);
            } catch {
                playing = false;
                publish();
                throw new Error('Playback could not start. Try pressing play again.');
            }
        },
        pause() {
            playing = false;
            for (const channel of channels.values()) fade_out_channel(channel);
            publish();
        },
        set_muted(value) {
            muted = value;
            if (master) ramp_volume(master.gain, muted ? 0 : 0.7);
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
