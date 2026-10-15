import { sound_enabled } from '$lib/state/sound_settings.svelte.js';

const click_sources = Object.freeze(['/click_1.mp3', '/click_2.mp3', '/click_3.mp3']);

export const sound_presets = Object.freeze({
    click: Object.freeze({ sources: click_sources, volume: 0.1, voices: 4 }),
    typing: Object.freeze({ sources: click_sources, volume: 0.5, voices: 4 }),
    paper_turn: Object.freeze({
        sources: ['/paper_turn_1.mp3', '/paper_turn_2.mp3', '/paper_turn_3.mp3', '/paper_turn_4.mp3'],
        volume: 0.12,
        voices: 2
    })
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

function getSoundPool(source, volume, voiceCount) {
    let pool = sound_pools.get(source);
    if (!pool) {
        pool = createSoundPool(source, volume, voiceCount);
        sound_pools.set(source, pool);
    }
    return pool;
}

for (const preset of Object.values(sound_presets)) {
    for (const source of preset.sources) getSoundPool(source, preset.volume, preset.voices);
}

const next_voice = new Map();
const previous_source = new Map();

function chooseSource(sound, sources) {
    if (sources.length <= 1) return sources[0];

    const previous = previous_source.get(sound);
    const choices = previous ? sources.filter((source) => source !== previous) : sources;
    const source = choices[Math.floor(Math.random() * choices.length)];
    previous_source.set(sound, source);
    return source;
}

export function playSound(sound = 'click', volumeScale = 1) {
    if (!sound || !sound_enabled.value) return;
    const preset = sound_presets[sound];
    const sources = preset?.sources ?? [sound];
    const source = chooseSource(sound, sources);
    if (typeof source !== 'string' || !source) return;

    const pool = getSoundPool(source, preset?.volume ?? sound_presets.click.volume, preset?.voices ?? 4);
    if (!pool?.length) return;

    const voiceIndex = next_voice.get(source) ?? 0;
    const audio = pool[voiceIndex];
    next_voice.set(source, (voiceIndex + 1) % pool.length);
    audio.volume = (preset?.volume ?? sound_presets.click.volume) * Math.max(0, Math.min(1, volumeScale));
    audio.playbackRate = preset?.playbackRate ?? 1;
    audio.currentTime = 0;
    audio.play().catch(() => {});
}
