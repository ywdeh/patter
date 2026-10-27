import { playSound } from './sound.js';
import { motionDuration } from './motion.js';

export function mount_ui_hover_sound() {
    let last_sound = -Infinity;
    function hover(event) {
        if (event.pointerType !== 'mouse' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        const control = event.target instanceof Element ? event.target.closest('[data-ui-hover-sound="true"]') : null;
        if (!control || control.matches(':disabled, [aria-disabled="true"]') || control.closest('[inert], .patter_disabled')) return;
        if (event.relatedTarget instanceof Node && control.contains(event.relatedTarget)) return;
        const now = performance.now();
        if (now - last_sound < motionDuration('quick', 100)) return;
        last_sound = now;
        playSound('hover');
    }
    document.addEventListener('pointerover', hover);
    return () => document.removeEventListener('pointerover', hover);
}
