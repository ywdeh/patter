export const music_playback = $state({
    track: null,
    ambience: '',
    position: 0,
    duration: 0,
    loading: false
});

let controls = null;

export function connect_music_controls(next) {
    controls = next;
    return () => {
        if (controls !== next) return;
        controls = null;
        Object.assign(music_playback, { track: null, ambience: '', position: 0, duration: 0, loading: false });
    };
}

export function seek_music(position) {
    controls?.seek(position);
}
