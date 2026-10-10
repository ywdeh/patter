<script>
    import { onMount } from 'svelte';
    import EditorBody from '$lib/components/editor/body.svelte';
    import OptionsBar from '$lib/components/options_bar.svelte';
    const zenModeUiSelectors = ['[data-zen-mode-ui="options"]', '[data-zen-mode-ui="editor-toolbar"]'];
    let zenMode = false;
    let lastPointer = null;
    let pointerOrigin = null;
    let pageTitle = $state('Patter');

    function updatePageTitle(text = '') {
        const normalized = String(text).replace(/\s+/gu, ' ').trim();
        if (!normalized) {
            pageTitle = 'Patter';
            return;
        }
        const symbols = typeof Intl.Segmenter === 'function'
            ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(normalized), (part) => part.segment)
            : Array.from(normalized);
        pageTitle = `Patter - ${symbols.slice(0, 16).join('')}${symbols.length > 16 ? '…' : ''}`;
    }

    function setZenMode(active) {
        zenMode = active;
        for (const selector of zenModeUiSelectors) {
            document.querySelectorAll(selector).forEach((element) => {
                element.classList.toggle('zen-mode-hidden', active);
                element.inert = active;
            });
        }
        if (!active) pointerOrigin = null;
    }

    function handleWriting() {
        if (zenMode) return;
        pointerOrigin = lastPointer;
        setZenMode(true);
    }

    onMount(() => {
        const handleContentChange = (event) => updatePageTitle(event.detail?.text ?? '');
        window.addEventListener('patter-editor-content-change', handleContentChange);

        function handlePointerMove(event) {
            if (event.pointerType !== 'mouse') return;
            const position = { x: event.clientX, y: event.clientY };
            if (zenMode) {
                if (!pointerOrigin) pointerOrigin = position;
                else if (Math.hypot(position.x - pointerOrigin.x, position.y - pointerOrigin.y) >= 20) {
                    setZenMode(false);
                }
            }
            lastPointer = position;
        }

        window.addEventListener('pointermove', handlePointerMove);
        return () => {
            window.removeEventListener('patter-editor-content-change', handleContentChange);
            window.removeEventListener('pointermove', handlePointerMove);
            setZenMode(false);
        };
    });
</script>

<OptionsBar />

<svelte:head>
    <title>{pageTitle}</title>
</svelte:head>

<main aria-label="Editor" class="flex h-dvh w-screen flex-col px-3 py-12 sm:px-12">
    <h1 class="sr-only">Patter editor</h1>
    <div class="w-full h-full max-w-3xl self-center min-h-0" data-editor-container>
        <EditorBody onwriting={handleWriting} sound="typing" />
    </div>
</main>

<style>
    :global([data-zen-mode-ui]) {
        transition-duration: var(--patter_motion_slow) !important;
        transition-delay: 0ms !important;
    }

    :global(.zen-mode-hidden) {
        opacity: 0 !important;
        pointer-events: none !important;
    }

</style>
