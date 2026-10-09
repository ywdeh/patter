<script>
    import { onMount } from 'svelte';
    import EditorBody from '$lib/components/editor/body.svelte';
    import OptionsBar from '$lib/components/options_bar.svelte';

    // Add selectors here as more interface elements should fade during writing.
    const zenModeUiSelectors = ['[data-zen-mode-ui="options"]', '[data-zen-mode-ui="editor-stats"]', '[data-zen-mode-ui="editor-toolbar"]'];
    let zenMode = false;
    let lastPointer = null;
    let pointerOrigin = null;

    function setZenMode(active) {
        zenMode = active;
        for (const selector of zenModeUiSelectors) {
            document.querySelectorAll(selector).forEach((element) => {
                element.classList.toggle('zen-mode-hidden', active);
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
            window.removeEventListener('pointermove', handlePointerMove);
            setZenMode(false);
        };
    });
</script>

<OptionsBar />

<div class="flex h-dvh w-screen flex-col px-12 py-12">
    <div class="w-full h-full max-w-3xl self-center min-h-0" data-editor-container>
        <EditorBody onwriting={handleWriting} />
    </div>
</div>

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
