<script>
    import { onMount } from 'svelte';
    import { background_values, backgrounds, defaults, selectBuiltInBackground, selectUploadedBackground } from '$lib/state/background_state.svelte.js';
    import { clearBackgroundUploads, listBackgroundUploads, replaceBackgroundUpload } from '$lib/state/background_media.js';
    import { createImagePoster, removeBackgroundPoster, saveBackgroundPoster, ensureImagePoster } from '$lib/state/background_posters.js';
    import { getBackgroundPoster } from '$lib/state/background_posters.js';
    import BackgroundThumbnail from '$lib/components/background_thumbnail.svelte';
    import { backgroundFileAccept, backgroundKindFromFilename } from '$lib/state/background_formats.js';
    import { playSound } from '$lib/state/sound.js';
    import { motionDuration } from '$lib/state/motion.js';

    let uploadInput;
    let uploadError = $state('');
    let uploads = $state([]);
    let hasUserAction = false;
    let lastWheelBackgroundChange = -Infinity;
    let { sound = 'paper_turn' } = $props();

    onMount(() => {
        let cancelled = false;
        const onClearSavedData = () => {
            for (const record of uploads) URL.revokeObjectURL(record.url);
            uploads = [];
            uploadError = '';
        };
        window.addEventListener('patter-clear-saved-data', onClearSavedData);
        listBackgroundUploads().then((records) => {
            if (cancelled || hasUserAction) return;
            const selectedId = background_values.background.startsWith('upload:')
                ? background_values.background.slice('upload:'.length)
                : null;
            const record = records.find((item) => item.id === selectedId) ?? records[0];
            if (!record) {
                if (selectedId) selectBuiltInBackground(defaults.background);
                return;
            }
            const url = URL.createObjectURL(record.blob);
            const posterKey = `upload:${record.id}`;
            uploads = [{ ...record, url, poster: getBackgroundPoster(posterKey) }];
            if (record.kind === 'image') {
                void ensureImagePoster(posterKey, record.blob).then(() => {
                    if (cancelled || hasUserAction) return;
                    const poster = getBackgroundPoster(posterKey);
                    if (poster) uploads = uploads.map((item) => item.id === record.id ? { ...item, poster } : item);
                }).catch(() => {});
            }
            if (selectedId && selectedId !== record.id) selectUploadedBackground(record.id, record.kind, url);
        }).catch(() => {});
        return () => {
            cancelled = true;
            window.removeEventListener('patter-clear-saved-data', onClearSavedData);
            for (const record of uploads) URL.revokeObjectURL(record.url);
        };
    });

    function playClick(paperVolumeScale = 1) {
        playSound(sound, paperVolumeScale);
        if (sound === 'paper_turn') playSound('click', 0.5);
    }

    function select(item) {
        if (background_values.background === item.src) return;
        hasUserAction = true;
        playClick();
        selectBuiltInBackground(item.src, item.kind);
    }

    function selectUpload(item) {
        if (background_values.background === `upload:${item.id}`) return;
        hasUserAction = true;
        playClick();
        selectUploadedBackground(item.id, item.kind, item.url);
    }

    function selectPosition(item, position, { fromWheel = false } = {}) {
        const selectedBackground = item.uploaded ? `upload:${item.id}` : item.src;
        if (background_values.position === position && background_values.background === selectedBackground) return false;
        const changesBackground = background_values.background !== selectedBackground;
        if (fromWheel && changesBackground) {
            const now = performance.now();
            if (now - lastWheelBackgroundChange < motionDuration('standard', 200)) return false;
            lastWheelBackgroundChange = now;
        }
        hasUserAction = true;
        playClick(0.5);
        background_values.position = position;
        if (item.uploaded) {
            selectUploadedBackground(item.id, item.kind, item.url);
        } else {
            selectBuiltInBackground(item.src, item.kind);
        }
        return true;
    }

    function backgroundLabel(src) {
        return (src.split('/').at(-1) ?? src)
            .replace(/\.[^.]+$/u, '')
            .replace(/[_-]+/gu, ' ')
            .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
    }

    async function upload(event) {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file) return;

        const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
        if (!backgroundFileAccept.split(',').some((entry) => entry === `.${extension}`)) {
            uploadError = 'Choose an image or video in a supported format.';
            return;
        }

        hasUserAction = true;
        playClick();
        try {
            const id = crypto.randomUUID();
            const kind = backgroundKindFromFilename(file.name);
            await replaceBackgroundUpload({ id, kind, name: file.name, blob: file });
            const url = URL.createObjectURL(file);
            for (const oldUpload of uploads) {
                URL.revokeObjectURL(oldUpload.url);
                removeBackgroundPoster(`upload:${oldUpload.id}`);
            }
            uploads = [{ id, kind, name: file.name, blob: file, url, poster: null }];
            selectUploadedBackground(id, kind, url);
            uploadError = '';
            if (kind === 'image') {
                createImagePoster(file).then((poster) => {
                    if (poster) {
                        saveBackgroundPoster(`upload:${id}`, poster);
                        uploads = uploads.map((item) => item.id === id ? { ...item, poster } : item);
                    }
                }).catch(() => {});
            }
        } catch {
            uploadError = 'This file could not be saved in browser storage.';
        }
    }

    async function removeUpload() {
        if (uploads.length === 0) return;
        hasUserAction = true;
        playClick();
        try {
            await clearBackgroundUploads();
            for (const uploadItem of uploads) {
                URL.revokeObjectURL(uploadItem.url);
                removeBackgroundPoster(`upload:${uploadItem.id}`);
            }
            uploads = [];
            selectBuiltInBackground(defaults.background);
            uploadError = '';
        } catch {
            uploadError = 'This background could not be removed from browser storage.';
        }
    }
