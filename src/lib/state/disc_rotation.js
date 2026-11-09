import { motionDuration } from './motion.js';

const tracks = new Map();

function now() {
    return document.timeline.currentTime ?? performance.now();
}

function position(track) {
    return track.elapsed + (track.started === null ? 0 : now() - track.started);
}

export function disc_rotation(node, { key, active = false }) {
    if (!tracks.has(key)) tracks.set(key, { elapsed: 0, started: null, nodes: new Set() });
    const track = tracks.get(key);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const animation = node.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
        duration: motionDuration('disc', 24000), iterations: Infinity, easing: 'linear'
    });
    animation.pause();
    animation.currentTime = position(track);

    function stop() {
        if (track.nodes.delete(node) && !track.nodes.size) {
            track.elapsed = position(track);
            track.started = null;
        }
    }

    function sync() {
        if (active && !reduced.matches) {
            if (!track.nodes.size) track.started = now();
            track.nodes.add(node);
            animation.play();
            animation.startTime = now() - position(track);
        } else {
            stop();
            animation.pause();
            animation.currentTime = reduced.matches ? 0 : position(track);
        }
    }

    sync();
    reduced.addEventListener('change', sync);
    return {
        update(value) { if (active === value.active) return; active = value.active; sync(); },
        destroy() { stop(); reduced.removeEventListener('change', sync); animation.cancel(); }
    };
}
