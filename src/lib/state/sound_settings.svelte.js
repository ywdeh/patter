function create_sound_setting(key) {
    let enabled = true;
    try { enabled = typeof localStorage === 'undefined' || localStorage.getItem(key) !== 'false'; } catch {}
    const state = $state({ value: enabled });
    function set(value) {
        state.value = Boolean(value);
        if (typeof localStorage === 'undefined') return;
        try {
            if (state.value) localStorage.removeItem(key);
            else localStorage.setItem(key, 'false');
        } catch {}
    }
    return { state, set };
}

const master = create_sound_setting('patter-sound-enabled');
const typing = create_sound_setting('patter-typing-sound-enabled');
const interactions = create_sound_setting('patter-interaction-sound-enabled');

export const sound_enabled = master.state;
export const typing_sound_enabled = typing.state;
export const interaction_sound_enabled = interactions.state;
export const setSoundEnabled = master.set;
export const setTypingSoundEnabled = typing.set;
export const setInteractionSoundEnabled = interactions.set;
