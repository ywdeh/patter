<script>
    import { onMount } from 'svelte';
    import { Editor, defaultValueCtx, rootCtx } from '@milkdown/kit/core';
    import { commonmark } from '@milkdown/kit/preset/commonmark';
    import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
    import { replaceAll } from '@milkdown/kit/utils';
    import { countEditorText, estimateReadingTime, getEditorText } from '$lib/state/editor_counts.js';
    import { serializeEditorMarkdown } from '$lib/state/editor_markdown.js';
    import { setEditorDocument, getEditorDocument } from '$lib/state/editor_document.js';
    import { smartPunctuation } from '$lib/state/editor_smart_punctuation.js';
    import { playTapSound } from '$lib/state/tap_sound.js';
    import { mountCustomCaret } from '$lib/state/editor_caret.js';
    import EditorToolbar from './editor_toolbar.svelte';

    let { onwriting = () => {} } = $props();
    const STORAGE_KEY = 'patter-doc';
    let hostEl;
    let bodyEl;
    let scrollEl;
    let editor;
    let unmountCustomCaret = () => {};
    let caretScrollFrame = 0;
    let typewriterDimTimer = 0;
    let wordCount = $state(0);
    let characterCount = $state(0);
    let sessionTime = $state('0m');
    let readingTime = $state('0m');
    let hasScrolledDown = $state(false);
    const bottomFadeMask = 'linear-gradient(to bottom, #000 0, #000 calc(100% - 5rem), transparent 100%)';
    const topAndBottomFadeMask = 'linear-gradient(to bottom, transparent 0, #000 2rem, #000 calc(100% - 2rem), transparent 100%)';
    const CARET_CENTER_POSITION = 0.5;
    const CARET_SCROLL_DEAD_ZONE = 2;
    const CARET_SCROLL_EASING = 0.12;

    function load() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
            if (typeof saved?.markdown === 'string') return saved.markdown;
            if (typeof saved?.body === 'string' && saved.body) {
                const legacy = document.createElement('div');
                legacy.innerHTML = saved.body;
                return serializeEditorMarkdown(legacy);
            }
        } catch {}
        return '';
    }

    function save(markdown = getEditorDocument()) {
        setEditorDocument(markdown);
        try {
            if (markdown.trim()) localStorage.setItem(STORAGE_KEY, JSON.stringify({ markdown }));
            else localStorage.removeItem(STORAGE_KEY);
        } catch {}
    }

    function updateEmpty() {
        if (!bodyEl) return;
        const isEmpty = getEditorText(bodyEl).trim() === '';
        bodyEl.dataset.empty = isEmpty;
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

    function getCaretRect(range) {
        const rect = range.getBoundingClientRect();
        if (rect.height > 0) return rect;

        const node = range.startContainer;
        const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        const block = element?.closest('p, h1, h2, h3, li, blockquote, pre');
        return block?.getBoundingClientRect() ?? null;
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

    function scrollCaretDownWhenNeeded() {
        caretScrollFrame = 0;
        const selection = getSelection();
        if (!selection?.rangeCount || !scrollEl || !bodyEl || !selection.isCollapsed) return;
        if (document.activeElement !== bodyEl || !bodyEl.contains(selection.anchorNode)) return;

        const range = selection.getRangeAt(0).cloneRange();
        range.collapse(true);
        const caretRect = getCaretRect(range);
        if (!caretRect) return;

        const box = scrollEl.getBoundingClientRect();
        const centerLine = box.top + scrollEl.clientHeight * CARET_CENTER_POSITION;
        const caretCenter = caretRect.top + caretRect.height / 2;
        if (caretCenter <= centerLine) return;

        const target = Math.max(0, Math.min(
            scrollEl.scrollHeight - scrollEl.clientHeight,
            scrollEl.scrollTop + caretCenter - centerLine
        ));
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            scrollEl.scrollTop = target;
            return;
        }
        const distance = target - scrollEl.scrollTop;
        if (Math.abs(distance) < CARET_SCROLL_DEAD_ZONE) return;
        dimTextWhileScrolling();
        scrollEl.scrollTop += distance * CARET_SCROLL_EASING;
        caretScrollFrame = requestAnimationFrame(scrollCaretDownWhenNeeded);
    }

    function scheduleCaretScroll() {
        if (!caretScrollFrame) caretScrollFrame = requestAnimationFrame(scrollCaretDownWhenNeeded);
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

    function handleEditorKeyup(event) {
        if (event.key === 'Enter') scheduleCaretScroll();
    }

    function handleInput(event) {
        onwriting();
        updateEmpty();
        updateCounts();
        scheduleCaretScroll();
    }

    function replaceDocument(markdown) {
        if (!editor) return;
        editor.action((ctx) => replaceAll(markdown, true)(ctx));
        setEditorDocument(markdown);
        save(markdown);
        updateEmpty();
        updateCounts();
    }

    onMount(() => {
        const initialMarkdown = load();
        let sessionTimer;
        const sessionStartedAt = performance.now();
        const updateSessionTime = () => {
            const elapsed = performance.now() - sessionStartedAt;
            sessionTime = formatSessionTime(Math.floor(elapsed / 60000));
            sessionTimer = window.setTimeout(updateSessionTime, 60000 - (elapsed % 60000));
        };
        updateSessionTime();

        let cancelled = false;
        hostEl.addEventListener('input', handleInput);
        hostEl.addEventListener('keydown', handleEditorKeydown);
        hostEl.addEventListener('keyup', handleEditorKeyup);
        const create = async () => {
            const instance = Editor.make()
                .config((ctx) => {
                    ctx.set(rootCtx, hostEl);
                    ctx.set(defaultValueCtx, initialMarkdown);
                    ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
                        setEditorDocument(markdown);
                        save(markdown);
                        updateEmpty();
                        updateCounts();
                    });
                })
                .use(commonmark)
                .use(smartPunctuation)
                .use(listener);
            await instance.create();
            if (cancelled) {
                await instance.destroy();
                return;
            }
            editor = instance;
            bodyEl = hostEl.querySelector('.ProseMirror');
            if (!bodyEl) return;
            unmountCustomCaret = mountCustomCaret(scrollEl, bodyEl);
            bodyEl.setAttribute('data-patter-body', '');
            bodyEl.setAttribute('role', 'textbox');
            bodyEl.setAttribute('aria-label', 'Writing area');
            bodyEl.setAttribute('aria-multiline', 'true');
            bodyEl.dataset.placeholder = 'Once, there was a glorious kingdom...';
            bodyEl.setAttribute('aria-placeholder', bodyEl.dataset.placeholder);
            bodyEl.dataset.empty = 'true';
            bodyEl.classList.add('flex', 'flex-col', 'gap-2', 'p-8', 'pb-[45vh]', 'min-h-full');
            bodyEl.style.lineHeight = '1.555556';
            updateEmpty();
            updateCounts();
            save(initialMarkdown);
        };
        create();

        const onManualScrollIntent = stopCaretScroll;
        const onClearSavedData = () => replaceDocument('');
        const onImportDocument = (event) => replaceDocument(String(event.detail?.body ?? '').replace(/\r\n?/gu, '\n'));
        scrollEl.addEventListener('wheel', onManualScrollIntent, { passive: true });
        scrollEl.addEventListener('touchstart', onManualScrollIntent, { passive: true });
        window.addEventListener('patter-clear-saved-data', onClearSavedData);
        window.addEventListener('patter-import-document', onImportDocument);
        return () => {
            cancelled = true;
            window.clearTimeout(sessionTimer);
            window.clearTimeout(typewriterDimTimer);
            scrollEl.removeEventListener('wheel', onManualScrollIntent);
            scrollEl.removeEventListener('touchstart', onManualScrollIntent);
            stopCaretScroll();
            unmountCustomCaret();
            window.removeEventListener('patter-clear-saved-data', onClearSavedData);
            window.removeEventListener('patter-import-document', onImportDocument);
            hostEl.removeEventListener('input', handleInput);
            hostEl.removeEventListener('keydown', handleEditorKeydown);
            hostEl.removeEventListener('keyup', handleEditorKeyup);
            editor?.destroy();
        };
    });
