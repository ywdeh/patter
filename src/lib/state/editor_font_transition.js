import { motionDuration } from './motion.js';

export function editor_font_transition(node, initial_font) {
    let current_font = initial_font;
    let animation;
    let version = 0;
    node.style.fontFamily = initial_font;

    async function update(next_font) {
        if (next_font === current_font) return;
        current_font = next_font;
        const request = ++version;
        const opacity = getComputedStyle(node).opacity;
        animation?.cancel();
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            node.style.fontFamily = next_font;
            return;
        }
        // Load the optional local font before beginning the visual change.
        if (next_font.includes('OpenDyslexic')) {
            await document.fonts.load('18px OpenDyslexic').catch(() => {});
            if (request !== version) return;
        }
        animation = node.animate([{ opacity }, { opacity: 0 }], {
            duration: motionDuration('short', 150), easing: 'ease-out', fill: 'forwards'
        });
        try { await animation.finished; } catch { return; }
        if (request !== version) return;
        node.style.fontFamily = next_font;
        animation.cancel();
        animation = node.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: motionDuration('standard', 200), easing: 'ease-out'
        });
    }
    return {
        update,
        destroy() { version++; animation?.cancel(); }
    };
}
