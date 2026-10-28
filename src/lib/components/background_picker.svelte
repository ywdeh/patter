<script>
    import { track_event } from '$lib/state/analytics.js';
    import { onMount } from 'svelte';
    import { optimize_background_upload } from '$lib/state/background_upload.js';
    import { fade } from 'svelte/transition';
    import { background_values, backgrounds, defaults, get_background_upload, set_background_upload, selectBuiltInBackground, selectUploadedBackground } from '$lib/state/background_state.svelte.js';
    import { clearBackgroundUploads, replaceBackgroundUpload } from '$lib/state/background_media.js';
    import { createImagePoster, removeBackgroundPoster, saveBackgroundPoster, getBackgroundPoster } from '$lib/state/background_posters.js';
    import BackgroundThumbnail from '$lib/components/background_thumbnail.svelte';
    import { backgroundFileAccept, backgroundKindFromFilename } from '$lib/state/background_formats.js';
    import { playSound } from '$lib/state/sound.js';
    import { motionDuration } from '$lib/state/motion.js';
    import { capture_spread_origin, set_spread_origin } from '$lib/state/background_spread.js';

    let uploadInput;
    let uploadOrigin;
    let processing_upload = $state(false);
    let uploadError = $state('');
    const uploaded_background = $derived(get_background_upload());
    const uploads = $derived(uploaded_background ? [uploaded_background] : []);
    let lastWheelBackgroundChange = -Infinity;
    let { sound = 'paper_turn', compact = false, onpickerchange = () => {} } = $props();

    onMount(() => {
        const clear = () => {
            set_background_upload(null);
            uploadError = '';
        };
        window.addEventListener('patter-clear-saved-data', clear);
        return () => window.removeEventListener('patter-clear-saved-data', clear);
    });

    function playClick(paperVolumeScale = 1) {
        playSound(sound, paperVolumeScale);
        if (sound === 'paper_turn') playSound('click', 0.5);
    }

    function select(item, event) {
        if (background_values.background === item.src) return;
        set_spread_origin(item.src, event);
        playClick();
        selectBuiltInBackground(item.src, item.kind);
        track_event('background_changed', { background: backgroundLabel(item.src).toLowerCase() });
    }

    function selectUpload(item, event) {
        if (background_values.background === `upload:${item.id}`) return;
        set_spread_origin(`upload:${item.id}`, event);
        playClick();
        selectUploadedBackground(item.id, item.kind, item.url);
        track_event('background_changed', { background: `custom_${item.kind}` });
    }

    function selectPosition(item, position, { fromWheel = false, event } = {}) {
        const selectedBackground = item.uploaded ? `upload:${item.id}` : item.src;
        if (background_values.position === position && background_values.background === selectedBackground) return false;
        const changesBackground = background_values.background !== selectedBackground;
        if (fromWheel && changesBackground) {
            const now = performance.now();
            if (now - lastWheelBackgroundChange < motionDuration('standard', 200)) return false;
            lastWheelBackgroundChange = now;
        }
        if (changesBackground) set_spread_origin(selectedBackground, event);
        playClick(0.5);
        background_values.position = position;
        if (item.uploaded) selectUploadedBackground(item.id, item.kind, item.url);
        else selectBuiltInBackground(item.src, item.kind);
        track_event('background_position_changed', { position });
        if (changesBackground) track_event('background_changed', { background: item.uploaded ? `custom_${item.kind}` : backgroundLabel(item.src).toLowerCase() });
        return true;
    }

    function backgroundLabel(src) {
        return (src.split('/').at(-1) ?? src)
            .replace(/\.[^.]+$/u, '')
            .replace(/[_-]+/gu, ' ')
            .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
    }

    function upload_motion(name, fallback) {
        return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 0 : motionDuration(name, fallback);
    }

    async function upload(event) {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file || processing_upload) return;

        const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
        if (!backgroundFileAccept.split(',').some((entry) => entry === `.${extension}`)) {
            onpickerchange(false);
            uploadError = 'Choose an image or video in a supported format.';
            return;
        }

        playClick();
        processing_upload = true;
        try {
            const optimized = await optimize_background_upload(file);
            const id = crypto.randomUUID();
            const kind = backgroundKindFromFilename(file.name);
            await replaceBackgroundUpload({ id, kind, name: optimized.name, blob: optimized });
            if (uploaded_background) removeBackgroundPoster('upload:' + uploaded_background.id);
            const { url } = set_background_upload({ id, kind, name: optimized.name, blob: optimized, poster: null });
            set_spread_origin(`upload:${id}`, uploadOrigin);
            selectUploadedBackground(id, kind, url);
            track_event('background_uploaded', { type: kind });
            track_event('background_changed', { background: `custom_${kind}` });
            uploadError = '';
            if (kind === 'image') {
                createImagePoster(optimized).then((poster) => {
                    if (poster) {
                        saveBackgroundPoster(`upload:${id}`, poster);
                        if (uploaded_background?.id === id) set_background_upload({ ...uploaded_background, poster });
                    }
                }).catch(() => {});
            }
        } catch {
            onpickerchange(false);
            uploadError = 'This file could not be processed or saved in browser storage.';
        } finally {
            processing_upload = false;
        }
    }

    async function removeUpload(event) {
        const origin = capture_spread_origin(event);
        const upload = uploaded_background;
        if (!upload) return;
        playClick();
        try {
            await clearBackgroundUploads();
            const key = 'upload:' + upload.id;
            const removedActiveBackground = background_values.background === key;
            removeBackgroundPoster(key);
            if (uploaded_background?.id === upload.id) set_background_upload(null);
            track_event('background_removed');
            if (removedActiveBackground) {
                set_spread_origin(defaults.background, origin);
                selectBuiltInBackground(defaults.background);
            }
            uploadError = '';
        } catch {
            uploadError = 'This background could not be removed from browser storage.';
        }
    }
