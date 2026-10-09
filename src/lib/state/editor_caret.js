export const CUSTOM_CARET_ENABLED = true;

const STYLE_ID = 'patter-custom-caret-style';
const CARET_LEFT_PADDING = 4;

function ensureCaretStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        @keyframes patter-caret-blink {
            0%, 48% { opacity: 1; }
            49%, 100% { opacity: 0; }
        }
        .patter-custom-caret {
            position: absolute;
            z-index: 5;
            width: 2px;
            background: currentColor;
            pointer-events: none;
            user-select: none;
            transform: translateX(-1px);
            transition: left var(--patter_motion_quick) ease-out, top var(--patter_motion_quick) ease-out, height var(--patter_motion_quick) ease-out;
            animation: patter-caret-blink 1s steps(1, end) infinite;
            visibility: hidden;
        }
        .patter-custom-caret.patter-custom-caret-snap {
            transition: none !important;
        }
        @media (prefers-reduced-motion: reduce) {
            .patter-custom-caret { transition: none; }
        }
    `;
    document.head.append(style);
}

function rangeCaretRect(selection) {
    if (!selection?.rangeCount || !selection.isCollapsed) return null;
    const range = selection.getRangeAt(0).cloneRange();
    const rect = range.getBoundingClientRect();
    if (rect.height > 0) return rect;

    const node = range.startContainer;
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return element?.closest('p, h1, h2, h3, li, blockquote, pre')?.getBoundingClientRect() ?? null;
}

export function mountCustomCaret(scroller, editor) {
    if (!CUSTOM_CARET_ENABLED || !scroller || !editor) return () => {};

    ensureCaretStyles();
    const caret = document.createElement('div');
    caret.className = 'patter-custom-caret';
    caret.setAttribute('aria-hidden', 'true');
    scroller.append(caret);

    const previousCaretColor = editor.style.caretColor;
    editor.style.caretColor = 'transparent';

    let frame = 0;
    let snapNextUpdate = false;
    let snapReleaseFrame = 0;
    const update = () => {
        frame = 0;
        const snap = snapNextUpdate;
        snapNextUpdate = false;
        if (snap) {
            caret.classList.add('patter-custom-caret-snap');
            if (snapReleaseFrame) cancelAnimationFrame(snapReleaseFrame);
            snapReleaseFrame = requestAnimationFrame(() => {
                snapReleaseFrame = 0;
                caret.classList.remove('patter-custom-caret-snap');
            });
        }
        const selection = window.getSelection();
        const editorHasFocus = document.activeElement === editor || editor.contains(document.activeElement);
        if (!editorHasFocus || !selection?.anchorNode || !editor.contains(selection.anchorNode)) {
            caret.style.visibility = 'hidden';
            return;
        }

        const rect = rangeCaretRect(selection);
        if (!rect) {
            caret.style.visibility = 'hidden';
            return;
        }

        const bounds = scroller.getBoundingClientRect();
        const left = rect.left - bounds.left + scroller.scrollLeft + CARET_LEFT_PADDING;
        const top = rect.top - bounds.top + scroller.scrollTop;
        const positionChanged = Math.abs((Number.parseFloat(caret.style.left) || 0) - left) > 0.5
            || Math.abs((Number.parseFloat(caret.style.top) || 0) - top) > 0.5;
        caret.style.left = `${left}px`;
        caret.style.top = `${top}px`;
        caret.style.height = `${Math.max(1, rect.height)}px`;
        caret.style.visibility = 'visible';
        if (positionChanged) {
            const blink = caret.getAnimations().find((animation) => animation.animationName === 'patter-caret-blink');
            blink?.cancel();
            blink?.play();
        }
    };

    const schedule = (snap = false) => {
        if (snap === true) snapNextUpdate = true;
        if (!frame) frame = requestAnimationFrame(update);
    };
    const updateImmediately = () => {
        snapNextUpdate = true;
        if (frame) {
            cancelAnimationFrame(frame);
            frame = 0;
        }
        update();
    };

    document.addEventListener('selectionchange', schedule);
    editor.addEventListener('focus', schedule);
    editor.addEventListener('blur', schedule);
    editor.addEventListener('input', updateImmediately);
    scroller.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();

    return () => {
        if (frame) cancelAnimationFrame(frame);
        if (snapReleaseFrame) cancelAnimationFrame(snapReleaseFrame);
        document.removeEventListener('selectionchange', schedule);
        editor.removeEventListener('focus', schedule);
        editor.removeEventListener('blur', schedule);
        editor.removeEventListener('input', updateImmediately);
        scroller.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', schedule);
        editor.style.caretColor = previousCaretColor;
        caret.remove();
    };
}
