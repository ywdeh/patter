let pending_origin = null;
let spread_sequence = 0;
let latest_spread = 0;

export function begin_wallpaper_spread() {
    latest_spread = ++spread_sequence;
    return latest_spread;
}

export function capture_spread_origin(event) {
    let x = event?.clientX;
    let y = event?.clientY;
    if (event?.type === 'click' && event.detail === 0) {
        const bounds = event.currentTarget?.getBoundingClientRect();
        x = bounds ? bounds.left + bounds.width / 2 : undefined;
        y = bounds ? bounds.top + bounds.height / 2 : undefined;
    }
    return { clientX: x, clientY: y };
}

export function set_spread_origin(key, event) {
    const { clientX: x, clientY: y } = capture_spread_origin(event);
    pending_origin = Number.isFinite(x) && Number.isFinite(y)
        ? { key, x: x / window.innerWidth, y: y / window.innerHeight } : null;
}

export function take_spread_origin(key) {
    const origin = pending_origin?.key === key ? pending_origin : null;
    pending_origin = null;
    return origin;
}

export function complete_wallpaper_spread(key, sequence = latest_spread) {
    queueMicrotask(() => {
        window.dispatchEvent(new CustomEvent('patter-wallpaper-spread', { detail: { key, sequence, latest: sequence === latest_spread, complete: true } }));
    });
}

export function spread_wallpaper(node, { duration, signal, origin, key, sequence }) {
    if (signal.aborted) return Promise.resolve();
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches
        || !CSS.supports('clip-path', 'polygon(0 0, 100% 0, 100% 100%)')) {
        if (key) complete_wallpaper_spread(key, sequence);
        return Promise.resolve();
    }

    const bounds = node.getBoundingClientRect();
    const x = origin ? Math.max(0, Math.min(100, (origin.x * window.innerWidth - bounds.left) / bounds.width * 100)) : 48;
    const y = origin ? Math.max(0, Math.min(100, (origin.y * window.innerHeight - bounds.top) / bounds.height * 100)) : 52;
    const center_x = bounds.width * x / 100;
    const center_y = bounds.height * y / 100;
    const radius = Math.hypot(Math.max(center_x, bounds.width - center_x), Math.max(center_y, bounds.height - center_y)) + 16;
    const phase = Math.random() * Math.PI * 2;
    const edges = Array.from({ length: 120 }, (_, index) => {
        const angle = index / 120 * Math.PI * 2;
        return {
            x: Math.cos(angle), y: Math.sin(angle),
            sin3: Math.sin(angle * 3 + phase), cos3: Math.cos(angle * 3 + phase),
            sin7: Math.sin(angle * 7 - phase), cos7: Math.cos(angle * 7 - phase),
            fixed: Math.sin(angle * 13 + phase * 2) * 0.055 + Math.sin(angle * 23 - phase) * 0.025
        };
    });
    const transition = node.style.transition;
    let frame = 0;

    return new Promise((resolve) => {
        const finish = () => {
            cancelAnimationFrame(frame);
            signal.removeEventListener('abort', finish);
            node.style.removeProperty('clip-path');
            node.style.transition = transition;
            if (!signal.aborted && key) complete_wallpaper_spread(key, sequence);
            resolve();
        };

        const paint = (progress) => {
            const size = progress * radius;
            const strength = Math.sin(progress * Math.PI);
            const sin_progress = Math.sin(progress);
            const cos_progress = Math.cos(progress);
            const sin_slow = Math.sin(progress * 0.7);
            const cos_slow = Math.cos(progress * 0.7);
            const points = edges.map((point) => {
                const displacement = (point.sin3 * cos_progress + point.cos3 * sin_progress) * 0.18
                    + (point.sin7 * cos_slow + point.cos7 * sin_slow) * 0.1 + point.fixed;
                const edge = size * (1 + displacement * strength);
                return [center_x + point.x * edge, center_y + point.y * edge];
            });
            node.style.clipPath = `polygon(${points.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})`;
            if (key) {
                window.dispatchEvent(new CustomEvent('patter-wallpaper-spread', {
                    detail: { key, sequence, points, left: bounds.left, top: bounds.top }
                }));
            }
        };

        node.style.transition = 'none';
        paint(0);
        signal.addEventListener('abort', finish, { once: true });
        const started = performance.now();
        const animate = (now) => {
            const progress = Math.min(1, (now - started) / Math.max(1, duration));
            paint(progress * progress * (3 - 2 * progress));
            if (progress < 1) frame = requestAnimationFrame(animate);
            else finish();
        };
        frame = requestAnimationFrame(animate);
    });
}
