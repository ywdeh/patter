// Decoded hover audio avoids the startup latency of an HTML audio element.
let context;
let buffer;
let preparing;
let start_offset = 0;

export function prepare_hover_audio(source) {
    if (preparing || typeof window === 'undefined') return;
    preparing = (async () => {
        context = new AudioContext({ latencyHint: 'interactive' });
        const response = await fetch(source);
        if (!response.ok) throw new Error('Hover audio unavailable');
        buffer = await context.decodeAudioData(await response.arrayBuffer());
        // Remove only leading near-silence, leaving the sound's attack intact.
        const samples = buffer.getChannelData(0);
        const first = samples.findIndex((sample) => Math.abs(sample) > 0.002);
        start_offset = Math.max(0, first - Math.round(buffer.sampleRate * 0.002)) / buffer.sampleRate;
    })().catch(() => { buffer = null; });
}

export function play_hover_audio(volume) {
    if (!buffer || !context) return false;
    if (context.state !== 'running') {
        void context.resume().catch(() => {});
        return false;
    }
    const voice = context.createBufferSource();
    const gain = context.createGain();
    voice.buffer = buffer;
    gain.gain.value = volume;
    voice.connect(gain).connect(context.destination);
    voice.onended = () => { voice.disconnect(); gain.disconnect(); };
    voice.start(0, start_offset);
    return true;
}
