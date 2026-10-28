import { tick } from 'svelte';
import { motionDuration } from './motion.js';

export function editor_font_transition(node, initial) {
    let current = initial;
    let animation;
    let version = 0;
    node.style.fontFamily = initial.font;
    node.style.fontSize = `${initial.size}px`;

    async function update(next) {
        if (next.font === current.font && next.size === current.size) return;
        const font_changed = next.font !== current.font;
        current = next;
        const request = ++version;
        const style = getComputedStyle(node);
        const opacity = style.opacity;
        const old_size = style.fontSize;
        animation?.cancel();
        if (node.dataset.resetting === 'true' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            node.style.fontFamily = next.font;
            node.style.fontSize = `${next.size}px`;
            return;
        }
        if (font_changed) {
            if (next.font.includes('Dyslexic')) {
                await document.fonts.load('18px "Dyslexic"').catch(() => {});
                if (request !== version) return;
            }
            animation = node.animate([{ opacity }, { opacity: 0 }], {
                duration: motionDuration('short', 150), easing: 'ease-out', fill: 'forwards'
            });
            try { await animation.finished; } catch { return; }
            if (request !== version) return;
        }
        node.style.fontFamily = next.font;
        node.style.fontSize = `${next.size}px`;
        animation?.cancel();
        animation = node.animate([
            { fontSize: old_size, opacity: font_changed ? 0 : opacity },
            { fontSize: `${next.size}px`, opacity: 1 }
        ], { duration: motionDuration('standard', 200), easing: 'ease-out' });
    }
    return { update, destroy() { version++; animation?.cancel(); } };
}

export async function reset_editor_visuals(apply) {
    const node = document.querySelector('[data-patter-body]');
    if (!node) return apply();
    const surface = node.parentElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animation;
    try {
        if (!reduced) {
            animation = surface.animate([{ opacity: 1 }, { opacity: 0 }], {
                duration: motionDuration('short', 150), easing: 'ease-out', fill: 'forwards'
            });
            await animation.finished;
        }
        node.dataset.resetting = 'true';
        window.dispatchEvent(new Event('patter-editor-reset-start'));
        await apply();
        await tick();
        window.dispatchEvent(new Event('patter-editor-reset-end'));
    } finally {
        delete node.dataset.resetting;
        animation?.cancel();
        if (!reduced && surface.isConnected) {
            surface.animate([{ opacity: 0 }, { opacity: 1 }], {
                duration: motionDuration('standard', 200), easing: 'ease-out'
            });
        }
    }
}
