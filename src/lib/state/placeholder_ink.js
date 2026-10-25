import { getEditorPlaceholder } from './editor_placeholders.js';

// This visual overlay stays outside the editable DOM and never enters the document source.
export function placeholder_ink(node, initial_text) {
    const reduced_motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let target = initial_text;
    let displayed = initial_text;
    let overlay;
    let tree;
    let overlay_bounds;
    let newest = -1;
    const reveals = new Map();
    // Keep the visible quote independent of reactive data-placeholder updates.
    node.style.setProperty('--patter_placeholder_frame', JSON.stringify(displayed));

    function layout() {
        if (!overlay) return;
        overlay_bounds = null;
        const style = getComputedStyle(node, '::before');
        const bounds = node.getBoundingClientRect();
        const parent = overlay.offsetParent;
        if (!parent) return;
        const parent_bounds = parent.getBoundingClientRect();
        Object.assign(overlay.style, {
            left: `${bounds.left - parent_bounds.left + parent.scrollLeft - parent.clientLeft + node.clientLeft}px`,
            top: `${bounds.top - parent_bounds.top + parent.scrollTop - parent.clientTop + node.clientTop}px`,
            width: `${bounds.width - node.clientLeft * 2}px`,
            height: `${bounds.height - node.clientTop * 2}px`,
            fontFamily: style.fontFamily, fontSize: style.fontSize,
            fontWeight: style.fontWeight, fontStyle: style.fontStyle,
            lineHeight: style.lineHeight, fontStretch: style.fontStretch,
            fontFeatureSettings: style.fontFeatureSettings,
            fontVariationSettings: style.fontVariationSettings,
            color: style.color, letterSpacing: style.letterSpacing,
            wordSpacing: style.wordSpacing, textIndent: style.textIndent,
            whiteSpace: style.whiteSpace, overflowWrap: style.overflowWrap,
            textAlign: style.textAlign
        });
    }

    function text_layer(text) {
        const layer = document.createElement('span');
        const style = getComputedStyle(node, '::before');
        Object.assign(layer.style, {
            position: 'absolute', inset: '0', boxSizing: 'border-box',
            paddingTop: style.paddingTop, paddingRight: style.paddingRight,
            paddingBottom: style.paddingBottom, paddingLeft: style.paddingLeft, opacity: 'var(--patter_opacity_placeholder, 0.4)',
            transition: 'opacity var(--patter_motion_slow) ease'
        });
        layer.textContent = text;
        return layer;
    }

    function finish() {
        overlay?.remove();
        overlay = null;
        overlay_bounds = null;
        tree = null;
        reveals.clear();
        displayed = target;
        node.style.setProperty('--patter_placeholder_frame', JSON.stringify(displayed));
    }

    function update(text) {
        target = text;
        if (node.dataset.empty !== 'true' || reduced_motion.matches) finish();
    }

    function on_spread(event) {
        const detail = event.detail;
        if (node.dataset.empty !== 'true' || reduced_motion.matches) {
            if (overlay || displayed !== target) finish();
            return;
        }
        let reveal = reveals.get(detail.sequence);
        if (detail.complete) {
            if (reveal) {
                reveal.incoming.style.removeProperty('clip-path');
                reveal.wrapper.replaceChildren(reveal.incoming);
                reveals.delete(detail.sequence);
            }
            if (detail.latest && detail.sequence >= newest && getEditorPlaceholder(detail.key) === target) finish();
            return;
        }
        if (!reveal) {
            if (detail.sequence <= newest) return;
            newest = detail.sequence;
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.setAttribute('aria-hidden', 'true');
                Object.assign(overlay.style, { position: 'absolute', pointerEvents: 'none', userSelect: 'none' });
                node.after(overlay);
                layout();
                tree = text_layer(displayed);
                overlay.append(tree);
                node.style.setProperty('--patter_placeholder_frame', '\"\"');
            }
            const wrapper = document.createElement('div');
            const outgoing = document.createElement('div');
            const incoming = text_layer(getEditorPlaceholder(detail.key));
            incoming.style.clipPath = 'inset(0 100% 0 0)';
            for (const element of [wrapper, outgoing]) {
                Object.assign(element.style, { position: 'absolute', inset: '0' });
            }
            outgoing.append(tree);
            wrapper.append(outgoing, incoming);
            overlay.replaceChildren(wrapper);
            tree = wrapper;
            reveal = { wrapper, outgoing, incoming };
            reveals.set(detail.sequence, reveal);
        }
        // The overlay does not move during a reveal; avoid forcing layout after each mask write.
        const bounds = overlay_bounds ??= overlay.getBoundingClientRect();
        const points = detail.points.map(([x, y]) => `${(x + detail.left - bounds.left).toFixed(1)}px ${(y + detail.top - bounds.top).toFixed(1)}px`);
        const outer = `0px 0px, ${bounds.width}px 0px, ${bounds.width}px ${bounds.height}px, 0px ${bounds.height}px, 0px 0px`;
        reveal.incoming.style.clipPath = `polygon(${points.join(',')})`;
        reveal.outgoing.style.clipPath = `polygon(evenodd, ${outer}, ${points.join(',')}, ${points[0]}, 0px 0px)`;
    }

    const observer = new MutationObserver(() => {
        if (node.dataset.empty !== 'true') finish();
    });
    observer.observe(node, { attributes: true, attributeFilter: ['data-empty'] });
    const invalidate_bounds = () => { overlay_bounds = null; };
    node.parentElement.addEventListener('scroll', invalidate_bounds, { passive: true });
    window.addEventListener('resize', invalidate_bounds);
    const resize = new ResizeObserver(layout);
    resize.observe(node);
    window.addEventListener('patter-wallpaper-spread', on_spread);
    return {
        update,
        destroy() {
            observer.disconnect();
            resize.disconnect();
            node.parentElement?.removeEventListener('scroll', invalidate_bounds);
            window.removeEventListener('resize', invalidate_bounds);
            window.removeEventListener('patter-wallpaper-spread', on_spread);
            finish();
            node.style.removeProperty('--patter_placeholder_frame');
        }
    };
}
