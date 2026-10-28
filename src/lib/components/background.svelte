<script>
    import { wait_for_page_reveal } from '$lib/state/page_ready.js';
    import { onDestroy, onMount } from 'svelte';
    import { untrack } from 'svelte';
    import { tick } from 'svelte';
    import { active_background, background_values, background_startup, defaults, release_unused_background_uploads, selectBuiltInBackground } from '$lib/state/background_state.svelte.js';
    import { loadBackgroundImage } from '$lib/state/background_preloader.js';
    import { createVideoPoster, getBackgroundPoster, saveBackgroundPoster } from '$lib/state/background_posters.js';
    import { setAmbientBackgroundColor } from '$lib/state/background_ambient_color.js';
    import { prepare_background } from '$lib/state/background_preparation.js';
    import { motionDuration } from '$lib/state/motion.js';
    import { begin_wallpaper_spread, complete_wallpaper_spread, spread_wallpaper, take_spread_origin } from '$lib/state/background_spread.js';
    import grain_image from '$lib/media/grain.gif'

    const backgroundLayerCleanupDelay = motionDuration('slow', 400) + 20;


    let layerId = 0;
    let visible_backgrounds = $state([create_layer(active_background, true)]);

    function create_layer(background, initial = false) {
        return {
            id: initial ? 0 : ++layerId,
            kind: background.kind,
            url: background.url,
            key: background.key ?? background_values.background,
            position: background.position ?? untrack(() => background_values.position),
            opacity: initial ? 1 : 0,
            videoOpacity: initial && background.kind === 'video' ? 0 : 1,
            useBackgroundVariable: initial
        };
    }

    let transitionTimer;
    let transitionId = 0;
    let transitionInProgress = $state(false);
    let prefersReducedMotion = false;
    let destroyed = false;
    const video_frame_waiters = new Set();
    const spread_controllers = new Set();

    $effect(() => {
        release_unused_background_uploads([active_background.url, ...visible_backgrounds.map((layer) => layer.url)]);
    });

    onDestroy(() => {
        destroyed = true;
        for (const controller of spread_controllers) controller.abort();
        spread_controllers.clear();
        for (const cancel of video_frame_waiters) cancel();
    });

    $effect(() => {
        const position = background_values.position;
        const key = background_values.background;
        const activeLayer = untrack(() => visible_backgrounds.at(-1));
        if (!transitionInProgress && activeLayer?.key === key) {
            activeLayer.position = position;
        }
    });

    async function updateAmbientColor(source, key, kind = 'image') {
        if (destroyed || background_values.background !== key) return;
        const { color, scrim } = await prepare_background(source, key, kind);
        if (destroyed || background_values.background !== key) return;
        if (color) setAmbientBackgroundColor(color, key);
        if (scrim !== null) document.documentElement.style.setProperty('--patter_background_scrim', String(scrim));
    }

    function handleVideoReady(background, video) {
        if (prefersReducedMotion) video.pause();
        else video.play().catch(() => {});
        void updateAmbientColor(video, background.key || background.url, 'video');
        void wait_for_page_reveal().then(() => {
            if (destroyed) return;
            const layer = untrack(() => visible_backgrounds.find((item) => item.id === background.id));
            if (layer) layer.videoOpacity = 1;
        });

        const key = background.key || background.url;
        if (getBackgroundPoster(key)) return;
        try {
            const poster = createVideoPoster(video);
            if (!poster) return;
            saveBackgroundPoster(key, poster);
            if (background_values.background === key) {
                document.documentElement.style.setProperty('--patter_background', `url("${poster}")`);
            }
        } catch {
        }
    }

    onMount(() => {
        const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
        const syncMotionPreference = () => {
            prefersReducedMotion = motionPreference.matches;
            document.querySelectorAll('.route_background video').forEach((video) => {
                if (prefersReducedMotion) video.pause();
                else video.play().catch(() => {});
            });
        };
        syncMotionPreference();
        motionPreference.addEventListener('change', syncMotionPreference);
        return () => motionPreference.removeEventListener('change', syncMotionPreference);
    });

    function handleVideoError(background) {
        if (background.url === defaults.background) return;
        if (untrack(() => background_values.background) !== background.key) return;
        selectBuiltInBackground(defaults.background);
    }

    async function waitForVideoFrame(id) {
        await tick();
        const video = document.querySelector(`[data-background-id="${id}"] video`);
        if (!video) return false;
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            const loaded = await new Promise((resolve) => {
                const finish = (ready) => {
                    video.removeEventListener('loadeddata', on_loaded);
                    video.removeEventListener('error', cancel);
                    video.removeEventListener('abort', cancel);
                    video_frame_waiters.delete(cancel);
                    resolve(ready);
                };
                const on_loaded = () => finish(true);
                const cancel = () => finish(false);
                video_frame_waiters.add(cancel);
                video.addEventListener('loadeddata', on_loaded, { once: true });
                video.addEventListener('error', cancel, { once: true });
                video.addEventListener('abort', cancel, { once: true });
                if (video.error || destroyed) cancel();
            });
            if (!loaded) return false;
        }
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return !destroyed && video.isConnected && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
    }

    function handleVideoEnded(background) {
        if (untrack(() => visible_backgrounds.at(-1)?.id) !== background.id) return;

        const outgoing = background;
        outgoing.opacity = 1;
        const incoming = create_layer(background);
        transitionInProgress = true;
        visible_backgrounds = [outgoing, incoming];

        const fadeInLoop = async () => {
            if (!await waitForVideoFrame(incoming.id)) return;
            await wait_for_page_reveal();
            if (destroyed || untrack(() => visible_backgrounds.at(-1)?.id) !== incoming.id) return;

            const incomingLayer = untrack(() => visible_backgrounds.at(-1));
            if (!incomingLayer || incomingLayer.id !== incoming.id) return;
            incomingLayer.opacity = 1;
            transitionInProgress = false;
            transitionTimer = window.setTimeout(() => {
                if (untrack(() => visible_backgrounds.at(-1)?.id) === incoming.id) {
                    visible_backgrounds = [incomingLayer];
                }
            }, backgroundLayerCleanupDelay);
        };

        fadeInLoop();
    }

    $effect(() => {
        const next = { kind: active_background.kind, url: active_background.url, key: background_values.background };
        const current = untrack(() => visible_backgrounds.at(-1));
        if (!next.url) return;
        const spread_sequence = begin_wallpaper_spread();
        if (next.kind === current.kind && next.url === current.url) {
            complete_wallpaper_spread(next.key, spread_sequence);
            return;
        }
        const spread_origin = take_spread_origin(next.key);

        const id = ++transitionId;
        const spread_controller = new AbortController();
        window.clearTimeout(transitionTimer);

        const prepareAndTransition = async () => {
            if (next.kind === 'image') {
                try {
                    await loadBackgroundImage(next.url);
                } catch {
                    if (id === transitionId && background_values.background === next.key) {
                        selectBuiltInBackground(defaults.background);
                    }
                    return;
                }
            }
            if (id !== transitionId) return;

            if (next.kind === 'image') {
                await updateAmbientColor(next.url, next.key);
                if (id !== transitionId) return;
            }

            await wait_for_page_reveal();
            if (destroyed || id !== transitionId) return;

            const outgoing = untrack(() => visible_backgrounds.at(-1));
            if (!outgoing) return;
            outgoing.opacity = 1;
            const incoming = create_layer(next);
            transitionInProgress = true;
            visible_backgrounds = [...untrack(() => visible_backgrounds), incoming];
            await tick();
            const incomingLayer = untrack(() => visible_backgrounds.at(-1));
            if (!incomingLayer) return;
            if (next.kind === 'video') {
                if (!await waitForVideoFrame(incoming.id)) return;
                incomingLayer.videoOpacity = 1;
            } else {
                await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            }
            if (id !== transitionId) return;

            const spread_node = document.querySelector(`[data-background-id="${incoming.id}"]`);
            if (spread_node) {
                spread_node.style.transition = 'none';
                spread_node.style.clipPath = 'inset(0 100% 0 0)';
            }
            incomingLayer.opacity = 1;
            await tick();
            if (id !== transitionId || destroyed) return;
            spread_controllers.add(spread_controller);
            await spread_wallpaper(spread_node, {
                duration: motionDuration('ink', 800),
                key: next.key,
                sequence: spread_sequence,
                origin: spread_origin,
                signal: spread_controller.signal
            });
            spread_controllers.delete(spread_controller);
            if (destroyed) return;
            const completed_index = untrack(() => visible_backgrounds.findIndex((layer) => layer.id === incoming.id));
            if (completed_index > 0) visible_backgrounds = untrack(() => visible_backgrounds.slice(completed_index));
            if (id !== transitionId) return;
            transitionInProgress = false;
            transitionTimer = window.setTimeout(() => {
                if (id === transitionId) visible_backgrounds = [incomingLayer];
            }, backgroundLayerCleanupDelay);
        };

        prepareAndTransition();

        return () => {
            transitionId++;
            window.clearTimeout(transitionTimer);
            for (const cancel of video_frame_waiters) cancel();
        };
    });

    onMount(() => {
        void background_startup.then(async () => {
            if (destroyed) return;
            const initial = untrack(() => visible_backgrounds[0]);
            if (initial?.kind === 'image' && initial.url === active_background.url) {
                initial.useBackgroundVariable = false;
                await updateAmbientColor(initial.url, initial.key);
            }
        }).catch(() => {});
    });

