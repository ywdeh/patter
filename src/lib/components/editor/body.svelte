<script>
    import { wait_for_page_reveal } from '$lib/state/page_ready.js';
    import { create_editor_autosave } from '$lib/state/editor_autosave.js';
    import { track_writing, mount_editor_time_tracking } from '$lib/state/analytics.js';
    import { schedule_recovery_snapshot, reset_recovery_buffer, cancel_pending_recovery, resume_recovery_snapshots } from '$lib/state/editor_recovery.js';
    import StatValue from './stat_value.svelte';
    import { onMount } from 'svelte';
    import { countEditorText, estimateReadingTime, formatMinutes } from '$lib/state/editor_counts.js';
    import { setEditorDocument } from '$lib/state/editor_document.js';
    import { background_values } from '$lib/state/background_state.svelte.js';
    import EditorToolbar from './editor_toolbar.svelte';
    import { getEditorPlaceholder } from '$lib/state/editor_placeholders.js';
    import { playSound } from '$lib/state/sound.js';
    import { motionDuration } from '$lib/state/motion.js';
    import { getCaretRect, mountCustomCaret } from '$lib/state/editor_caret.js';
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
    let counts_worker;
    let counts_worker_failed = false;
    let counts_version = 0;
    let latest_counts_text = '';
    let last_saved_text = null;
    const autosave = create_editor_autosave((text) => save(text));
    let wordCount = $state(0);
    let characterCount = $state(0);
    let sessionTime = $state('0m');
    let readingTime = $state('0m');
    let selectionCounts = $state(null);
    let selectionFrame = 0;
    let selectionWorker;
    let selectionVersion = 0;
    const shownWords = $derived(selectionCounts?.words ?? wordCount);
    const shownCharacters = $derived(selectionCounts?.characters ?? characterCount);
    const shownReadingTime = $derived(selectionCounts ? estimateReadingTime(selectionCounts.words) : readingTime);

    function updateSelectionCounts() {
        selectionFrame = 0;
        const text = markdownEditor?.getSelectedVisibleText();
        const version = ++selectionVersion;
        if (text === null || text === undefined) { selectionCounts = null; return; }
        if (text.length >= 20000 && typeof Worker !== 'undefined') {
            try {
                if (!selectionWorker) {
                    selectionWorker = new Worker(new URL('../../state/editor_counts_worker.js', import.meta.url), { type: 'module' });
                    selectionWorker.onmessage = ({ data }) => {
                        if (data.version === selectionVersion) selectionCounts = data.counts;
                    };
                    selectionWorker.onerror = () => {
                        selectionWorker?.terminate();
                        selectionWorker = null;
                        const current = markdownEditor?.getSelectedVisibleText();
                        selectionCounts = current == null ? null : countEditorText(current);
                    };
                }
                selectionWorker.postMessage({ version, text });
                return;
            } catch {  }
        }
        selectionCounts = countEditorText(text);
    }

    function scheduleSelectionCounts() {
        if (!selectionFrame) selectionFrame = requestAnimationFrame(updateSelectionCounts);
    }
    let saveUnavailable = $state(false);
    let hasScrolledDown = $state(false);
    const bottomFadeMask = 'linear-gradient(to bottom, #000 0, #000 calc(100% - 5rem), transparent 100%)';
    const topAndBottomFadeMask = 'linear-gradient(to bottom, transparent 0, #000 2rem, #000 calc(100% - 2rem), transparent 100%)';
    const CARET_SCROLL_EASING = 0.2;

    function load() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
            if (typeof saved?.text === 'string') return saved.text;
        } catch {}
        return '';
    }

    function save(text = markdownEditor?.getSource() ?? '') {
        setEditorDocument(text);
        if (text === last_saved_text && !saveUnavailable) return true;
        try {
            if (text.trim()) localStorage.setItem(STORAGE_KEY, JSON.stringify({ text }));
            else localStorage.removeItem(STORAGE_KEY);
            last_saved_text = text;
            if (saveUnavailable) saveUnavailable = false;
            return true;
        } catch {
            saveUnavailable = true;
            return false;
        }
    }

    function flush_pending_save() {
        autosave.flush();
    }

    function schedule_save(text) {
        setEditorDocument(text);
        autosave.schedule(text);
    }

    function updateEmpty(text = markdownEditor?.getSource() ?? '') {
        if (!bodyEl) return;
        const empty = String(text.trim() === '');
        if (bodyEl.dataset.empty !== empty) bodyEl.dataset.empty = empty;
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
        if (bodyText.length < 20000 || counts_worker_failed || typeof Worker === 'undefined') {
            apply_counts(countEditorText(bodyText));
        } else {
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
        }
        window.dispatchEvent(new CustomEvent('patter-editor-content-change', {
            detail: { hasContent: markdownEditor.getSource().trim() !== '', text: bodyText }
        }));
    }

    function stopCaretScroll() {
        if (!caretScrollFrame) return;
        cancelAnimationFrame(caretScrollFrame);
        caretScrollFrame = 0;
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
        track_writing();
        onwriting();
        updateEmpty(bodyText);
        const visible_text = markdownEditor.getVisibleText();
        updateCounts(visible_text);
        schedule_save(bodyText);
        schedule_recovery_snapshot(bodyText, visible_text);
        scheduleCaretScroll();
    }

    function replaceDocument(text, { undoable = false } = {}) {
        if (!bodyEl) return;
        const bodyText = String(text ?? '').replace(/\r\n?/gu, '\n');
        updateEmpty(bodyText);
        markdownEditor.setSource(bodyText, { undoable });
        bodyEl.dispatchEvent(new Event('patter-document-replaced'));
        autosave.cancel();
        if (!save(bodyText)) autosave.schedule(bodyText);
        const visible_text = markdownEditor.getVisibleText();
        reset_recovery_buffer(bodyText, visible_text);
        updateCounts(visible_text);
    }

    onMount(() => {
        const stop_time_tracking = mount_editor_time_tracking();
        const initialText = load();
        setEditorDocument(initialText);
        bodyEl = markdownEditor.getElement();
        markdownEditor.setSource(initialText);
        bodyEl.dataset.empty = 'true';
        updateEmpty(initialText);
        updateCounts(markdownEditor.getVisibleText());
        last_saved_text = initialText;
        reset_recovery_buffer(initialText, markdownEditor.getVisibleText());
        unmountCustomCaret = mountCustomCaret(scrollEl, bodyEl);
        updateTypewriterPadding();
        const typewriterResizeObserver = new ResizeObserver(updateTypewriterPadding);
        typewriterResizeObserver.observe(scrollEl);
        typewriterResizeObserver.observe(bodyEl);

        let sessionTimer;
        let autofocusFrame = 0;
        let autofocus_cancelled = false;
        const sessionStartedAt = performance.now();
        const updateSessionTime = () => {
            const elapsed = performance.now() - sessionStartedAt;
            sessionTime = formatMinutes(Math.floor(elapsed / 60000));
            sessionTimer = window.setTimeout(updateSessionTime, 60000 - (elapsed % 60000));
        };
        updateSessionTime();

        const onManualScrollIntent = stopCaretScroll;
        const onClearSavedData = () => replaceDocument('');
        const onImportDocument = (event) => {
            replaceDocument(String(event.detail?.body ?? ''), { undoable: true });
            bodyEl.focus({ preventScroll: true });
            markdownEditor.setSelectionToEnd();
        };
        const flush_before_leaving = () => {
            flush_pending_save();
            cancel_pending_recovery();
        };
        const flush_when_hidden = () => {
            if (document.visibilityState === 'hidden') {
                flush_pending_save();
                cancel_pending_recovery();
            } else {
                resume_recovery_snapshots();
            }
        };
        document.addEventListener('selectionchange', scheduleSelectionCounts);
        bodyEl.addEventListener('input', scheduleSelectionCounts);
        window.addEventListener('pagehide', flush_before_leaving);
        document.addEventListener('visibilitychange', flush_when_hidden);
        scrollEl.addEventListener('wheel', onManualScrollIntent, { passive: true });
        scrollEl.addEventListener('touchstart', onManualScrollIntent, { passive: true });
        window.addEventListener('patter-clear-saved-data', onClearSavedData);
        window.addEventListener('patter-import-document', onImportDocument);

        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            void wait_for_page_reveal().then(() => {
                if (autofocus_cancelled) return;
                autofocusFrame = requestAnimationFrame(() => {
                    autofocusFrame = 0;
                    const canTakeFocus = document.activeElement === document.body
                        || document.activeElement === document.documentElement;
                    if (!canTakeFocus || !bodyEl?.isConnected) return;

                    markdownEditor.setSelectionToEnd();
                    bodyEl.focus({ preventScroll: true });
                });
            });
        }

        return () => {
            autofocus_cancelled = true;
            cancel_pending_recovery();
            stop_time_tracking();
            flush_pending_save();
            autosave.cancel();
            counts_worker?.terminate();
            selectionWorker?.terminate();
            if (selectionFrame) cancelAnimationFrame(selectionFrame);
            document.removeEventListener('selectionchange', scheduleSelectionCounts);
            bodyEl.removeEventListener('input', scheduleSelectionCounts);
            window.removeEventListener('pagehide', flush_before_leaving);
            document.removeEventListener('visibilitychange', flush_when_hidden);
            if (autofocusFrame) cancelAnimationFrame(autofocusFrame);
            window.clearTimeout(sessionTimer);
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
    <EditorToolbar get_export_text={(format) => markdownEditor.getExportText(format)} />
    <div class="flex min-h-0 min-w-0 w-full flex-1 gap-2 overflow-hidden">
        <div bind:this={scrollEl} class="editor_body_scroll h-full w-full min-h-0 flex-1 patter_font_body overflow-y-auto" style={`--editor-mask: ${hasScrolledDown ? topAndBottomFadeMask : bottomFadeMask}`} onscroll={handleEditorScroll}>
            <MarkdownEditor bind:this={markdownEditor} onchange={handleInput} onrender={() => updateCounts(markdownEditor.getVisibleText())} onkey={handleEditorKeydown} {placeholder} />
        </div>
    </div>
    <div class="editor_stats patter_editor_controls flex w-full shrink-0 flex-col items-start gap-2 px-4 patter_text_small patter_text_muted sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8" data-zen-mode-ui="editor-stats">
        <div class="flex items-center gap-2"><p><StatValue value={shownWords} /> {shownWords === 1 ? 'word' : 'words'}</p><p><StatValue value={shownCharacters} /> {shownCharacters === 1 ? 'character' : 'characters'}</p></div>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div class="flex items-center gap-1"><p>Reading time</p><p><StatValue value={shownReadingTime} /></p></div>
            <div class="flex items-center gap-1"><p>Session time</p><p><StatValue value={sessionTime} /></p></div>
        </div>
    </div>

</div>

<style>
    @media (max-width: 639px), (hover: none), (pointer: coarse) {
        .editor_stats { min-height: 44px; justify-content: center; padding-right: calc(44px + var(--patter_space_8)); }
    }
    .editor_body_scroll {
        position: relative;
        -webkit-mask-image: var(--editor-mask);
        mask-image: var(--editor-mask);
    }
    :global([data-patter-body][data-empty="true"]::before) { content: var(--patter_placeholder_frame, attr(data-placeholder)); position: absolute; top: 0; inset-inline: 0; padding-inline: inherit; padding-top: inherit; text-align: start; pointer-events: none; opacity: var(--patter_opacity_placeholder, 0.4); transition: opacity var(--patter_motion_slow) ease; }
</style>
