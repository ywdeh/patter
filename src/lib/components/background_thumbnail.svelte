<script>
    import { can_use_wheel_controls } from '$lib/state/user_interaction.js';
    import { onMount } from 'svelte';
    import { motionDuration } from '$lib/state/motion.js';
    import { createVideoPoster, getBackgroundPoster, saveBackgroundPoster } from '$lib/state/background_posters.js';

    let {
        src,
        kind = 'image',
        thumbnailSrc = src,
        posterKey = src,
        poster = null,
        selected = false,
        showSurface = true,
        position = 'center',
        label = 'Select background',
        onready = () => {},
        onselect,
        onposition
    } = $props();

    let loaded_source = $state(null);
    let failed_source = $state(null);
    const image_source = $derived(preview_poster ?? thumbnailSrc);
    const thumbnail_loading = $derived(loaded_source !== image_source && failed_source !== image_source);

    const positions = ['top', 'center', 'bottom'];
    let video_preview_active = $state(false);
    let preview_poster = $state(null);
    let preview_video = $state(null);
    let wheelLocked = false;
    let wheelLockTimer = null;
    let prefersReducedMotion = false;

    $effect(() => {
        preview_poster = poster ?? getBackgroundPoster(posterKey);
    });

    onMount(() => {
        const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
        const syncMotionPreference = () => {
            prefersReducedMotion = motionPreference.matches;
            if (prefersReducedMotion) stopVideoPreview();
        };
        syncMotionPreference();
        motionPreference.addEventListener('change', syncMotionPreference);
        if (kind === 'video' && preview_video) preview_video.load();
        return () => {
            motionPreference.removeEventListener('change', syncMotionPreference);
            preview_video?.pause();
        };
    });

    function startVideoPreview() {
        if (kind !== 'video' || prefersReducedMotion) return;
        video_preview_active = true;
        preview_video?.play().catch(() => {});
    }

    function stopVideoPreview() {
        video_preview_active = false;
        preview_video?.pause();
        if (preview_video?.readyState > 0) preview_video.currentTime = 0;
    }

    function captureVideoPoster(event) {
        const poster = createVideoPoster(event.currentTarget);
        if (poster) {
            preview_poster = poster;
            saveBackgroundPoster(posterKey, poster);
        }
        if (!video_preview_active) event.currentTarget.pause();
    }

    function handleWheel(event) {
        if (!can_use_wheel_controls(event)) return;
        event.preventDefault();
        if (wheelLocked || event.deltaY === 0) return;

        const currentIndex = positions.indexOf(position);
        const nextIndex = Math.max(0, Math.min(positions.length - 1, currentIndex + Math.sign(event.deltaY)));
        if (nextIndex === currentIndex) return;

        if (onposition?.(positions[nextIndex], { fromWheel: true, event }) === false) return;
        const focused = document.activeElement;
        const focusedThumbnail = focused?.closest('[data-background-thumbnail]');
        if (focusedThumbnail && focusedThumbnail !== event.currentTarget) focused.blur();
        wheelLocked = true;
        wheelLockTimer = setTimeout(() => {
            wheelLocked = false;
            wheelLockTimer = null;
        }, motionDuration('short', 150));
    }

    function attachNonPassiveWheel(node) {
        node.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            node.removeEventListener('wheel', handleWheel);
            clearTimeout(wheelLockTimer);
        };
    }
</script>

