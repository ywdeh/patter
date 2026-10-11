const STORAGE_KEY = 'patter-sound-enabled';

function loadSoundEnabled() {
    if (typeof localStorage === 'undefined') return true;
    try {
        return localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch {
        return true;
    }
}

export let sound_enabled = $state(loadSoundEnabled());

export function getSoundEnabled() {
    return sound_enabled;
}

export function setSoundEnabled(enabled) {
    sound_enabled = Boolean(enabled);
    if (typeof localStorage === 'undefined') return;

    try {
        if (sound_enabled) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, 'false');
    } catch {}
}
