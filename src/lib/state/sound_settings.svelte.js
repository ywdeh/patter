const STORAGE_KEY = 'patter-sound-enabled';

function loadSoundEnabled(key = STORAGE_KEY) {
    if (typeof localStorage === 'undefined') return true;
    try {
        return localStorage.getItem(key) !== 'false';
    } catch {
        return true;
    }
}

export const sound_enabled = $state({ value: loadSoundEnabled() });
const TYPING_STORAGE_KEY = 'patter-typing-sound-enabled';
export const typing_sound_enabled = $state({ value: loadSoundEnabled(TYPING_STORAGE_KEY) });

export function setSoundEnabled(enabled) {
    sound_enabled.value = Boolean(enabled);
    if (typeof localStorage === 'undefined') return;

    try {
        if (sound_enabled.value) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, 'false');
    } catch {}
}

export function setTypingSoundEnabled(enabled) {
    typing_sound_enabled.value = Boolean(enabled);
    if (typeof localStorage === 'undefined') return;
    try {
        if (typing_sound_enabled.value) localStorage.removeItem(TYPING_STORAGE_KEY);
        else localStorage.setItem(TYPING_STORAGE_KEY, 'false');
    } catch {}
}