</script>

<div class="w-full grid grid-cols-2 gap-4 p-2">
    {#each backgrounds as item}
        {@const selected = background_values.background === item.src}
        <BackgroundThumbnail
            src={item.src}
            kind={item.kind}
            thumbnailSrc={item.thumbnail ?? item.src}
            {selected}
            position={background_values.position}
            label={`Select background ${backgroundLabel(item.src)}`}
            onselect={() => select(item)}
            onposition={(position, interaction) => selectPosition(item, position, interaction)} />
    {/each}

    <input
        bind:this={uploadInput}
        class="sr-only"
        type="file"
        accept={backgroundFileAccept}
        onchange={upload}
        tabindex="-1"
        aria-label="Add an image or video background" />
    <div class="col-span-2 grid grid-cols-2 gap-4">
        {#if uploads.length > 0}
            {#each uploads as uploadItem (uploadItem.id)}
                <BackgroundThumbnail
                    src={uploadItem.url}
                    kind={uploadItem.kind}
                    posterKey={`upload:${uploadItem.id}`}
                    poster={uploadItem.poster}
                    selected={background_values.background === `upload:${uploadItem.id}`}
                    position={background_values.position}
                    label={`Select uploaded background ${uploadItem.name}`}
                    onselect={() => selectUpload(uploadItem)}
                    onposition={(position, interaction) => selectPosition({ ...uploadItem, uploaded: true }, position, interaction)} />
            {/each}
        {:else}
            <button
                type="button"
                onclick={() => uploadInput?.click()}
                class="patter_control patter_control_compact group transition w-full aspect-video group/inputpill relative cursor-pointer flex flex-col items-center justify-center gap-1 text-mauve-100/65 hover:text-mauve-100 patter_text_small">
                <span class="patter_surface_dashed patter_hover patter_active absolute inset-0 rounded-lg bg-linear-to-b from-mauve-100/6 to-mauve-100/0"></span>
                <svg class="relative size-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M5 10h10M10 5v10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
                <span class="relative tracking-wide">Add image or video</span>
            </button>
        {/if}
        <button
            type="button"
            onclick={removeUpload}
            disabled={uploads.length === 0}
            aria-label="Remove uploaded background"
            class="patter_control patter_control_compact group transition w-full aspect-video group/inputpill relative cursor-pointer flex flex-col items-center justify-center gap-1 text-mauve-100/65 hover:text-mauve-100 patter_text_small disabled:cursor-default  disabled:pointer-events-none">
            <span class="patter_surface_dashed patter_hover patter_active absolute inset-0 rounded-lg bg-linear-to-b from-mauve-100/6 to-mauve-100/0"></span>
            <svg class="relative size-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 10h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            <span class="relative tracking-wide">Remove</span>
        </button>
    </div>
</div>
{#if uploadError}<p class="patter_text_small px-2 text-red-200/80" role="status">{uploadError}</p>{/if}
