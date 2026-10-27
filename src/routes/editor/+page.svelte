<script>
    import { onMount } from 'svelte';
    import EditorBody from '$lib/components/editor/body.svelte';
    const zenModeUiSelectors = ['[data-zen-mode-ui="options"]', '[data-zen-mode-ui="editor-toolbar"]'];
    let zenMode = false;
    const previous_inert = new Map();
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
                if (active) {
                    if (!previous_inert.has(element)) previous_inert.set(element, element.inert);
                    element.inert = true;
                } else if (previous_inert.has(element)) {
                    element.inert = previous_inert.get(element);
                    previous_inert.delete(element);
                }
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

        function handleKeyboardNavigation(event) {
            if (zenMode && (event.key === 'Tab' || event.key === 'Escape')) setZenMode(false);
        }

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

        window.addEventListener('keydown', handleKeyboardNavigation);
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerdown', handlePointerDown, { passive: true });
        return () => {
            window.removeEventListener('patter-editor-content-change', handleContentChange);
            window.removeEventListener('keydown', handleKeyboardNavigation);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerdown', handlePointerDown);
            setZenMode(false);
        };
    });
</script>


<svelte:head>
    <title>{pageTitle}</title>
</svelte:head>

<main aria-label="Editor" class="mobile_editor_shell flex h-dvh w-full flex-col px-3 py-4 sm:px-12 sm:py-12">
    <h1 class="sr-only">Patter editor</h1>
    <div class="w-full h-full max-w-3xl self-center min-h-0" data-editor-container>
        <EditorBody onwriting={handleWriting} sound="typing" />
    </div>
</main>

<style>
    @media (max-width: 639px), (hover: none), (pointer: coarse) {
        .mobile_editor_shell { height: var(--patter_viewport_height, 100dvh); padding-top: max(var(--patter_space_4), env(safe-area-inset-top)); padding-left: max(var(--patter_space_3), env(safe-area-inset-left)); padding-right: max(var(--patter_space_3), env(safe-area-inset-right)); padding-bottom: max(var(--patter_space_4), env(safe-area-inset-bottom)); }
    }
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
