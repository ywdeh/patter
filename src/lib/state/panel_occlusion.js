const panel_selector = '[data-patter-panel]';
const excluded = 'script, style, link, [data-patter-background]';
const mask_properties = ['maskImage', 'maskSize', 'maskPosition', 'maskRepeat', 'maskClip'];
const paint_only = /^(?:color|background(?:-[a-z]+)?|(?:border|outline)(?:-[a-z]+)*-color|box-shadow|text-shadow|(?:fill|stroke)(?:-opacity)?|caret-color|text-decoration-color|accent-color)$/;
const keyframe_metadata = new Set(['offset', 'computedOffset', 'easing', 'composite']);

function affects_mask(property) {
    return !paint_only.test(property.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase()));
}

function relevant_animation(animation) {
    if ('transitionProperty' in animation) return affects_mask(animation.transitionProperty);
    const keyframes = animation.effect?.getKeyframes?.();
    return !keyframes?.length || keyframes.some((keyframe) =>
        Object.keys(keyframe).some((property) => !keyframe_metadata.has(property) && affects_mask(property)));
}

export function mount_panel_occlusion() {
    const targets = new Map();
    const animations = new Set();
    const pending_nodes = new Set();
    let panels = [];
    let watched = new Set();
    let rescan = true;
    let frame = 0;
    let destroyed = false;
    const sizes = new ResizeObserver(schedule);

    function write(target, values, signature = null) {
        for (const key of mask_properties) {
            if (target.node.style[key] !== values[key]) target.node.style[key] = values[key];
        }
        target.signature = signature;
        target.inline = target.node.getAttribute('style');
    }

    function collect() {
        sizes.disconnect();
        panels = [...document.querySelectorAll(panel_selector)].map((node, order) =>
            ({ node, order, priority: Number(node.dataset.patterPanel) || 0 }));
        const branches = new Set();
        const panel_nodes = new Map(panels.map((panel) => [panel.node, panel]));
        for (const { node } of panels) {
            for (let parent = node.parentElement; parent; parent = parent.parentElement) branches.add(parent);
        }
        const next = new Set();
        function walk(node) {
            if (!(node instanceof HTMLElement) || node.matches(excluded)) return;
            if (panel_nodes.has(node) || !branches.has(node)) next.add(node);
            else for (const child of node.children) walk(child);
        }
        for (const child of document.body.children) walk(child);
        for (const [node, target] of targets) {
            if (!next.has(node)) { write(target, target.original); targets.delete(node); }
        }
        for (const node of next) {
            if (!targets.has(node)) targets.set(node, {
                node, original: Object.fromEntries(mask_properties.map((key) => [key, node.style[key]]))
            });
            Object.assign(targets.get(node), panel_nodes.get(node) ?? { order: -1, priority: -Infinity });
        }
        watched = new Set();
        for (const node of new Set([...panel_nodes.keys(), ...targets.keys()])) {
            sizes.observe(node);
            for (let parent = node; parent; parent = parent.parentElement) watched.add(parent);
        }
        for (const node of watched) pending_nodes.add(node);
        rescan = false;
    }

    function paint() {
        frame = 0;
        if (rescan) collect();
        for (const node of pending_nodes) {
            if (!watched.has(node) || !node.isConnected) continue;
            for (const animation of node.getAnimations()) {
                if (animations.has(animation) || (!animation.pending && animation.playState !== 'running') || !relevant_animation(animation)) continue;
                animations.add(animation);
                const finish = () => { animations.delete(animation); schedule(); };
                animation.finished.then(finish, finish);
            }
        }
        pending_nodes.clear();
        const moving = [...animations].some((animation) => animation.pending || animation.playState === 'running');
        const styles = new Map();
        const style = (node) => {
            if (!styles.has(node)) styles.set(node, getComputedStyle(node));
            return styles.get(node);
        };
        const covers = panels.filter(({ node }) => {
            if (!node.getClientRects().length) return false;
            for (let parent = node; parent; parent = parent.parentElement) {
                if (style(parent).visibility === 'hidden' || Number(style(parent).opacity) === 0) return false;
            }
            return true;
        }).map((panel) => ({ ...panel, bounds: panel.node.getBoundingClientRect(),
            opacity: Number(style(panel.node).opacity), radius: parseFloat(style(panel.node).borderTopLeftRadius) || 0 }));
        const geometry = [...targets.values()].map((target) =>
            ({ target, bounds: covers.length ? target.node.getBoundingClientRect() : null }));
        for (const { target, bounds } of geometry) {
            const holes = [];
            for (const cover of covers) {
                if (cover.node === target.node || cover.priority < target.priority
                    || (cover.priority === target.priority && cover.order < target.order)) continue;
                const left = cover.bounds.left - bounds.left - 4;
                const top = cover.bounds.top - bounds.top - 4;
                const right = cover.bounds.right - bounds.left + 4;
                const bottom = cover.bounds.bottom - bounds.top + 4;
                if (right <= -32 || left >= bounds.width + 32 || bottom <= -32 || top >= bounds.height + 32) continue;
                holes.push(`<rect x="${left.toFixed(2)}" y="${top.toFixed(2)}" width="${(right - left).toFixed(2)}" height="${(bottom - top).toFixed(2)}" rx="${cover.radius + 4}" fill="black" opacity="${cover.opacity.toFixed(3)}"/>`);
            }
            if (!holes.length) { write(target, target.original); continue; }
            const width = bounds.width + 64, height = bounds.height + 64;
            const holes_markup = holes.join('');
            const signature = `${width},${height}:${holes_markup}`;
            if (target.signature === signature) continue;
            const area = `x="-32" y="-32" width="${width}" height="${height}"`;
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="-32 -32 ${width} ${height}"><defs><mask id="cut" maskUnits="userSpaceOnUse" ${area} style="mask-type:luminance"><rect ${area} fill="white"/>${holes_markup}</mask></defs><rect ${area} fill="white" mask="url(#cut)"/></svg>`;
            write(target, { maskImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
                maskSize: `${width}px ${height}px`, maskPosition: '-32px -32px', maskRepeat: 'no-repeat', maskClip: 'no-clip' }, signature);
        }
        if (moving) schedule();
    }

    function schedule() { if (!destroyed && !frame) frame = requestAnimationFrame(paint); }
    function animation_event(event) {
        if (!watched.has(event.target) || ('propertyName' in event && !affects_mask(event.propertyName))) return;
        pending_nodes.add(event.target);
        schedule();
    }
    const changes = new MutationObserver((records) => {
        const changed = new Set();
        for (const record of records) {
            if (record.attributeName === 'data-patter-panel') rescan = true;
            if (record.type === 'childList' && [...record.addedNodes, ...record.removedNodes].some((node) =>
                node instanceof Element && !node.matches(excluded)
                && (record.target === document.body || targets.has(node) || node.matches(panel_selector) || node.querySelector(panel_selector)))) rescan = true;
            if (watched.has(record.target)) changed.add(record.target);
        }
        for (const node of changed) {
            const target = targets.get(node);
            if (target?.inline === node.getAttribute('style') && records.every((record) => record.target !== node || record.attributeName === 'style')) continue;
            if (target) target.signature = null;
            pending_nodes.add(node);
            schedule();
        }
        if (rescan) schedule();
    });
    changes.observe(document.body, { subtree: true, childList: true, attributes: true,
        attributeFilter: ['style', 'class', 'hidden', 'inert', 'aria-expanded', 'data-patter-panel'] });
    const animation_events = ['transitionrun', 'transitionend', 'transitioncancel', 'animationstart', 'animationend', 'animationcancel'];
    for (const event of animation_events) document.addEventListener(event, animation_event);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    schedule();
    return () => {
        destroyed = true;
        cancelAnimationFrame(frame);
        sizes.disconnect();
        changes.disconnect();
        animations.clear();
        for (const event of animation_events) document.removeEventListener(event, animation_event);
        window.removeEventListener('resize', schedule);
        window.removeEventListener('scroll', schedule, true);
        for (const target of targets.values()) write(target, target.original);
        targets.clear();
    };
}
