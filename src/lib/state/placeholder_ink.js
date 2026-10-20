import { motionDuration } from './motion.js';

const ink_characters = 'abcdefghijklmnopqrstuvwxyz';
const frame_interval = 40;
const properties = ['--patter_placeholder_frame', '--patter_placeholder_ink_opacity', '--patter_placeholder_ink_blur'];

export function placeholder_ink(node, initial_text) {
    const reduced_motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let target = initial_text;
    let displayed = initial_text;
    let frame = 0;

    function stop() {
        cancelAnimationFrame(frame);
        frame = 0;
        for (const property of properties) node.style.removeProperty(property);
    }

    function update(text) {
        if (text === target) return;
        const outgoing = Array.from(displayed);
        target = text;
        stop();
        if (node.dataset.empty !== 'true' || reduced_motion.matches) {
            displayed = target;
            return;
        }

        const incoming = Array.from(target);
        const duration = motionDuration('gentle', 600);
        const started = performance.now();
        let previous_frame = -frame_interval;

        function animate(now) {
            const elapsed = now - started;
            const progress = Math.min(1, elapsed / Math.max(1, duration));
            if (progress >= 1 || node.dataset.empty !== 'true' || reduced_motion.matches) {
                displayed = target;
                stop();
                return;
            }

            if (elapsed - previous_frame >= frame_interval) {
                previous_frame = elapsed;
                const dissolving = progress < 0.45;
                const phase = dissolving ? progress / 0.45 : (progress - 0.45) / 0.55;
                const characters = dissolving ? outgoing : incoming;
                displayed = characters.map((character, index) => {
                    if (/\s/u.test(character)) return character;
                    const offset = (index / Math.max(1, characters.length - 1)) * 0.65;
                    if (dissolving && phase < offset) return character;
                    if (!dissolving && phase >= offset + 0.35) return character;
                    const glyph = ink_characters[Math.floor(Math.random() * ink_characters.length)];
                    return character === character.toUpperCase() ? glyph.toUpperCase() : glyph;
                }).join('');
                const distortion = Math.sin(progress * Math.PI);
                node.style.setProperty('--patter_placeholder_frame', JSON.stringify(displayed));
                node.style.setProperty('--patter_placeholder_ink_opacity', String(1 - distortion * 0.5));
                node.style.setProperty('--patter_placeholder_ink_blur', `${distortion * 4}px`);
            }
            frame = requestAnimationFrame(animate);
        }

        animate(started);
    }

    return { update, destroy: stop };
}
