export function mount_panel_occlusion() {
    const panel_selector = '[data-patter-panel]';
    const targets = new Map();
    const written_styles = new WeakMap();
    const mask_signatures = new WeakMap();
    const panel_order = new Map();
    let panels = [];
    let frame = 0;
    let rescan = true;
    let refresh_animations = true;
    let destroyed = false;
    let animation_nodes = new Set();
    const active_animations = new Set();
    const observed_animations = new WeakSet();
    const animation_relevance = new WeakMap();
    const sizes = new ResizeObserver(request_update);
    const paint_only = /^(?:color|background(?:-[a-z]+)?|(?:border|outline)(?:-[a-z]+)*-color|box-shadow|text-shadow|(?:fill|stroke)(?:-opacity)?|caret-color|text-decoration-color|accent-color)$/;
    const keyframe_metadata = new Set(['offset', 'computedOffset', 'easing', 'composite']);
    function affects_mask(property) {
        return !paint_only.test(property.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase()));
    }

    const mask_properties = ['maskImage', 'maskSize', 'maskPosition', 'maskRepeat', 'maskClip'];
    function remember(node) { return Object.fromEntries(mask_properties.map((key) => [key, node.style[key]])); }
    function write(node, values) {
        let changed = false;
        for (const key of mask_properties) if (node.style[key] !== values[key]) { node.style[key] = values[key]; changed = true; }
        if (changed) written_styles.set(node, node.getAttribute('style'));
    }
    function collect() {
        sizes.disconnect();
        panels = [...document.querySelectorAll(panel_selector)];
        panel_order.clear();
        panels.forEach((node, index) => panel_order.set(node, index));
        const next = new Set();
        function walk(node) {
            if (!(node instanceof HTMLElement) || node.matches('script, style, link, [data-patter-background]')) return;
            if (node.matches(panel_selector)) { next.add(node); return; }
            if (node.querySelector(panel_selector)) {
                for (const child of node.children) walk(child);
            } else next.add(node);
        }
        for (const child of document.body.children) walk(child);
        for (const [node, original] of targets) {
            if (!next.has(node)) { write(node, original); targets.delete(node); }
        }
        for (const node of next) if (!targets.has(node)) targets.set(node, remember(node));
        for (const node of new Set([...panels, ...targets.keys()])) sizes.observe(node);
        animation_nodes = new Set();
        for (const target of new Set([...panels, ...targets.keys()])) {
            for (let node = target; node; node = node.parentElement) animation_nodes.add(node);
        }
        refresh_animations = true;
        rescan = false;
    }
    function visible(node, styles) {
        if (!node.getClientRects().length) return false;
        for (let current = node; current; current = current.parentElement) {
            const style = styles(current);
            if (style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        }
        return true;
    }
    function relevant_animation(animation) {
        if ('transitionProperty' in animation) return affects_mask(animation.transitionProperty);
        if (!animation_relevance.has(animation)) {
            const keyframes = animation.effect?.getKeyframes?.();
            animation_relevance.set(animation, !keyframes?.length || keyframes.some((keyframe) =>
                Object.keys(keyframe).some((property) => !keyframe_metadata.has(property) && affects_mask(property))));
        }
        return animation_relevance.get(animation);
    }
    function update_animations() {
        active_animations.clear();
        for (const node of animation_nodes) for (const animation of node.getAnimations()) {
            if (!relevant_animation(animation)) continue;
            active_animations.add(animation);
            if (observed_animations.has(animation)) continue;
            observed_animations.add(animation);
            const finish = () => {
                active_animations.delete(animation);
                schedule();
            };
            animation.finished.then(finish, finish);
        }
        refresh_animations = false;
    }
    function paint() {
        frame = 0;
        if (rescan) collect();
        if (refresh_animations) update_animations();
        const moving = [...active_animations].some((animation) => animation.pending || animation.playState === 'running');
        const style_cache = new Map();
        const styles = (node) => {
            if (!style_cache.has(node)) style_cache.set(node, getComputedStyle(node));
            return style_cache.get(node);
        };
        const covers = panels.filter((node) => visible(node, styles)).map((node) => {
            const style = styles(node);
            return { node, order: panel_order.get(node), priority: Number(node.dataset.patterPanel) || 0, bounds: node.getBoundingClientRect(), opacity: Number(style.opacity), radius: parseFloat(style.borderTopLeftRadius) || 0 };
        });
        const geometry = [...targets].map(([node, original]) => ({ node, original, bounds: covers.length ? node.getBoundingClientRect() : null }));
        for (const { node, original, bounds } of geometry) {
            if (!covers.length) { mask_signatures.delete(node); write(node, original); continue; }
            const own_order = panel_order.get(node) ?? -1;
            const own_priority = panel_order.has(node) ? Number(node.dataset.patterPanel) || 0 : -Infinity;
            const padding = 32;
            const holes = [];
            for (const cover of covers) {
                if (cover.node === node || cover.priority < own_priority) continue;
                if (cover.priority === own_priority && cover.order < own_order) continue;
                const left = cover.bounds.left - bounds.left - 4;
                const top = cover.bounds.top - bounds.top - 4;
                const right = cover.bounds.right - bounds.left + 4;
                const bottom = cover.bounds.bottom - bounds.top + 4;
                if (right <= -padding || left >= bounds.width + padding || bottom <= -padding || top >= bounds.height + padding) continue;
                holes.push(`<rect x="${left.toFixed(2)}" y="${top.toFixed(2)}" width="${(right - left).toFixed(2)}" height="${(bottom - top).toFixed(2)}" rx="${cover.radius + 4}" fill="black" opacity="${cover.opacity.toFixed(3)}"/>`);
            }
            if (!holes.length) { mask_signatures.delete(node); write(node, original); continue; }
            const width = bounds.width + padding * 2, height = bounds.height + padding * 2;
            const holes_markup = holes.join('');
            const signature = `${width},${height}:${holes_markup}`;
            if (mask_signatures.get(node) === signature) continue;
            const area = `x="-${padding}" y="-${padding}" width="${width}" height="${height}"`;
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="-${padding} -${padding} ${width} ${height}"><defs><mask id="cut" maskUnits="userSpaceOnUse" ${area} style="mask-type:luminance"><rect ${area} fill="white"/>${holes_markup}</mask></defs><rect ${area} fill="white" mask="url(#cut)"/></svg>`;
            write(node, {
                maskImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
                maskSize: `${width}px ${height}px`,
                maskPosition: `-${padding}px -${padding}px`,
                maskRepeat: 'no-repeat', maskClip: 'no-clip'
            });
            mask_signatures.set(node, signature);
        }
        if (moving) schedule();
    }
    function schedule() { if (!destroyed && !frame) frame = requestAnimationFrame(paint); }
    function request_update() {
        refresh_animations = true;
        schedule();
    }
    function animation_event(event) {
        if (!animation_nodes.has(event.target)) return;
        if ('propertyName' in event && !affects_mask(event.propertyName)) return;
        request_update();
    }
    const animation_events = ['transitionrun', 'transitionend', 'transitioncancel', 'animationstart', 'animationend', 'animationcancel'];
    const changes = new MutationObserver((records) => {
        let relevant = false;
        const checked_styles = new Set();
        for (const record of records) {
            if (record.target instanceof Element && record.target.closest('[data-patter-background]')) continue;
            if (record.type === 'attributes' && record.attributeName === 'style') {
                if (checked_styles.has(record.target)) continue;
                checked_styles.add(record.target);
                if (written_styles.get(record.target) === record.target.getAttribute('style')) continue;
                mask_signatures.delete(record.target);
            }
            if (record.attributeName === 'data-patter-panel') rescan = true;
            if (record.type === 'childList') {
                const structural = [...record.addedNodes, ...record.removedNodes].some((node) =>
                    node instanceof Element && (node.matches(panel_selector) || node.querySelector(panel_selector) || targets.has(node)));
                if (structural || record.target === document.body) rescan = true;
            }
            relevant = true;
        }
        if (relevant) request_update();
    });
    changes.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'inert', 'aria-expanded', 'data-patter-panel'] });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    for (const event of animation_events) document.addEventListener(event, animation_event);
    schedule();
    return () => {
        destroyed = true;
        active_animations.clear();
        changes.disconnect();
        sizes.disconnect();
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', schedule);
        window.removeEventListener('scroll', schedule, true);
        for (const event of animation_events) document.removeEventListener(event, animation_event);
        for (const [node, original] of targets) write(node, original);
        targets.clear();
    };
}
