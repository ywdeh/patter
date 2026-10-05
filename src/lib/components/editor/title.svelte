<script>
    import { onMount } from "svelte";
    import { countEditorText, getEditorText } from '$lib/state/editor-counts.js';
    import { handleSmartPunctuationInput, handleSmartPunctuationKeydown } from '$lib/state/editor-smart-punctuation.js';

    let { onwriting = () => {} } = $props();

    const typeSound = '/type.mp3';
    const STORAGE_KEY = "patter-doc";
    let titleEl;
    let bodyEl;
    let scrollEl;
    let wordCount = $state(0);
    let characterCount = $state(0);
    let sessionTime = $state('0m');

    if (typeof window !== 'undefined') window.patterPrimeDocumentPreview?.();

    const CARET_LINE = 0.45; // keep in sync with pb-[45vh]

    const defaults = {
        title: "",
        body: ""
    };

    // --- typing sound: pooled audio, browser-only ---
    const MAX_VOICES = 4;
    const audioPool = typeof window !== "undefined"
        ? Array.from({ length: MAX_VOICES }, () => {
            const a = new Audio(typeSound);
            a.volume = 0.15;
            return a;
        })
        : [];
    let poolIndex = 0;

    function playType() {
        if (audioPool.length === 0) return;
        const audio = audioPool[poolIndex];
        poolIndex = (poolIndex + 1) % MAX_VOICES;
        audio.currentTime = 0;
        audio.play();
    }

    function load() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? { ...defaults, ...JSON.parse(saved) } : { ...defaults };
        } catch {
            return { ...defaults };
        }
    }

    function save() {
        try {
            const title = normalizeTitle(titleEl.innerText);
            const body = bodyEl.innerHTML;
            const saved = {};
            if (title.trim() !== '') saved.title = title;
            if (getEditorText(bodyEl).trim() !== '') saved.body = body;

            if (Object.keys(saved).length > 0) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch {}
    }

    function normalizeTitle(value) {
        return String(value ?? '').replace(/[\r\n]+/gu, ' ');
    }

    // --- placeholder: toggle data-empty so CSS can show it ---
    function updateEmpty() {
        if (!titleEl || !bodyEl) return;
        titleEl.dataset.empty = titleEl.innerText.trim() === "";
        bodyEl.dataset.empty = bodyEl.innerText.trim() === "";
    }

    function updateCounts() {
        if (!titleEl || !bodyEl) return;
        const counts = countEditorText(titleEl, bodyEl);
        wordCount = counts.words;
        characterCount = counts.characters;
        window.dispatchEvent(new CustomEvent('patter-editor-content-change', {
            detail: { hasContent: titleEl.innerText.trim() !== '' || getEditorText(bodyEl).trim() !== '' }
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
        // ignore the title and anything outside the body
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

    const soundedInputTypes = [
        "insertText",
        "insertParagraph",
        "insertFromPaste",
        "insertLineBreak",
        "deleteContentBackward",
        "deleteContentForward"
    ];

    function handleInput(e) {
        if (handleSmartPunctuationInput(e)) return;
        clearEmptyMarkup(e.currentTarget);
        onwriting();
        if (e.inputType && soundedInputTypes.includes(e.inputType)) {
            playType();
        }
        updateEmpty();
        updateCounts();
        save();
    }

    function handlePaste(e) {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
    }

    function handleTitleKeydown(event) {
        handleSmartPunctuationKeydown(event);
        if (event.key === 'Enter' && !event.isComposing) event.preventDefault();
    }

    function handleTitlePaste(event) {
        event.preventDefault();
        const text = normalizeTitle(event.clipboardData.getData('text/plain'));
        document.execCommand('insertText', false, text);
    }

    onMount(() => {
        // make Enter create <p> instead of <div> in the empty body
        document.execCommand("defaultParagraphSeparator", false, "p");

        const data = load();
        titleEl.innerText = normalizeTitle(data.title);
        bodyEl.innerHTML = data.body;
        clearEmptyMarkup(titleEl);
        clearEmptyMarkup(bodyEl);
        updateEmpty();
        updateCounts();
        document.documentElement.classList.remove('has-patter-doc');
        document.documentElement.style.removeProperty('--patter-saved-title');
        document.documentElement.style.removeProperty('--patter-saved-body');

        const onSelection = () => requestAnimationFrame(keepCaretCentered);
        const onClearSavedData = () => {
            titleEl.replaceChildren();
            bodyEl.replaceChildren();
            updateEmpty();
            updateCounts();
            document.documentElement.classList.remove('has-patter-doc');
            document.documentElement.style.removeProperty('--patter-saved-title');
            document.documentElement.style.removeProperty('--patter-saved-body');
        };
        const onImportDocument = (event) => {
            const importedTitle = normalizeTitle(event.detail?.title ?? '');
            const importedBody = String(event.detail?.body ?? '').replace(/\r\n?/gu, '\n');
            titleEl.replaceChildren(document.createTextNode(importedTitle));
            const bodyNodes = [];
            importedBody.split('\n').forEach((line, index) => {
                if (index > 0) bodyNodes.push(document.createElement('br'));
                if (line) bodyNodes.push(document.createTextNode(line));
            });
            bodyEl.replaceChildren(...bodyNodes);
            clearEmptyMarkup(titleEl);
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
        <div class="flex min-w-0 w-full overflow-hidden font-[Bitter]">
            <div
                bind:this={titleEl}
                contenteditable
                data-patter-title
                data-placeholder="Untitled"
                data-empty="true"
                oninput={handleInput}
                onkeydown={handleTitleKeydown}
                onpaste={handleTitlePaste}
                class="min-w-0 w-full flex-1 overflow-hidden whitespace-nowrap p-8 text-2xl font-medium opacity-90 h-full flex items-center"
            ></div>
        </div>
        <div class="h-0.5 bg-linear-to-l from-mauve-100/0 via-mauve-100/12 to-mauve-100/0"></div>

        <div bind:this={scrollEl} class="editor-body-scroll w-full h-full min-h-0 font-[Bitter] text-lg
        overflow-y-scroll scrollbar-thumb-mauve-100/12 scrollbar-thin">
            <div
                bind:this={bodyEl}
                contenteditable
                data-patter-body
                data-placeholder="Once, there was a glorious kingdom..."
                data-empty="true"
                oninput={handleInput}
                onkeydown={handleSmartPunctuationKeydown}
                onpaste={handlePaste}
                class="flex flex-col gap-2 p-8 pb-[45vh] min-h-full"
            ></div>
        </div>
        <div class="flex gap-6 justify-between items-center w-full bottom-0 p-6 opacity-40 text-xs tracking-wide" data-zen-mode-ui="editor-stats">
            <div class="flex gap-2 items-center">
                <p>{wordCount} {wordCount === 1 ? 'word' : 'words'}</p>
                <p>{characterCount} {characterCount === 1 ? 'character' : 'characters'}</p>
            </div>
            <div class="flex gap-4 items-center">
                <p>Session time</p>
                <p>{sessionTime}</p>
            </div>
        </div>
    </div>
    <div class="h-full w-0.5 shrink-0 bg-linear-to-b from-mauve-100/0 via-mauve-100/4 to-mauve-100/0"></div>
</div>

<style>
    [data-patter-title] {
        -webkit-mask-image: linear-gradient(to right, #000 0, #000 calc(100% - 2.5rem), transparent 100%);
        mask-image: linear-gradient(to right, #000 0, #000 calc(100% - 5rem), transparent 100%);
    }

    .editor-body-scroll {
        -webkit-mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 2.5rem), transparent 100%);
        mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 5rem), transparent 100%);
    }

    :global(html.has-patter-doc [data-patter-title]::before) {
        content: var(--patter-saved-title, "") !important;
        position: static !important;
        opacity: 0.9 !important;
        white-space: pre-wrap !important;
    }

    :global(html.has-patter-doc [data-patter-body]::before) {
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
