<script>
    import { onMount } from 'svelte';
    import { background_values, backgrounds, defaults, selectBuiltInBackground, selectUploadedBackground } from '$lib/state/background.svelte.js';
    import { clearBackgroundUploads, listBackgroundUploads, replaceBackgroundUpload } from '$lib/state/background-media.js';
    import { createImagePoster, removeBackgroundPoster, saveBackgroundPoster, upgradeImagePoster } from '$lib/state/background-posters.js';
    import BackgroundThumbnail from '$lib/components/backgroundThumbnail.svelte';
    import { backgroundFileAccept, backgroundKindFromFilename } from '$lib/state/background-formats.js';

    let uploadInput;
    let uploadError = $state('');
    let uploads = $state([]);
    let hasUserAction = false;

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
            uploads = [{ ...record, url }];
            if (record.kind === 'image') void upgradeImagePoster(`upload:${record.id}`, record.blob).catch(() => {});
            if (records.length > 1) void replaceBackgroundUpload(record);
            // Keep an uploaded image available as a thumbnail without
            // overriding a built-in background selected before reload.
            if (selectedId && selectedId !== record.id) selectUploadedBackground(record.id, record.kind, url);
        }).catch(() => {});
        return () => {
            cancelled = true;
            window.removeEventListener('patter-clear-saved-data', onClearSavedData);
            for (const record of uploads) URL.revokeObjectURL(record.url);
        };
    });

    function playClick() {
        const audio = new Audio("/type.mp3");
        audio.volume = 0.15;
        audio.play();
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

    function selectPosition(item, position) {
        hasUserAction = true;
        playClick();
        background_values.position = position;
        if (item.uploaded) {
            selectUploadedBackground(item.id, item.kind, item.url);
        } else {
            selectBuiltInBackground(item.src, item.kind);
        }
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
        // Play directly from the file selection gesture, before IndexedDB's async write.
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
            uploads = [{ id, kind, name: file.name, blob: file, url }];
            selectUploadedBackground(id, kind, url);
            uploadError = '';
            if (kind === 'image') {
                createImagePoster(file).then((poster) => {
                    if (poster && background_values.background === `upload:${id}`) {
                        saveBackgroundPoster(`upload:${id}`, poster);
                    }
                }).catch(() => {});
            }
        } catch {
            uploadError = 'This file could not be saved in browser storage.';
        }
    }

    async function removeUpload() {
        hasUserAction = true;
        try {
            await clearBackgroundUploads();
            for (const uploadItem of uploads) {
                URL.revokeObjectURL(uploadItem.url);
                removeBackgroundPoster(`upload:${uploadItem.id}`);
            }
            uploads = [];
            selectBuiltInBackground(defaults.background);
            uploadError = '';
            playClick();
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
            {selected}
            position={background_values.position}
            label="Select built-in background"
            onselect={() => select(item)}
            onposition={(position) => selectPosition(item, position)} />
    {/each}

    {#each uploads as uploadItem (uploadItem.id)}
        <BackgroundThumbnail
            src={uploadItem.url}
            kind={uploadItem.kind}
            selected={background_values.background === `upload:${uploadItem.id}`}
            position={background_values.position}
            label={`Select uploaded background ${uploadItem.name}`}
            onselect={() => selectUpload(uploadItem)}
            onposition={(position) => selectPosition({ ...uploadItem, uploaded: true }, position)} />
    {/each}

    <input
        bind:this={uploadInput}
        class="sr-only"
        type="file"
        accept={backgroundFileAccept}
        onchange={upload}
        aria-label="Upload an image or video background" />
    <div class="col-span-2 grid grid-cols-2 gap-4">
        <button
            type="button"
            onclick={() => uploadInput?.click()}
            class="group transition w-full aspect-video group/inputpill relative cursor-pointer flex flex-col items-center justify-center gap-1 text-mauve-100/65 hover:text-mauve-100 text-xs">
            <span class="absolute inset-0 rounded-lg outline-2 outline-dashed outline-offset-2 outline-mauve-100/20 patter_shadow transition-[inset,border-color] duration-200 group-hover/inputpill:inset-1 group-hover/inputpill:border-mauve-100/45"></span>
            <span class="relative text-xl leading-none" aria-hidden="true">＋</span>
            <span class="relative tracking-wide">Upload</span>
        </button>
        <button
            type="button"
            onclick={removeUpload}
            disabled={uploads.length === 0}
            aria-label="Remove uploaded background"
            class="group transition w-full aspect-video group/inputpill relative cursor-pointer flex flex-col items-center justify-center gap-1 text-mauve-100/65 hover:text-red-100 text-xs disabled:cursor-default disabled:opacity-30 disabled:pointer-events-none">
            <span class="absolute inset-0 rounded-lg outline-2 outline-dashed outline-offset-2 outline-mauve-100/20 patter_shadow transition-[inset,border-color] duration-200 group-hover/inputpill:inset-1 group-hover/inputpill:border-red-200/50"></span>
            <span class="relative text-xl leading-none" aria-hidden="true">−</span>
            <span class="relative tracking-wide">Remove</span>
        </button>
    </div>
</div>
{#if uploadError}<p class="px-2 text-xs text-red-200/80" role="status">{uploadError}</p>{/if}
