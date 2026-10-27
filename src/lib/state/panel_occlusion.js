export function mount_panel_occlusion() {
    const panel_selector = '[data-patter-panel]';
    const targets = new Map();
    const written_styles = new WeakMap();
    let panels = [];
    let frame = 0;
    let rescan = true;
    const sizes = new ResizeObserver(() => schedule());

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
    function moving() {
        const checked = new Set();
        for (const panel of panels) for (let node = panel; node; node = node.parentElement) {
            if (checked.has(node)) continue;
            checked.add(node);
            if (node.getAnimations().some((animation) => animation.playState === 'running')) return true;
        }
        return false;
    }
    function paint() {
        frame = 0;
        if (rescan) collect();
        const style_cache = new Map();
        const styles = (node) => {
            if (!style_cache.has(node)) style_cache.set(node, getComputedStyle(node));
            return style_cache.get(node);
        };
        const covers = panels.filter((node) => visible(node, styles)).map((node) => {
            const style = styles(node);
            return { node, order: panels.indexOf(node), priority: Number(node.dataset.patterPanel) || 0, bounds: node.getBoundingClientRect(), opacity: Number(style.opacity), radius: parseFloat(style.borderTopLeftRadius) || 0 };
        });
        const geometry = [...targets].map(([node, original]) => ({ node, original, bounds: covers.length ? node.getBoundingClientRect() : null }));
        for (const { node, original, bounds } of geometry) {
            if (!covers.length) { write(node, original); continue; }
            const own_order = panels.indexOf(node);
            const own_priority = node.matches(panel_selector) ? Number(node.dataset.patterPanel) || 0 : -Infinity;
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
            if (!holes.length) { write(node, original); continue; }
            const width = bounds.width + padding * 2, height = bounds.height + padding * 2;
            const area = `x="-${padding}" y="-${padding}" width="${width}" height="${height}"`;
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="-${padding} -${padding} ${width} ${height}"><defs><mask id="cut" maskUnits="userSpaceOnUse" ${area} style="mask-type:luminance"><rect ${area} fill="white"/>${holes.join('')}</mask></defs><rect ${area} fill="white" mask="url(#cut)"/></svg>`;
            write(node, {
                maskImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
                maskSize: `${width}px ${height}px`,
                maskPosition: `-${padding}px -${padding}px`,
                maskRepeat: 'no-repeat', maskClip: 'no-clip'
            });
        }
        if (moving()) schedule();
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(paint); }
    const changes = new MutationObserver((records) => {
        let relevant = false;
        for (const record of records) {
            if (record.type === 'attributes' && record.attributeName === 'style' && written_styles.get(record.target) === record.target.getAttribute('style')) continue;
            if (record.attributeName === 'data-patter-panel') rescan = true;
            if (record.type === 'childList') {
                const structural = [...record.addedNodes, ...record.removedNodes].some((node) =>
                    node instanceof Element && (node.matches(panel_selector) || node.querySelector(panel_selector) || targets.has(node)));
                if (structural || record.target === document.body) rescan = true;
            }
            relevant = true;
        }
        if (relevant) schedule();
    });
    changes.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'inert', 'aria-expanded', 'data-patter-panel'] });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    document.addEventListener('transitionrun', schedule);
    document.addEventListener('animationstart', schedule);
    schedule();
    return () => {
        changes.disconnect();
        sizes.disconnect();
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', schedule);
        window.removeEventListener('scroll', schedule, true);
        document.removeEventListener('transitionrun', schedule);
        document.removeEventListener('animationstart', schedule);
        for (const [node, original] of targets) write(node, original);
        targets.clear();
    };
}
