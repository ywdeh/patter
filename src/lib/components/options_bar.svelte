

<script>
    import InputPill from "./input_pill.svelte";
    import { background_values, persistBackgroundValues, defaults, resetBackgroundValues } from "$lib/state/background_state.svelte.js";
    import { enterFullscreen, exitFullscreen } from "$lib/fullscreen.js";
    import { getSoundEnabled, setSoundEnabled } from "$lib/state/sound_settings.svelte.js";
    import BackgroundPicker from "./background_picker.svelte";
    import { clearBackgroundUploads } from '$lib/state/background_media.js';
    import { onMount, tick } from 'svelte';
    import HoldButton from './hold_button.svelte';

    const tintLabels = { 0: 'None' };
    const grainLabels = { 0: 'None', 1: 'Subtle', 2: 'Gentle', 3: 'Noticeable', 4: 'Strong' };

    let isFullscreen = $state(false);
    let isSoundEnabled = $state(true);
    $effect(() => {
        const sync = () => (isFullscreen = !!document.fullscreenElement);
        sync();
        document.addEventListener("fullscreenchange", sync);
        return () => document.removeEventListener("fullscreenchange", sync);
    });

    let optionsScrollEl;
    let optionsHasOverflow = $state(false);
    let optionsScrolledDown = $state(false);
    const optionsBottomFade = 'linear-gradient(to bottom, #000 0, #000 calc(100% - 5rem), transparent 100%)';
    const optionsTopAndBottomFade = 'linear-gradient(to bottom, transparent 0, #000 2rem, #000 calc(100% - 2rem), transparent 100%)';
    const optionsMask = $derived(!optionsHasOverflow
        ? 'none'
        : optionsScrolledDown ? optionsTopAndBottomFade : optionsBottomFade);

    function updateOptionsScroll() {
        if (!optionsScrollEl) return;
        optionsHasOverflow = optionsScrollEl.scrollHeight > optionsScrollEl.clientHeight + 1;
        optionsScrolledDown = optionsScrollEl.scrollTop > 0;
    }

    onMount(() => {
        isSoundEnabled = getSoundEnabled();
        updateOptionsScroll();
        const resizeObserver = new ResizeObserver(updateOptionsScroll);
        if (optionsScrollEl) resizeObserver.observe(optionsScrollEl);
        window.addEventListener('resize', updateOptionsScroll);
        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateOptionsScroll);
        };
    });

    async function clearSavedData() {
        isSoundEnabled = true;
        setSoundEnabled(true);
        resetBackgroundValues();
        window.dispatchEvent(new Event('patter-clear-saved-data'));
        try {
            await clearBackgroundUploads();
        } catch (error) {
            console.error('Could not clear uploaded backgrounds', error);
        }
        await tick();
        localStorage.clear();
    }
</script>

<div class="
z-55 patter_unselectable isolate group/tools patter_options_motion transition ease-in-out absolute right-0 top-0 hidden h-dvh max-w-[calc(100vw-3rem)] items-center justify-center p-6 sm:flex
    translate-x-[50%] hover:translate-x-0 focus-within:translate-x-0  saturate-0 focus-within:saturate-100 hover:saturate-100"
    role="group"
    aria-label="Options bar"
    data-zen-mode-ui="options"
    ondragstart={(event) => event.preventDefault()}>
    <div bind:this={optionsScrollEl} onscroll={updateOptionsScroll} style={`-webkit-mask-image: ${optionsMask}; mask-image: ${optionsMask}`} class="relative z-10 flex min-h-0 max-h-[calc(100dvh-3rem)] max-w-full flex-col gap-12 justify-start overflow-x-hidden overflow-y-auto overscroll-contain p-1 scrollbar-thin scrollbar-thumb-mauve-100/12">
        <div class="flex min-w-0 max-w-full shrink-0 flex-col items-end gap-6">
            <InputPill text="Fullscreen" mode="toggle" bind:value={isFullscreen} ontrue={enterFullscreen} onfalse={exitFullscreen} />
            <InputPill text="Sound" mode="toggle" bind:value={isSoundEnabled} sound={isSoundEnabled ? 'tap' : null} ontrue={() => setSoundEnabled(true)} onfalse={() => setSoundEnabled(false)} />
            <div class="h-0.5 w-full bg-linear-to-r from-mauve-100/0 via-mauve-100/12 to-mauve-100/0"></div>
            <BackgroundPicker />
            <InputPill text="Focus" min={0} max={15} step={1} bind:value={background_values.focus} defaultValue={defaults.focus} onchange={(value) => persistBackgroundValues({ focus: value })} />
            <InputPill text="Tint" min={0} max={80} step={5} bind:value={background_values.tint} defaultValue={defaults.tint} displayValues={tintLabels} unit="%" onchange={(value) => persistBackgroundValues({ tint: value })} />
            <InputPill text="Grain" min={0} max={4} step={1} bind:value={background_values.grain} defaultValue={defaults.grain} displayValues={grainLabels} onchange={(value) => persistBackgroundValues({ grain: value })} />
            <InputPill text="Text size" min={14} max={24} step={1} bind:value={background_values.textSize} defaultValue={defaults.textSize} onchange={(value) => persistBackgroundValues({ textSize: value })} />
            <div class="h-0.5 w-full bg-linear-to-r from-mauve-100/0 via-mauve-100/12 to-mauve-100/0"></div>
            <div class="flex w-full flex-col gap-4">
                <div class="flex w-full justify-end min-w-0 flex-wrap gap-4">
                    <HoldButton text="Reset everything" oncomplete={clearSavedData} />
                </div>
            </div>
        </div>
    </div>
</div>
