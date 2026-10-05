<script>
    import { onMount } from "svelte";
    import { countEditorText, estimateReadingTime, getEditorText } from '$lib/state/editor-counts.js';
    import { handleSmartPunctuationInput, handleSmartPunctuationKeydown } from '$lib/state/editor-smart-punctuation.js';
    import { playTapSound } from '$lib/state/tap-sound.js';

    let { onwriting = () => {} } = $props();

    const STORAGE_KEY = "patter-doc";
    let bodyEl;
    let scrollEl;
    let wordCount = $state(0);
    let characterCount = $state(0);
    let sessionTime = $state('0m');
    let readingTime = $state('0m');

    const CARET_LINE = 0.45; // keep in sync with pb-[45vh]

    function load() {
        try {
            const serialized = localStorage.getItem(STORAGE_KEY);
            if (!serialized) return '';
            const saved = JSON.parse(serialized);
            const body = typeof saved?.body === 'string' ? saved.body : '';
            return body;
        } catch {
            return '';
        }
    }

    function save() {
        try {
            const body = bodyEl.innerHTML;
            if (getEditorText(bodyEl).trim() !== '') {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ body }));
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch {}
    }

    // --- placeholder: toggle data-empty so CSS can show it ---
    function updateEmpty() {
        if (!bodyEl) return;
        bodyEl.dataset.empty = bodyEl.innerText.trim() === "";
    }

    function updateCounts() {
        if (!bodyEl) return;
        const counts = countEditorText(bodyEl);
        wordCount = counts.words;
        characterCount = counts.characters;
        readingTime = estimateReadingTime(counts.words);
        window.dispatchEvent(new CustomEvent('patter-editor-content-change', {
            detail: { hasContent: getEditorText(bodyEl).trim() !== '' }
        }));
    }

    function clearEmptyMarkup(element) {
        if (getEditorText(element).trim() !== '' || element.childNodes.length === 0) return;
        element.replaceChildren();

        if (document.activeElement === element) {
            const range = document.createRange();
            range.selectNodeContents(element);
            range.collapse(true);
            const selection = getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
        }
    }

    function formatSessionTime(totalMinutes) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours === 0) return `${minutes}m`;
        if (minutes === 0) return `${hours}h`;
        return `${hours}h ${minutes}m`;
    }

    // --- typewriter scrolling: keep the caret near the middle ---
    function keepCaretCentered() {
        const sel = getSelection();
        if (!sel?.rangeCount || !scrollEl || !bodyEl) return;
        if (!bodyEl.contains(sel.anchorNode)) return;

        const range = sel.getRangeAt(0).cloneRange();
        range.collapse(true);

        let rect = range.getClientRects()[0];
        if (!rect) {
            // empty line: fall back to the parent element
            const node = range.startContainer;
            const el = node.nodeType === 1 ? node : node.parentElement;
            rect = el.getBoundingClientRect();
        }

        const box = scrollEl.getBoundingClientRect();
        const delta = rect.top - (box.top + box.height * CARET_LINE);

        // only push up when the caret is below the target line
        if (delta > 0) scrollEl.scrollBy({ top: delta });
    }

    function isSoundedEditorKey(event) {
        if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return false;
        if (event.key === 'Backspace' || event.key === 'Enter' || event.key === ' ') return true;
        return /^[^\p{C}\s]$/u.test(event.key);
    }

    function handleEditorKeydown(event) {
        if (isSoundedEditorKey(event)) playTapSound();
        handleSmartPunctuationKeydown(event);
    }

    function handleInput(e) {
        if (handleSmartPunctuationInput(e)) return;
        clearEmptyMarkup(e.currentTarget);
        onwriting();
        updateEmpty();
        updateCounts();
        save();
    }

    function handlePaste(e) {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
    }

    onMount(() => {
        // make Enter create <p> instead of <div> in the empty body
        document.execCommand("defaultParagraphSeparator", false, "p");

        const savedBody = load();
        bodyEl.innerHTML = savedBody;
        clearEmptyMarkup(bodyEl);
        updateEmpty();
        updateCounts();
        save();
        document.documentElement.classList.remove('has-patter-body');
        document.documentElement.style.removeProperty('--patter-saved-body');

        const onSelection = () => requestAnimationFrame(keepCaretCentered);
        const onClearSavedData = () => {
            bodyEl.replaceChildren();
            updateEmpty();
            updateCounts();
            document.documentElement.classList.remove('has-patter-body');
            document.documentElement.style.removeProperty('--patter-saved-body');
        };
        const onImportDocument = (event) => {
            const importedBody = String(event.detail?.body ?? '').replace(/\r\n?/gu, '\n');
            const bodyNodes = [];
            importedBody.split('\n').forEach((line, index) => {
                if (index > 0) bodyNodes.push(document.createElement('br'));
                if (line) bodyNodes.push(document.createTextNode(line));
            });
            bodyEl.replaceChildren(...bodyNodes);
            clearEmptyMarkup(bodyEl);
            updateEmpty();
            updateCounts();
            save();
        };
        const sessionStartedAt = performance.now();
        let sessionTimer;
        const updateSessionTime = () => {
            const elapsed = performance.now() - sessionStartedAt;
            const totalMinutes = Math.floor(elapsed / 60000);
            sessionTime = formatSessionTime(totalMinutes);
            sessionTimer = window.setTimeout(updateSessionTime, 60000 - (elapsed % 60000));
        };
        updateSessionTime();
        document.addEventListener("selectionchange", onSelection);
        window.addEventListener('patter-clear-saved-data', onClearSavedData);
        window.addEventListener('patter-import-document', onImportDocument);
        return () => {
            window.clearTimeout(sessionTimer);
            document.removeEventListener("selectionchange", onSelection);
            window.removeEventListener('patter-clear-saved-data', onClearSavedData);
            window.removeEventListener('patter-import-document', onImportDocument);
        };
    });
