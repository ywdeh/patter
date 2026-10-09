const SOUND_SRC = '/type.mp3';
const VOICE_COUNT = 4;
const voices = typeof Audio === 'undefined'
    ? []
    : Array.from({ length: VOICE_COUNT }, () => {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.crossOrigin = 'anonymous';
        audio.src = SOUND_SRC;
        audio.volume = 0.15;
        audio.load();
        return audio;
    });

let nextVoice = 0;

export function playTapSound() {
    if (voices.length === 0) return;
    const audio = voices[nextVoice];
    nextVoice = (nextVoice + 1) % voices.length;
    audio.currentTime = 0;
    audio.play().catch(() => {});
}