<div data-background-thumbnail aria-busy={thumbnail_loading} role="group" aria-label={label} class="group/inputpill relative w-full aspect-video" onpointerenter={startVideoPreview} onpointerleave={stopVideoPreview} {@attach attachNonPassiveWheel}>
    <button
        type="button"
        draggable="false"
        onclick={onselect}
        aria-label={label}
        aria-pressed={selected}
        class="patter_control patter_control_compact absolute inset-0 w-full cursor-pointer">
        <span
            class="media_viewport absolute inset-0 block rounded-lg bg-center patter_shadow overflow-hidden {selected ? 'is-selected' : ''}">
            {#if thumbnail_loading}
                <span class="thumbnail_loading absolute inset-0 flex items-center justify-center bg-mauve-100/6" role="status" aria-label="Loading background preview">
                    <span class="loading_ring" aria-hidden="true"></span>
                </span>
            {/if}
            {#if kind === 'video'}
                {#if preview_poster || thumbnailSrc !== src}
                    <img
                        class="absolute inset-0 h-full w-full object-cover"
                        draggable="false"
                        src={preview_poster ?? thumbnailSrc}
                        alt=""
                        loading={selected ? 'eager' : 'lazy'}
                        decoding="async"
                        onload={(event) => { loaded_source = event.currentTarget.getAttribute('src'); onready(); }}
                        onerror={(event) => { failed_source = event.currentTarget.getAttribute('src'); onready(); }}
                        aria-hidden="true">
                {:else}
                    <span class="absolute inset-0 bg-mauve-100/5" aria-hidden="true"></span>
                {/if}
                <video
                    bind:this={preview_video}
                    class="absolute inset-0 h-full w-full object-cover transition-opacity patter_duration_short {video_preview_active ? 'opacity-100' : 'opacity-0'}"
                    style="object-position: center center"
                    src={src}
                    muted
                    loop
                    preload="auto"
                    playsinline
                    disablepictureinpicture
                    aria-hidden="true"
                    onloadeddata={captureVideoPoster}></video>
            {:else}
                <img
                    class="absolute inset-0 h-full w-full object-cover"
                    style="object-position: center center"
                    src={preview_poster ?? thumbnailSrc}
                    alt=""
                    loading={selected ? 'eager' : 'lazy'}
                    decoding="async"
                    onload={(event) => { loaded_source = event.currentTarget.getAttribute('src'); onready(); }}
                    onerror={(event) => { failed_source = event.currentTarget.getAttribute('src'); onready(); }}
                    aria-hidden="true">
            {/if}
        </span>
        {#if showSurface}
        <span
        class="patter_surface absolute rounded-lg pointer-events-none
            {selected
                ? 'patter_surface_selected inset-1'
                : 'patter_hover patter_active inset-0'}"></span>
        {/if}
    </button>

    <div
        class="position_picker pointer-events-none absolute right-2 top-2 bottom-2 z-10 grid grid-rows-3 gap-2 opacity-0 transition-opacity patter_duration_standard group-hover/inputpill:opacity-100 group-focus-within/inputpill:opacity-100"
        role="group"
        aria-label="Choose image position">
        {#each positions as choice}
            <button
                type="button"
                onclick={(event) => onposition?.(choice, { event })}
                aria-label={`${label}, align ${choice}`}
                aria-pressed={position === choice}
                class="position_choice pointer-events-auto relative cursor-pointer" class:position_selected={position === choice}
            >

            </button>
        {/each}
    </div>
</div>

<style>
    .position_choice {
        width: 20px;
        min-height: 0;
        cursor: pointer;
        border-radius: 0.25rem;
        background: color-mix(in srgb, var(--patter_color_text) 24%, transparent);
        transition: background-color var(--patter_motion_standard) ease-out,
            outline-color var(--patter_motion_standard) ease-out;
        outline: 2px solid transparent;
        outline-offset: 2px;
    }
    .position_choice:hover { background: color-mix(in srgb, var(--patter_color_text) 40%, transparent); }
    .position_choice.position_selected {
        background: color-mix(in srgb, var(--patter_color_text) 40%, transparent);
        outline-color: color-mix(in srgb, var(--patter_color_text) 55%, transparent);
    }
    .loading_ring {
        width: 1rem;
        height: 1rem;
        border: 2px solid color-mix(in srgb, var(--patter_color_text) 12%, transparent);
        border-top-color: color-mix(in srgb, var(--patter_color_text) 40%, transparent);
        border-radius: 50%;
        animation: preview_loading calc(var(--patter_motion_slow) * 2) linear infinite;
    }
    @keyframes preview_loading { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .loading_ring { animation: none; } }

    .media_viewport {
        clip-path: inset(0 round 0.5rem);
        transition: clip-path var(--patter_motion_standard) ease-out;
    }

    button:hover .media_viewport,
    button:focus-visible .media_viewport {
        clip-path: inset(0.25rem round 0.5rem);
    }

    button:active .media_viewport:not(.is-selected) {
        clip-path: inset(0.5rem round 0.5rem);
    }

    .media_viewport.is-selected {
        clip-path: inset(0.25rem round 0.5rem);
    }

</style>