</script>

<div class="flex min-w-0 w-full gap-2 overflow-hidden h-full">
    <div class="h-full w-0.5 shrink-0 bg-linear-to-b from-mauve-100/0 via-mauve-100/4 to-mauve-100/0"></div>
    <div class="flex min-w-0 flex-1 flex-col h-full min-h-0 overflow-hidden">
        <div bind:this={scrollEl} class="editor-body-scroll w-full h-full min-h-0 font-[Bitter]
        overflow-y-scroll scrollbar-thumb-mauve-100/12 scrollbar-thin">
            <div
                bind:this={bodyEl}
                contenteditable
                data-patter-body
                data-placeholder="Once, there was a glorious kingdom..."
                data-empty="true"
                oninput={handleInput}
                onkeydown={(event) => handleEditorKeydown(event)}
                onpaste={handlePaste}
                style="font-size: var(--patter-body-text-size, 18px); line-height: 1.555556"
                class="flex flex-col gap-2 p-8 pb-[45vh] min-h-full"
            ></div>
        </div>
        <div class="flex gap-6 justify-between items-center w-full bottom-0 p-6 opacity-40 text-xs tracking-wide" data-zen-mode-ui="editor-stats">
            <div class="flex gap-2 items-center">
                <p>{wordCount} {wordCount === 1 ? 'word' : 'words'}</p>
                <p>{characterCount} {characterCount === 1 ? 'character' : 'characters'}</p>
            </div>
            <div class="flex gap-4 items-center">
                <div class="flex gap-1 items-center">
                    <p>Reading time</p>
                    <p>{readingTime}</p>
                </div>
                <div class="flex gap-1 items-center">
                    <p>Session time</p>
                    <p>{sessionTime}</p>
                </div>
            </div>
        </div>
    </div>
    <div class="h-full w-0.5 shrink-0 bg-linear-to-b from-mauve-100/0 via-mauve-100/4 to-mauve-100/0"></div>
</div>

<style>
    .editor-body-scroll {
        -webkit-mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 2.5rem), transparent 100%);
        mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 5rem), transparent 100%);
    }

    :global(html.has-patter-body [data-patter-body]::before) {
        content: var(--patter-saved-body, "") !important;
        position: static !important;
        opacity: 0.9 !important;
        white-space: pre-wrap !important;
    }

    [contenteditable][data-empty="true"]::before {
        content: attr(data-placeholder);
        position: absolute;
        pointer-events: none;
        opacity: 0.3;
    }
</style>
