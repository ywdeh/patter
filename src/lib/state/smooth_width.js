import { motionDuration } from './motion.js';

export function smooth_width(node, enabled = true) {
    const content = node.querySelector('[data-control-content]');
    if (!content) return;
    let active = enabled;
    let width = node.getBoundingClientRect().width;
    let animation;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const observer = new ResizeObserver(() => {
        const style = getComputedStyle(node);
        const next_width = content.getBoundingClientRect().width
            + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
            + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
        const previous = animation?.playState === 'running' ? node.getBoundingClientRect().width : width;
        width = next_width;
        if (!active || reduced.matches || Math.abs(previous - next_width) < 0.5) {
            animation?.cancel();
            animation = null;
            return;
        }
        animation?.cancel();
        animation = node.animate([{ width: `${previous}px` }, { width: `${next_width}px` }], {
            duration: motionDuration('standard', 200), easing: 'ease-out'
        });
    });
    observer.observe(content);
    return {
        update(value) {
            active = value;
            if (!active) animation?.cancel();
        },
        destroy() { observer.disconnect(); animation?.cancel(); }
    };
}
