<script>
    import { onMount } from 'svelte';
    import { countEditorText, estimateReadingTime, getEditorText } from '$lib/state/editor_counts.js';
    import { setEditorDocument } from '$lib/state/editor_document.js';
    import { playTapSound } from '$lib/state/tap_sound.js';
    import { getCaretRect, mountCustomCaret } from '$lib/state/editor_caret.js';
    import EditorToolbar from './editor_toolbar.svelte';

    let { onwriting = () => {} } = $props();
    const STORAGE_KEY = 'patter-doc';
    let bodyEl;
    let scrollEl;
    let unmountCustomCaret = () => {};
    let caretScrollFrame = 0;
    let caretScrollTarget = 0;
    let typewriterDimTimer = 0;
    let wordCount = $state(0);
    let characterCount = $state(0);
    let sessionTime = $state('0m');
    let readingTime = $state('0m');
    let hasScrolledDown = $state(false);
    const bottomFadeMask = 'linear-gradient(to bottom, #000 0, #000 calc(100% - 5rem), transparent 100%)';
    const topAndBottomFadeMask = 'linear-gradient(to bottom, transparent 0, #000 2rem, #000 calc(100% - 2rem), transparent 100%)';
    const CARET_SCROLL_EASING = 0.2;

    function plainTextFromHtml(html) {
        if (!html) return '';
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const blockTags = new Set(['DIV', 'LI', 'P', 'H1', 'H2', 'H3', 'BLOCKQUOTE']);

        function readNode(node) {
            if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? '';
            if (node.nodeType !== Node.ELEMENT_NODE) return '';
            if (node.matches('script, style, iframe, object, embed, video, audio')) return '';
            if (node.nodeName === 'IMG') return node.getAttribute('alt') ?? '';
            if (node.nodeName === 'BR') return '\n';
            const text = Array.from(node.childNodes, readNode).join('');
            return blockTags.has(node.nodeName) ? `${text}\n` : text;
        }

        return Array.from(parsed.body.childNodes, readNode).join('').replace(/\n{3,}/gu, '\n\n');
    }

    function load() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
            if (typeof saved?.text === 'string') return saved.text;
            if (typeof saved?.markdown === 'string') return saved.markdown;
            if (typeof saved?.body === 'string' && saved.body) return plainTextFromHtml(saved.body);
        } catch {}
        return '';
    }

    function save(text = getEditorText(bodyEl)) {
        setEditorDocument(text);
        try {
            if (text.trim()) localStorage.setItem(STORAGE_KEY, JSON.stringify({ text }));
            else localStorage.removeItem(STORAGE_KEY);
        } catch {}
    }

    function updateEmpty() {
        if (!bodyEl) return;
        bodyEl.dataset.empty = String(getEditorText(bodyEl).trim() === '');
    }

    function updateCounts() {
        if (!bodyEl) return;
        const counts = countEditorText(bodyEl);
        const bodyText = getEditorText(bodyEl);
        wordCount = counts.words;
        characterCount = counts.characters;
        readingTime = estimateReadingTime(counts.words);
        window.dispatchEvent(new CustomEvent('patter-editor-content-change', {
            detail: { hasContent: bodyText.trim() !== '', text: bodyText }
        }));
    }

    function formatSessionTime(totalMinutes) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (!hours) return `${minutes}m`;
        return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
    }

    function stopCaretScroll() {
        if (!caretScrollFrame) return;
        cancelAnimationFrame(caretScrollFrame);
        caretScrollFrame = 0;
    }

    function dimTextWhileScrolling() {
        if (!bodyEl) return;
        bodyEl.classList.add('typewriter-scrolling');
        window.clearTimeout(typewriterDimTimer);
        typewriterDimTimer = window.setTimeout(() => {
            bodyEl?.classList.remove('typewriter-scrolling');
            typewriterDimTimer = 0;
        }, 220);
    }

    function getCaretScrollTarget() {
        if (!scrollEl || !bodyEl || document.activeElement !== bodyEl) return null;
        const selection = getSelection();
        if (!selection?.rangeCount || !selection.isCollapsed || !bodyEl.contains(selection.anchorNode)) return null;

        const caretRect = getCaretRect(selection.getRangeAt(0), bodyEl);
        if (!caretRect) return null;
        const viewport = scrollEl.getBoundingClientRect();
        const caretCenter = caretRect.top + caretRect.height / 2;
        const viewportCenter = viewport.top + scrollEl.clientHeight / 2;
        return Math.max(0, Math.min(
            scrollEl.scrollHeight - scrollEl.clientHeight,
            scrollEl.scrollTop + caretCenter - viewportCenter
        ));
    }

    function animateCaretScroll() {
        caretScrollFrame = 0;
        if (!scrollEl) return;

        const maxScroll = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
        caretScrollTarget = Math.max(0, Math.min(maxScroll, caretScrollTarget));
        const distance = caretScrollTarget - scrollEl.scrollTop;
        if (Math.abs(distance) < 0.5) {
            scrollEl.scrollTop = caretScrollTarget;
            return;
        }

        dimTextWhileScrolling();
        scrollEl.scrollTop += distance * CARET_SCROLL_EASING;
        caretScrollFrame = requestAnimationFrame(animateCaretScroll);
    }

    function scheduleCaretScroll() {
        const target = getCaretScrollTarget();
        if (target === null) return;
        caretScrollTarget = target;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            stopCaretScroll();
            scrollEl.scrollTop = target;
        } else if (!caretScrollFrame) {
            caretScrollFrame = requestAnimationFrame(animateCaretScroll);
        }
    }

    function updateTypewriterPadding() {
        if (!scrollEl || !bodyEl) return;
        const bodyStyle = getComputedStyle(bodyEl);
        const fontSize = Number.parseFloat(bodyStyle.fontSize) || 18;
        const lineHeight = Number.parseFloat(bodyStyle.lineHeight) || fontSize * 1.555556;
        const bottomPadding = Math.max(0, scrollEl.clientHeight / 2 - lineHeight / 2);
        bodyEl.style.paddingBottom = `${bottomPadding}px`;
    }

    function handleEditorScroll() {
        hasScrolledDown = scrollEl.scrollTop > 0;
        dimTextWhileScrolling();
    }

    function isSoundedEditorKey(event) {
        if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return false;
        if (event.key === 'Backspace' || event.key === 'Enter' || event.key === ' ') return true;
        return /^[^\p{C}\s]$/u.test(event.key);
    }

    function handleEditorKeydown(event) {
        if (isSoundedEditorKey(event)) playTapSound();
    }

    function dispatchInput(inputType, data = null) {
        bodyEl.dispatchEvent(new InputEvent('input', { bubbles: true, inputType, data }));
    }

    function insertPlainText(text, range = null) {
        if (!bodyEl || !text) return;
        const selection = getSelection();
        const insertionRange = range ?? (selection?.rangeCount ? selection.getRangeAt(0) : null);
        if (!insertionRange || !bodyEl.contains(insertionRange.startContainer)) return;

        insertionRange.deleteContents();
        const textNode = document.createTextNode(text);
        insertionRange.insertNode(textNode);
        insertionRange.setStart(textNode, textNode.length);
        insertionRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(insertionRange);
        bodyEl.focus();
        dispatchInput('insertFromPaste', text);
    }

    function handleEditorPaste(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const clipboard = event.clipboardData;
        const text = clipboard?.getData('text/plain') || plainTextFromHtml(clipboard?.getData('text/html') ?? '');
        insertPlainText(text.replace(/\r\n?/gu, '\n'));
    }

    function handleEditorDrop(event) {
        const transfer = event.dataTransfer;
        if (!transfer) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const html = transfer.getData('text/html');
        const text = transfer.getData('text/plain') || plainTextFromHtml(html);
        const range = document.caretRangeFromPoint?.(event.clientX, event.clientY) ?? null;
        insertPlainText(text.replace(/\r\n?/gu, '\n'), range);
    }

    function handleInput() {
        onwriting();
        updateEmpty();
        updateCounts();
        save();
        scheduleCaretScroll();
    }

    function replaceDocument(text) {
        if (!bodyEl) return;
        bodyEl.textContent = String(text ?? '').replace(/\r\n?/gu, '\n');
        save();
        updateEmpty();
        updateCounts();
    }

    onMount(() => {
        bodyEl.textContent = load();
        bodyEl.dataset.empty = 'true';
        updateEmpty();
        updateCounts();
        save();
        unmountCustomCaret = mountCustomCaret(scrollEl, bodyEl);
        updateTypewriterPadding();
        const typewriterResizeObserver = new ResizeObserver(updateTypewriterPadding);
        typewriterResizeObserver.observe(scrollEl);
        typewriterResizeObserver.observe(bodyEl);

        let sessionTimer;
        const sessionStartedAt = performance.now();
        const updateSessionTime = () => {
            const elapsed = performance.now() - sessionStartedAt;
            sessionTime = formatSessionTime(Math.floor(elapsed / 60000));
            sessionTimer = window.setTimeout(updateSessionTime, 60000 - (elapsed % 60000));
        };
        updateSessionTime();

        const onManualScrollIntent = stopCaretScroll;
        const onClearSavedData = () => replaceDocument('');
        const onImportDocument = (event) => replaceDocument(String(event.detail?.body ?? ''));
        bodyEl.addEventListener('input', handleInput);
        bodyEl.addEventListener('keydown', handleEditorKeydown);
        bodyEl.addEventListener('paste', handleEditorPaste, true);
        bodyEl.addEventListener('drop', handleEditorDrop, true);
        scrollEl.addEventListener('wheel', onManualScrollIntent, { passive: true });
        scrollEl.addEventListener('touchstart', onManualScrollIntent, { passive: true });
        window.addEventListener('patter-clear-saved-data', onClearSavedData);
        window.addEventListener('patter-import-document', onImportDocument);
        return () => {
            window.clearTimeout(sessionTimer);
            window.clearTimeout(typewriterDimTimer);
            typewriterResizeObserver.disconnect();
            scrollEl.removeEventListener('wheel', onManualScrollIntent);
            scrollEl.removeEventListener('touchstart', onManualScrollIntent);
            stopCaretScroll();
            unmountCustomCaret();
            window.removeEventListener('patter-clear-saved-data', onClearSavedData);
            window.removeEventListener('patter-import-document', onImportDocument);
            bodyEl.removeEventListener('input', handleInput);
            bodyEl.removeEventListener('keydown', handleEditorKeydown);
            bodyEl.removeEventListener('paste', handleEditorPaste, true);
            bodyEl.removeEventListener('drop', handleEditorDrop, true);
        };
    });
