<script>
    import { onMount } from 'svelte';
    import { countEditorText, estimateReadingTime } from '$lib/state/editor_counts.js';
    import { setEditorDocument } from '$lib/state/editor_document.js';
    import { background_values } from '$lib/state/background_state.svelte.js';
    import { getEditorPlaceholder } from '$lib/state/editor_placeholders.js';
    import { playSound } from '$lib/state/sound.js';
    import { motionDuration } from '$lib/state/motion.js';
    import { getCaretRect, mountCustomCaret } from '$lib/state/editor_caret.js';
    import EditorToolbar from './editor_toolbar.svelte';
    import MarkdownEditor from './markdown_editor.svelte';

    let { onwriting = () => {}, sound = 'typing' } = $props();
    const placeholder = $derived(getEditorPlaceholder(background_values.background));
    const STORAGE_KEY = 'patter-doc';
    let markdownEditor = $state();
    let bodyEl;
    let scrollEl;
    let unmountCustomCaret = () => {};
    let caretScrollFrame = 0;
    let caretScrollTarget = 0;
    let typewriterDimTimer = 0;
    let counts_worker;
    let counts_worker_failed = false;
    let counts_timer = 0;
    let counts_version = 0;
    let latest_counts_text = '';
    let save_timer = 0;
    let pending_save_text = null;
    let wordCount = $state(0);
    let characterCount = $state(0);
    let sessionTime = $state('0m');
    let readingTime = $state('0m');
    let saveUnavailable = $state(false);
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

    function save(text = markdownEditor?.getSource() ?? '') {
        clearTimeout(save_timer);
        save_timer = 0;
        pending_save_text = null;
        setEditorDocument(text);
        try {
            if (text.trim()) localStorage.setItem(STORAGE_KEY, JSON.stringify({ text }));
            else localStorage.removeItem(STORAGE_KEY);
            if (saveUnavailable) saveUnavailable = false;
        } catch {
            saveUnavailable = true;
        }
    }

    function flush_pending_save() {
        if (pending_save_text !== null) save(pending_save_text);
    }

    function schedule_save(text) {
        setEditorDocument(text);
        pending_save_text = text;
        if (!save_timer) save_timer = window.setTimeout(flush_pending_save, motionDuration('short', 150));
    }

    function updateEmpty(text = markdownEditor?.getSource() ?? '') {
        if (!bodyEl) return;
        bodyEl.dataset.empty = String(text.trim() === '');
    }

    function apply_counts(counts) {
        wordCount = counts.words;
        characterCount = counts.characters;
        readingTime = estimateReadingTime(counts.words);
    }

    function updateCounts(bodyText = markdownEditor?.getVisibleText() ?? '') {
        if (!bodyEl) return;
        latest_counts_text = bodyText;
        const version = ++counts_version;
        clearTimeout(counts_timer);
        if (bodyText.length < 20000 || counts_worker_failed || typeof Worker === 'undefined') {
            apply_counts(countEditorText(bodyText));
        } else {
            counts_timer = window.setTimeout(() => {
                try {
                    if (!counts_worker) {
                        counts_worker = new Worker(new URL('../../state/editor_counts_worker.js', import.meta.url), { type: 'module' });
                        counts_worker.onmessage = ({ data }) => {
                            if (data.version === counts_version) apply_counts(data.counts);
                        };
                        counts_worker.onerror = () => {
                            counts_worker_failed = true;
                            counts_worker?.terminate();
                            counts_worker = null;
                            apply_counts(countEditorText(latest_counts_text));
                        };
                    }
                    counts_worker.postMessage({ version, text: bodyText });
                } catch {
                    counts_worker_failed = true;
                    apply_counts(countEditorText(bodyText));
                }
            }, motionDuration('short', 150));
        }
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
        }, motionDuration('standard', 200));
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
        if (isSoundedEditorKey(event)) playSound(sound);
    }

    function handleInput(bodyText) {
        onwriting();
        updateEmpty(bodyText);
        updateCounts(markdownEditor.getVisibleText());
        schedule_save(bodyText);
        scheduleCaretScroll();
    }

    function replaceDocument(text) {
        if (!bodyEl) return;
        const bodyText = String(text ?? '').replace(/\r\n?/gu, '\n');
        markdownEditor.setSource(bodyText);
        save(bodyText);
        updateEmpty(bodyText);
        updateCounts(markdownEditor.getVisibleText());
    }

    onMount(() => {
        const initialText = load();
        bodyEl = markdownEditor.getElement();
        markdownEditor.setSource(initialText);
        bodyEl.dataset.empty = 'true';
        updateEmpty(initialText);
        updateCounts(markdownEditor.getVisibleText());
        save(initialText);
        unmountCustomCaret = mountCustomCaret(scrollEl, bodyEl);
        updateTypewriterPadding();
        const typewriterResizeObserver = new ResizeObserver(updateTypewriterPadding);
        typewriterResizeObserver.observe(scrollEl);
        typewriterResizeObserver.observe(bodyEl);

        let sessionTimer;
        let autofocusFrame = 0;
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
        const flush_when_hidden = () => {
            if (document.visibilityState === 'hidden') flush_pending_save();
        };
        window.addEventListener('pagehide', flush_pending_save);
        document.addEventListener('visibilitychange', flush_when_hidden);
        scrollEl.addEventListener('wheel', onManualScrollIntent, { passive: true });
        scrollEl.addEventListener('touchstart', onManualScrollIntent, { passive: true });
        window.addEventListener('patter-clear-saved-data', onClearSavedData);
        window.addEventListener('patter-import-document', onImportDocument);

        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            autofocusFrame = requestAnimationFrame(() => {
                autofocusFrame = 0;
                const canTakeFocus = document.activeElement === document.body
                    || document.activeElement === document.documentElement;
                if (!canTakeFocus || !bodyEl?.isConnected) return;

                markdownEditor.setSelectionToEnd();
                bodyEl.focus({ preventScroll: true });
            });
        }

        return () => {
            flush_pending_save();
            clearTimeout(counts_timer);
            counts_worker?.terminate();
            window.removeEventListener('pagehide', flush_pending_save);
            document.removeEventListener('visibilitychange', flush_when_hidden);
            if (autofocusFrame) cancelAnimationFrame(autofocusFrame);
            window.clearTimeout(sessionTimer);
            window.clearTimeout(typewriterDimTimer);
            typewriterResizeObserver.disconnect();
            scrollEl.removeEventListener('wheel', onManualScrollIntent);
            scrollEl.removeEventListener('touchstart', onManualScrollIntent);
            stopCaretScroll();
            unmountCustomCaret();
            window.removeEventListener('patter-clear-saved-data', onClearSavedData);
            window.removeEventListener('patter-import-document', onImportDocument);
        };
    });
