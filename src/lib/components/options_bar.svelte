<!-- <script>
    import InputPill from "./input_pill.svelte";
    import Button from "./button.svelte";
    import { background_values, persistBackgroundValues } from "$lib/state/background.svelte.js";
	let { has_return = false } = $props();
</script>

<div class="z-55 group/tools transition ease-in-out duration-200 delay-400 hover:delay-50 focus-within:delay-50 absolute flex w-screen items-center justify-center p-6 
    translate-y-[-50%] hover:translate-y-0 focus-within:translate-y-0 opacity-30 hover:opacity-100 focus-within:opacity-100">
    <div class="flex gap-12 flex-wrap justify-end">
        <div class="flex gap-6">
            <InputPill text="Focus" min={5} max={15} step={1} bind:value={background_values.focus} unit="" />
            <InputPill text="Tint" min={20} max={80} step={5} bind:value={background_values.tint} unit="" />
            <InputPill text="Grain" min={0} max={4} step={1} bind:value={background_values.grain} unit="" />
        </div>
        {#if has_return}
            <Button text="Back home" href="/" />
        {/if}
    </div>
</div> -->

<script>
    import InputPill from "./input_pill.svelte";
    import Button from "./button.svelte";
    import { background_values, persistBackgroundValues } from "$lib/state/background.svelte.js";
    import Toggle from "./toggle.svelte";
    import { defaults } from "$lib/state/background.svelte.js";
    import { enterFullscreen, exitFullscreen } from "$lib/fullscreen.js";
    import Colorpill from "./editor/colorpill.svelte";
    import BackgroundPicker from "./backgroundPicker.svelte";
    import { resetBackgroundValues } from '$lib/state/background.svelte.js';
    import { clearBackgroundUploads } from '$lib/state/background-media.js';
    import { onMount, tick } from 'svelte';
    import { editorHasContent, exportEditorDocument } from '$lib/state/editor-export.js';
    import { readTextImport } from '$lib/state/editor-import.js';
    import HoldButton from './hold_button.svelte';

    let isFullscreen = $state(false);
    let hasExportContent = $state(false);
    let importInput;
    let importError = $state('');

    onMount(() => {
        const updateExportState = (event) => {
            hasExportContent = event.detail?.hasContent ?? editorHasContent();
        };
        window.addEventListener('patter-editor-content-change', updateExportState);
        queueMicrotask(() => (hasExportContent = editorHasContent()));
        return () => window.removeEventListener('patter-editor-content-change', updateExportState);
    });

    $effect(() => {
        const sync = () => (isFullscreen = !!document.fullscreenElement);
        sync();
        document.addEventListener("fullscreenchange", sync);
        return () => document.removeEventListener("fullscreenchange", sync);
    });

	let { has_return = false } = $props();

    async function clearSavedData() {
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

    async function importDocument(event) {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file) return;
        try {
            const documentText = await readTextImport(file);
            window.dispatchEvent(new CustomEvent('patter-import-document', { detail: { body: documentText } }));
            importError = '';
        } catch (error) {
            importError = error instanceof Error ? error.message : 'This file could not be imported.';
        }
    }
</script>

<div class="
z-55 group/tools transition ease-in-out duration-200 delay-400 hover:delay-50 focus-within:delay-50 absolute flex h-dvh max-w-[calc(100vw-3rem)] bottom-0 lg:right-0 items-center justify-center p-6 
    translate-y-[50%] hover:translate-y-0 lg:translate-y-0 lg:translate-x-[50%] lg:hover:translate-x-0 focus-within:translate-x-0 opacity-30 hover:opacity-100 focus-within:opacity-100 saturate-0 focus-within:saturate-100 hover:saturate-100"
    data-zen-mode-ui="options">
    <div class="flex min-h-0 max-h-[calc(100dvh-3rem)] max-w-full flex-col gap-12 justify-start overflow-x-hidden overflow-y-auto overscroll-contain p-1 scrollbar-thin scrollbar-thumb-mauve-100/12">
        <div class="flex min-w-0 max-w-full shrink-0 flex-col items-end gap-6">
            <Toggle text="Fullscreen" bind:value={isFullscreen} ontrue={enterFullscreen} onfalse={exitFullscreen} />
            <div class="h-0.5 w-full bg-linear-to-r from-mauve-100/0 via-mauve-100/12 to-mauve-100/0"></div>
            <BackgroundPicker />
            <InputPill text="Focus" min={5} max={15} step={1} bind:value={background_values.focus} defaultValue={defaults.focus} unit="" onchange={(value) => persistBackgroundValues({ focus: value })} />
            <InputPill text="Tint" min={20} max={80} step={5} bind:value={background_values.tint} defaultValue={defaults.tint} unit="" onchange={(value) => persistBackgroundValues({ tint: value })} />
            <InputPill text="Grain" min={0} max={4} step={1} bind:value={background_values.grain} defaultValue={defaults.grain} unit="" onchange={(value) => persistBackgroundValues({ grain: value })} />
            <InputPill text="Text size" min={14} max={24} step={1} bind:value={background_values.textSize} defaultValue={defaults.textSize} unit="" onchange={(value) => persistBackgroundValues({ textSize: value })} />
            {#if has_return}
                <div class="h-0.5 w-full bg-linear-to-r from-mauve-100/0 via-mauve-100/12 to-mauve-100/0"></div>
                <div class="flex w-full flex-col gap-4">
                    <div class="flex w-full min-w-0 flex-wrap gap-4">
                        <Button text="Back home" href="/" />
                        <HoldButton text="Clear saved data" oncomplete={clearSavedData} />
                    </div>
                    <div class="flex w-full min-w-0 flex-wrap gap-4">
                        <Button text="Import .txt" onclick={() => importInput?.click()} />
                        <Button text="Export as .txt" onclick={exportEditorDocument} disabled={!hasExportContent} />
                    </div>
                </div>
                <input bind:this={importInput} class="sr-only" type="file" accept=".txt,text/plain" onchange={importDocument} aria-label="Import a text file" />
                {#if importError}<p class="text-xs text-red-200/80" role="status">{importError}</p>{/if}
            {/if}
        </div>
    </div>
</div>
