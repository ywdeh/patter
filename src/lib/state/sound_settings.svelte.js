const STORAGE_KEY = 'patter-sound-enabled';

function loadSoundEnabled() {
    if (typeof localStorage === 'undefined') return true;
    try {
        return localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch {
        return true;
    }
}

export const sound_enabled = $state({ value: loadSoundEnabled() });

export function setSoundEnabled(enabled) {
    sound_enabled.value = Boolean(enabled);
    if (typeof localStorage === 'undefined') return;

    try {
        if (sound_enabled.value) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, 'false');
    } catch {}
}
