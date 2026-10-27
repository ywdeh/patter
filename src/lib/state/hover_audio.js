let context;
const buffers = new Map();
let preparing;

export function prepare_hover_audio(sources) {
    if (preparing || typeof window === 'undefined') return;
    preparing = (async () => {
        context = new AudioContext({ latencyHint: 'interactive' });
        await Promise.all(sources.map(async (source) => {
            try {
                const response = await fetch(source);
                if (!response.ok) return;
                const buffer = await context.decodeAudioData(await response.arrayBuffer());
                const samples = buffer.getChannelData(0);
                const first = samples.findIndex((sample) => Math.abs(sample) > 0.002);
                const start_offset = Math.max(0, first - Math.round(buffer.sampleRate * 0.002)) / buffer.sampleRate;
                buffers.set(source, { buffer, start_offset });
            } catch {  }
        }));
    })().catch(() => {});
}

export function play_hover_audio(source, volume) {
    const entry = buffers.get(source);
    if (!entry || !context) return false;
    if (context.state !== 'running') {
        void context.resume().catch(() => {});
        return false;
    }
    const voice = context.createBufferSource();
    const gain = context.createGain();
    voice.buffer = entry.buffer;
    gain.gain.value = volume;
    voice.connect(gain).connect(context.destination);
    voice.onended = () => { voice.disconnect(); gain.disconnect(); };
    voice.start(0, entry.start_offset);
    return true;
}
