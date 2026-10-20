export function cursor_tooltip(node, label) {
    let text = label;
    let tooltip = null;

    function hide() {
        tooltip?.remove();
        tooltip = null;
    }

    function move(event) {
        if (!tooltip) return;
        const margin = 8;
        const offset = 14;
        const bounds = tooltip.getBoundingClientRect();
        const left = Math.max(margin, Math.min(event.clientX + offset, window.innerWidth - bounds.width - margin));
        const below = event.clientY + offset;
        const top = below + bounds.height <= window.innerHeight - margin
            ? below
            : Math.max(margin, event.clientY - bounds.height - offset);
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.visibility = 'visible';
    }

    function show(event) {
        if (event.pointerType !== 'mouse' || !text) return;
        hide();
        tooltip = document.createElement('span');
        tooltip.className = 'patter_cursor_tooltip patter_text_small patter_font_ui patter_shadow_text';
        tooltip.setAttribute('aria-hidden', 'true');
        tooltip.textContent = text;
        tooltip.style.visibility = 'hidden';
        document.body.append(tooltip);
        move(event);
    }

    node.addEventListener('pointerenter', show);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerleave', hide);
    node.addEventListener('pointerdown', hide);
    window.addEventListener('blur', hide);
    window.addEventListener('scroll', hide, true);

    return {
        update(nextLabel) {
            text = nextLabel;
            if (tooltip) tooltip.textContent = text;
        },
        destroy() {
            node.removeEventListener('pointerenter', show);
            node.removeEventListener('pointermove', move);
            node.removeEventListener('pointerleave', hide);
            node.removeEventListener('pointerdown', hide);
            window.removeEventListener('blur', hide);
            window.removeEventListener('scroll', hide, true);
            hide();
        }
    };
}