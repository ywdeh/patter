import { motionDuration } from './motion.js';
import { render_markdown_line } from './markdown_render.js';

export function recovery_preview(editor, initial_markdown = true) {
    const scroll = editor.parentElement;
    const host = scroll.parentElement;
    const old_position = host.style.position;
    const old_opacity = scroll.style.opacity;
    const old_transition = scroll.style.transition;
    const layers = new Map();
    let frame = 0;
    let requested = null;
    let current = null;
    let destroyed = false;
    let markdown_enabled = initial_markdown;
    host.style.position = 'relative';

    function duration() {
        return motionDuration(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'standard' : 'slow', 400);
    }
    function remove_layer(text, layer) {
        clearTimeout(layer.removal);
        cancelAnimationFrame(layer.frame);
        layer.node.remove();
        if (layers.get(text) === layer) layers.delete(text);
    }
    function create_layer(text) {
        const node = editor.cloneNode(false);
        for (const attribute of ['data-patter-body', 'data-empty', 'data-placeholder', 'aria-placeholder', 'id', 'tabindex']) node.removeAttribute(attribute);
        node.setAttribute('contenteditable', 'false');
        node.setAttribute('role', 'region');
        node.setAttribute('aria-label', 'Snapshot preview');
        const style = getComputedStyle(editor);
        Object.assign(node.style, {
            position: 'absolute', inset: '0', minHeight: '0', height: '100%', width: '100%',
            overflowY: 'hidden', paddingBottom: style.paddingTop, pointerEvents: 'none',
            fontFamily: style.fontFamily, fontSize: style.fontSize,
            opacity: 'var(--patter_opacity_placeholder, 0.4)'
        });
        const content = document.createElement('div');
        Object.assign(content.style, {
            display: 'flex', flexDirection: 'column', gap: style.gap, minWidth: '0',
            opacity: '0', transition: `opacity ${duration()}ms ease-out`
        });
        const fragment = document.createDocumentFragment();
        text.split('\n').forEach((line, index) => fragment.append(render_markdown_line(line, index, markdown_enabled)));
        content.append(fragment);
        node.append(content);
        host.append(node);
        const layer = { node, content, removal: 0, frame: 0 };
        layers.set(text, layer);
        return layer;
    }
    function apply(text) {
        if (destroyed || text === current) return;
        current = text;
        scroll.style.transition = `opacity ${duration()}ms ease-out`;
        scroll.style.opacity = text === null ? old_opacity || '1' : '0';
        for (const [key, layer] of layers) {
            if (key === text) continue;
            cancelAnimationFrame(layer.frame);
            layer.content.style.opacity = '0';
            layer.node.setAttribute('aria-hidden', 'true');
            if (!layer.removal) layer.removal = setTimeout(() => remove_layer(key, layer), duration());
        }
        if (text === null) return;
        const layer = layers.get(text) ?? create_layer(text);
        clearTimeout(layer.removal);
        layer.removal = 0;
        layer.node.removeAttribute('aria-hidden');
        cancelAnimationFrame(layer.frame);
        layer.frame = requestAnimationFrame(() => {
            layer.frame = 0;
            layer.content.style.opacity = '1';
        });
    }
    function preview(event) {
        requested = typeof event.detail?.text === 'string' ? event.detail.text : null;
        if (!frame) frame = requestAnimationFrame(() => { frame = 0; apply(requested); });
    }
    function clear_immediately() {
        cancelAnimationFrame(frame);
        frame = 0;
        requested = null;
        current = null;
        for (const [text, layer] of layers) remove_layer(text, layer);
        scroll.style.transition = old_transition;
        scroll.style.opacity = old_opacity;
    }
    function document_replaced() {
        cancelAnimationFrame(frame);
        frame = 0;
        requested = null;
        apply(null);
    }
    window.addEventListener('patter-preview-snapshot', preview);
    scroll.addEventListener('pointerdown', clear_immediately);
    editor.addEventListener('beforeinput', clear_immediately);
    editor.addEventListener('patter-document-replaced', document_replaced);
    return { update(enabled) {
        if (enabled === markdown_enabled) return;
        markdown_enabled = enabled;
        const text = requested;
        clear_immediately();
        requested = text;
        apply(text);
    }, destroy() {
        destroyed = true;
        window.removeEventListener('patter-preview-snapshot', preview);
        scroll.removeEventListener('pointerdown', clear_immediately);
        editor.removeEventListener('beforeinput', clear_immediately);
        editor.removeEventListener('patter-document-replaced', document_replaced);
        clear_immediately();
        host.style.position = old_position;
    } };
}