</script>

<div class="flex h-full min-h-0 min-w-0 w-full flex-col gap-4 overflow-visible">
    <EditorToolbar />
    <div class="flex min-h-0 min-w-0 w-full flex-1 gap-2 overflow-hidden">
        <div class="hidden h-full w-0.5 shrink-0 bg-linear-to-b from-mauve-100/0 via-mauve-100/4 to-mauve-100/0"></div>
        <div bind:this={scrollEl} class="editor_body_scroll h-full w-full min-h-0 flex-1 patter_font_body overflow-y-scroll scrollbar-thumb-mauve-100/12 scrollbar-thin" style={`--editor-mask: ${hasScrolledDown ? topAndBottomFadeMask : bottomFadeMask}`} onscroll={handleEditorScroll}>
            <div
                bind:this={bodyEl}
                data-patter-body
                data-empty="true"
                data-placeholder="Once, there was a glorious kingdom..."
                contenteditable="plaintext-only"
                role="textbox"
                aria-label="Writing area"
                aria-multiline="true"
                aria-placeholder="Once, there was a glorious kingdom..."
                class="block min-h-full p-4 outline-none sm:p-8"
                style="line-height: 1.555556;"
            ></div>
        </div>
        <div class="hidden h-full w-0.5 shrink-0 bg-linear-to-b from-mauve-100/0 via-mauve-100/4 to-mauve-100/0"></div>
    </div>
    <div class="flex w-full shrink-0 items-center justify-between gap-6 px-4 sm:px-8 patter_text_subtle" data-zen-mode-ui="editor-stats">
        <div class="flex items-center gap-2"><p>{wordCount} {wordCount === 1 ? 'word' : 'words'}</p><p>{characterCount} {characterCount === 1 ? 'character' : 'characters'}</p></div>
        <div class="flex items-center gap-4">
            <div class="flex items-center gap-1"><p>Reading time</p><p>{readingTime}</p></div>
            <div class="flex items-center gap-1"><p>Session time</p><p>{sessionTime}</p></div>
        </div>
    </div>
</div>

<style>
    .editor_body_scroll {
        position: relative;
        -webkit-mask-image: var(--editor-mask);
        mask-image: var(--editor-mask);
    }
    :global(.editor_body_scroll [data-patter-body]) {
        font-size: var(--patter_body_text_size, 18px);
        transition: font-size var(--patter_motion_standard) ease, opacity var(--patter_motion_gentle) ease;
        position: relative;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }
    :global([data-patter-body].typewriter-scrolling) { opacity: 0.8; }
    :global([data-patter-body][data-empty="true"]::before) { content: attr(data-placeholder); position: absolute; pointer-events: none; opacity: 0.3; }
</style>