</script>

<div class="flex h-full min-h-0 min-w-0 w-full flex-col gap-4 overflow-visible">
    <EditorToolbar />
    <div class="flex min-h-0 min-w-0 w-full flex-1 gap-2 overflow-hidden">
    <div class="hidden h-full w-0.5 shrink-0 bg-linear-to-b from-mauve-100/0 via-mauve-100/4 to-mauve-100/0"></div>
        <div bind:this={scrollEl} class="editor_body_scroll h-full w-full min-h-0 flex-1 patter_font_body overflow-y-scroll scrollbar-thumb-mauve-100/12 scrollbar-thin" style={`--editor-mask: ${hasScrolledDown ? topAndBottomFadeMask : bottomFadeMask}`} onscroll={handleEditorScroll}>
            <div bind:this={hostEl} data-patter-editor-host></div>
        </div>
    <div class="hidden h-full w-0.5 shrink-0 bg-linear-to-b from-mauve-100/0 via-mauve-100/4 to-mauve-100/0"></div>
    </div>
    <div class="flex w-full shrink-0 items-center justify-between gap-6 px-8 patter_text_subtle" data-zen-mode-ui="editor-stats">
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
    :global(.editor_body_scroll::-webkit-scrollbar-button) { display: none; width: 0; height: 0; }
    :global(.editor_body_scroll .ProseMirror) {
        font-size: var(--patter_body_text_size, 18px);
        transition: font-size var(--patter_motion_standard) ease, opacity var(--patter_motion_gentle) ease;
    }
    :global([data-patter-body]) { position: relative; min-height: 100%; outline: none; white-space: pre-wrap; overflow-wrap: anywhere; }
    :global([data-patter-body]) {
        transition: opacity var(--patter_motion_gentle) ease;
    }
    :global([data-patter-body].typewriter-scrolling) { opacity: 0.8; }
    :global([data-patter-body][data-empty="true"]::before) { content: attr(data-placeholder); position: absolute; pointer-events: none; opacity: 0.3; }
    :global([data-patter-body] > *) { margin-block: 0; }
    :global([data-patter-body] h1), :global([data-patter-body] h2), :global([data-patter-body] h3) { font-weight: 700; line-height: 1.25; }
    :global([data-patter-body] h1) { font-size: 1.8em; }
    :global([data-patter-body] h2) { font-size: 1.5em; }
    :global([data-patter-body] h3) { font-size: 1.25em; }
    :global([data-patter-body] ul) { list-style: disc; padding-inline-start: 1.5em; }
    :global(.milkdown) { min-height: 100%; }
</style>
