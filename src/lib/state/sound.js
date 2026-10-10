export const sound_presets = Object.freeze({
    tap: Object.freeze({ src: '/type.mp3', volume: 0.15, voices: 4 }),
    paper_turn: Object.freeze({ src: '/paper_turn.mp3', volume: 0.2, voices: 2 })
});

const sound_pools = new Map();

function createSoundPool(source, volume, voiceCount) {
    if (typeof Audio === 'undefined') return [];

    return Array.from({ length: voiceCount }, () => {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.crossOrigin = 'anonymous';
        audio.src = source;
        audio.volume = volume;
        audio.load();
        return audio;
    });
}

function getSoundPool(sound) {
    const preset = sound_presets[sound];
    const source = preset?.src ?? sound;
    if (typeof source !== 'string' || !source) return null;

    const key = preset ? sound : source;
    let pool = sound_pools.get(key);
    if (!pool) {
        pool = createSoundPool(source, preset?.volume ?? 0.15, preset?.voices ?? 4);
        sound_pools.set(key, pool);
    }
    return pool;
}

for (const presetName of Object.keys(sound_presets)) getSoundPool(presetName);

const next_voice = new Map();

export function playSound(sound = 'tap') {
    if (!sound) return;
    const pool = getSoundPool(sound);
    if (!pool?.length) return;

    const key = sound_presets[sound] ? sound : sound_presets[sound]?.src ?? sound;
    const voiceIndex = next_voice.get(key) ?? 0;
    const audio = pool[voiceIndex];
    next_voice.set(key, (voiceIndex + 1) % pool.length);
    audio.currentTime = 0;
    audio.play().catch(() => {});
}