</script>

<div class="background_grid w-full grid grid-cols-2 gap-4 p-2" class:compact>
    {#each backgrounds as item}
        {@const selected = background_values.background === item.src}
        <BackgroundThumbnail
            src={item.src}
            kind={item.kind}
            thumbnailSrc={item.thumbnail ?? item.src}
            {selected}
            position={background_values.position}
            label={`Select background ${backgroundLabel(item.src)}`}
            onselect={(event) => select(item, event)}
            onposition={(position, interaction) => selectPosition(item, position, interaction)} />
    {/each}

    <input
        bind:this={uploadInput}
        class="sr-only"
        type="file"
        accept={backgroundFileAccept}
        onchange={upload}
        oncancel={() => onpickerchange(false)}
        tabindex="-1"
        aria-label="Add an image or video background" />
    <div class="upload_controls col-span-2 grid grid-cols-2 gap-4">
        <div class="upload_slot patter_control patter_control_compact relative" aria-busy={processing_upload}>
        {#if uploads.length === 0}
            <span aria-hidden="true" class="pointer-events-none absolute rounded-lg patter_surface_gradient patter_surface_dashed patter_hover patter_active inset-0"></span>
        {/if}
        {#key uploads[0]?.id ?? 'empty'}
        <div class="upload_frame" transition:fade={{ duration: upload_motion('standard', 200) }}>
        {#if uploads.length > 0}
            {#each uploads as uploadItem (uploadItem.id)}
                <BackgroundThumbnail
                    onready={() => onpickerchange(false)}
                    src={uploadItem.url}
                    kind={uploadItem.kind}
                    posterKey={`upload:${uploadItem.id}`}
                    poster={uploadItem.poster}
                    selected={background_values.background === `upload:${uploadItem.id}`}
                    position={background_values.position}
                    label={`Select uploaded background ${uploadItem.name}`}
                    onselect={(event) => selectUpload(uploadItem, event)}
                    onposition={(position, interaction) => selectPosition({ ...uploadItem, uploaded: true }, position, interaction)} />
            {/each}
        {:else}
            <button data-ui-hover-sound="true"
                type="button"
                onclick={(event) => { uploadOrigin = capture_spread_origin(event); onpickerchange(true); uploadInput?.click(); }}
                class="upload_action patter_control patter_control_compact group transition w-full aspect-video group/inputpill relative cursor-pointer flex flex-col items-center justify-center gap-1 text-mauve-100/65 hover:text-mauve-100 transition-colors patter_duration_standard patter_text_small">

                <svg class="patter_icon relative size-5 text-mauve-100" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M5 10h10M10 5v10" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linecap="round"  stroke-linejoin="round" />
                </svg>
                <span class="relative tracking-wide">Add image or video</span>
            </button>
        {/if}
        </div>
        {/key}
        </div>
        <button data-ui-hover-sound="true"
            type="button"
            onclick={removeUpload}
            disabled={uploads.length === 0}
            aria-label="Remove uploaded background"
            class="upload_action patter_control patter_control_compact group transition w-full aspect-video group/inputpill relative cursor-pointer flex flex-col items-center justify-center gap-1 text-mauve-100/65 hover:text-mauve-100 transition-colors patter_duration_standard patter_text_small disabled:cursor-default  disabled:pointer-events-none">
            <span class="upload_surface patter_surface_dashed patter_hover patter_active absolute inset-0 rounded-lg patter_surface_gradient"></span>
            <svg class="patter_icon relative size-5 text-mauve-100" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 10h10" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linecap="round"  stroke-linejoin="round" />
            </svg>
            <span class="relative tracking-wide">Remove</span>
        </button>
    </div>
</div>
{#if uploadError}<p class="patter_text_small px-2 patter_text_error" role="status">{uploadError}</p>{/if}

<style>
    .upload_slot { display: grid; min-width: 0; aspect-ratio: 16 / 9; }
    .upload_frame { grid-area: 1 / 1; min-width: 0; }
    .upload_frame > button { height: 100%; }
    .compact { gap: var(--patter_space_4); padding: 0; }
    .compact .upload_controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--patter_space_4); }
    .compact .upload_controls > :global([data-background-thumbnail]) { width: 100%; }
    .compact .upload_action { aspect-ratio: 16 / 9; min-height: var(--patter_pill_height); flex-direction: column; width: 100%; min-width: 0; padding: var(--patter_space_3); gap: var(--patter_space_1); }
    .compact .upload_action svg { width: 1.25rem; height: 1.25rem; }
</style>