</script>

<div class="flex h-full min-h-0 min-w-0 w-full flex-col gap-4 overflow-visible">
    <EditorToolbar />
    <div class="flex min-h-0 min-w-0 w-full flex-1 gap-2 overflow-hidden">
        <div class="hidden h-full w-0.5 shrink-0 bg-linear-to-b from-mauve-100/0 via-mauve-100/4 to-mauve-100/0"></div>
        <div bind:this={scrollEl} class="editor_body_scroll h-full w-full min-h-0 flex-1 patter_font_body overflow-y-scroll scrollbar-thumb-mauve-100/12 scrollbar-thin" style={`--editor-mask: ${hasScrolledDown ? topAndBottomFadeMask : bottomFadeMask}`} onscroll={handleEditorScroll}>
            <MarkdownEditor bind:this={markdownEditor} onchange={handleInput} onkey={handleEditorKeydown} {placeholder} />
        </div>
        <div class="hidden h-full w-0.5 shrink-0 bg-linear-to-b from-mauve-100/0 via-mauve-100/4 to-mauve-100/0"></div>
    </div>
    <div class="flex w-full shrink-0 flex-col items-start gap-2 px-4 patter_text_subtle sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8" data-zen-mode-ui="editor-stats">
        <div class="flex items-center gap-2"><p>{wordCount} {wordCount === 1 ? 'word' : 'words'}</p><p>{characterCount} {characterCount === 1 ? 'character' : 'characters'}</p></div>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div class="flex items-center gap-1"><p>Reading time</p><p>{readingTime}</p></div>
            <div class="flex items-center gap-1"><p>Session time</p><p>{sessionTime}</p></div>
        </div>
    </div>
    {#if saveUnavailable}
        <p class="patter_text_small px-4 text-amber-100/80 sm:px-8" role="status" aria-live="polite">
            {markdownEditor?.getSource().trim()
                ? 'Local saving is unavailable. Export your writing before leaving.'
                : 'Local storage is unavailable. Clearing this draft may not persist.'}
        </p>
    {/if}
</div>

<style>
    .editor_body_scroll {
        position: relative;
        -webkit-mask-image: var(--editor-mask);
        mask-image: var(--editor-mask);
    }
    :global([data-patter-body].typewriter-scrolling) { opacity: 0.8; }
    :global([data-patter-body][data-empty="true"]::before) { content: var(--patter_placeholder_frame, attr(data-placeholder)); position: absolute; inset-inline: 0; padding-inline: inherit; text-align: start; pointer-events: none; opacity: calc(var(--patter_opacity_placeholder, 0.3) * var(--patter_placeholder_ink_opacity, 1)); filter: blur(var(--patter_placeholder_ink_blur, 0px)); }
</style>
