<script>
    import { onMount } from 'svelte';
    import EditorBody from '$lib/components/editor/body.svelte';
    const zenModeUiSelectors = ['[data-zen-mode-ui="options"]', '[data-zen-mode-ui="editor-toolbar"]'];
    let zenMode = false;
    let lastPointer = null;
    let pointerOrigin = null;
    let pageTitle = $state('Patter');
    const title_segmenter = typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : null;

    function updatePageTitle(text = '') {
        const normalized = String(text).replace(/\s+/gu, ' ').trim();
        if (!normalized) {
            pageTitle = 'Patter';
            return;
        }
        const symbols = [];
        const segments = title_segmenter ? title_segmenter.segment(normalized) : normalized;
        for (const part of segments) {
            symbols.push(typeof part === 'string' ? part : part.segment);
            if (symbols.length === 17) break;
        }
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
        document.querySelectorAll('[data-zen-mode-ui="editor-stats"]').forEach((element) => {
            element.classList.toggle('zen-mode-dimmed', active);
        });
        document.querySelectorAll('.editor_body_scroll').forEach((element) => {
            element.classList.toggle('zen-mode-placeholder-dimmed', active);
        });
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
                else if (Math.hypot(position.x - pointerOrigin.x, position.y - pointerOrigin.y) >= 60) {
                    setZenMode(false);
                }
            }
            lastPointer = position;
        }

        function handlePointerDown(event) {
            if (zenMode && (event.pointerType === 'touch' || event.pointerType === 'pen')) {
                setZenMode(false);
            }
        }

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerdown', handlePointerDown, { passive: true });
        return () => {
            window.removeEventListener('patter-editor-content-change', handleContentChange);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerdown', handlePointerDown);
            setZenMode(false);
        };
    });
</script>


<svelte:head>
    <title>{pageTitle}</title>
</svelte:head>

<main aria-label="Editor" class="flex h-dvh w-full flex-col px-3 py-4 sm:px-12 sm:py-12">
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

    :global([data-zen-mode-ui="editor-stats"]) {
        transition-property: opacity;
        transition-timing-function: ease;
    }

    :global(.zen-mode-placeholder-dimmed) {
        --patter_opacity_placeholder: calc(var(--patter_opacity_subtle) * 0.5);
    }

    :global([data-zen-mode-ui="editor-stats"].zen-mode-dimmed) {
        opacity: calc(var(--patter_opacity_subtle) * 0.5);
    }

</style>