</script>

<div data-patter-background class="route_background route_initial_hidden fixed inset-0 pointer-events-none -z-5 select-none">
    <div class="wallpaper_blur_layer absolute inset-0" style="filter: blur(var(--patter_focus, 10px)); transition: filter var(--patter_motion_standard) ease">
    {#each visible_backgrounds as background (background.id)}
        <div
            class="background-layer absolute inset-0 bg-cover bg-center bg-no-repeat"
            data-background-id={background.id}
            style={`opacity: ${background.opacity}; background-position: center ${background.id === 0 && background.useBackgroundVariable ? 'var(--patter_background_position, center)' : background.position}; transition: opacity var(--patter_motion_slow) ease-in-out`}
            style:background-image={background.kind === 'video' ? "var(--patter_background), url('/backgrounds/book.webp')" : 'none'}
        >
            {#if background.kind === 'video'}
                <video class="absolute h-full w-full object-cover" style={`object-position: center ${background.id === 0 && background.useBackgroundVariable ? 'var(--patter_background_position, center)' : background.position}; opacity: ${background.videoOpacity}; transition: object-position var(--patter_motion_gentle) cubic-bezier(0.22, 1, 0.36, 1), opacity var(--patter_motion_slow) ease-in-out`} src={background.url} muted preload="auto" playsinline disablepictureinpicture aria-hidden="true" onloadeddata={(event) => handleVideoReady(background, event.currentTarget)} onerror={() => handleVideoError(background)} onended={() => handleVideoEnded(background)}></video>
            {:else}
                <div class="absolute inset-0 bg-cover" style={`background-position: center ${background.id === 0 && background.useBackgroundVariable ? 'var(--patter_background_position, center)' : background.position}; transition: background-position var(--patter_motion_gentle) cubic-bezier(0.22, 1, 0.36, 1); ${background.useBackgroundVariable ? "background-image: var(--patter_background), url('/backgrounds/book.webp')" : `background-image: url("${background.url}")`}`}></div>
            {/if}
        </div>
    {/each}
    </div>

    <div
        aria-hidden="true"
        class="absolute inset-0 h-full w-full bg-black pointer-events-none"
        style="opacity: var(--patter_background_scrim, 0); transition: opacity var(--patter_motion_slow) ease-in-out"></div>

    <div
        class="transition absolute inset-0 h-full w-full"
        style="background-color: var(--patter_tint_color, oklch(12.9% 0.042 264.695)); opacity: var(--patter_tint, 0.5)"></div>

    <div 
        class="absolute h-full w-full bg-repeat z-50"
        style="background-image: url({grain_image}); opacity: var(--patter_grain, 0.02)"></div>
</div>
