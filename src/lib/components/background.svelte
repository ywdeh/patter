<script>
    import { onMount } from 'svelte';
    import { untrack } from 'svelte';
    import { tick } from 'svelte';
    import { page } from '$app/state';
    import { active_background, background_values, defaults, selectBuiltInBackground, selectUploadedBackground } from '$lib/state/background.svelte.js';
    import { getBackgroundUpload } from '$lib/state/background-media.js';
    import { createVideoPoster, getBackgroundPoster, saveBackgroundPoster } from '$lib/state/background-posters.js';
    import grain_image from '$lib/media/grain.gif'
    import ripples_image from '$lib/media/ripples.svg'

    let tint_color = 'oklch(12.9% 0.042 264.695)'
    let layerId = 0;
    let visible_backgrounds = $state([{
        id: layerId,
        kind: active_background.kind,
        url: active_background.url,
        posterKey: background_values.background,
        opacity: 1,
        videoOpacity: active_background.kind === 'video' ? 0 : 1,
        useBackgroundVariable: true
    }]);
    let transitionTimer;
    let transitionId = 0;

    function handleVideoReady(background, video) {
        const layer = untrack(() => visible_backgrounds.find((item) => item.id === background.id));
        if (layer) layer.videoOpacity = 1;

        const posterKey = background.posterKey || background.url;
        if (getBackgroundPoster(posterKey)) return;
        try {
            const poster = createVideoPoster(video);
            if (!poster) return;
            saveBackgroundPoster(posterKey, poster);
            if (background_values.background === posterKey) {
                document.documentElement.style.setProperty('--patter-background', `url("${poster}")`);
            }
        } catch {
            // Poster capture is an enhancement; video playback continues without it.
        }
    }

    async function waitForVideoFrame(id) {
        await tick();
        const video = document.querySelector(`[data-background-id="${id}"] video`);
        if (!video) return false;
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            await new Promise((resolve) => video.addEventListener('loadeddata', resolve, { once: true }));
        }
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
    }

    function handleVideoEnded(background) {
        if (untrack(() => visible_backgrounds.at(-1)?.id) !== background.id) return;

        const outgoing = background;
        outgoing.opacity = 1;
        const incoming = {
            id: ++layerId,
            kind: 'video',
            url: background.url,
            posterKey: background.posterKey,
            opacity: 0,
            videoOpacity: 1,
            useBackgroundVariable: false
        };
        visible_backgrounds = [outgoing, incoming];

        const fadeInLoop = async () => {
            if (!await waitForVideoFrame(incoming.id)) return;
            if (untrack(() => visible_backgrounds.at(-1)?.id) !== incoming.id) return;

            const incomingLayer = untrack(() => visible_backgrounds.at(-1));
            if (!incomingLayer || incomingLayer.id !== incoming.id) return;
            incomingLayer.opacity = 1;
            // Leave the ending frame fully opaque underneath the restarted
            // video until the new video has completely covered it.
            transitionTimer = window.setTimeout(() => {
                if (untrack(() => visible_backgrounds.at(-1)?.id) === incoming.id) {
                    visible_backgrounds = [incomingLayer];
                }
            }, 420);
        };

        fadeInLoop();
    }

    $effect(() => {
        const next = { kind: active_background.kind, url: active_background.url, posterKey: background_values.background };
        const current = untrack(() => visible_backgrounds.at(-1));
        if (!next.url || (next.kind === current.kind && next.url === current.url)) return;

        const id = ++transitionId;
        window.clearTimeout(transitionTimer);

        const prepareAndTransition = async () => {
            // Decode incoming stills before exposing their layer. This avoids a
            // blank frame when switching away from video or large uploaded images.
            if (next.kind === 'image') {
                const image = new Image();
                image.src = next.url;
                try {
                    await image.decode();
                } catch {
                    // Keep the previous background visible if an image cannot load.
                    return;
                }
            }
            if (id !== transitionId) return;

            const outgoing = untrack(() => visible_backgrounds.at(-1));
            if (!outgoing) return;
            outgoing.opacity = 1;
            const incoming = {
                id: ++layerId,
                kind: next.kind,
                url: next.url,
                posterKey: next.posterKey,
                opacity: 0,
                videoOpacity: 1,
                useBackgroundVariable: false
            };
            // Keep the outgoing keyed layer in the DOM. In particular, this
            // preserves the live video element and its current playback frame.
            visible_backgrounds = [outgoing, incoming];
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

            incomingLayer.opacity = 1;
            // Keep the outgoing image fully opaque underneath the incoming
            // layer. Fading both layers exposes the dark page background
            // halfway through the crossfade.
            transitionTimer = window.setTimeout(() => {
                if (id === transitionId) visible_backgrounds = [incomingLayer];
            }, 420);
        };

        prepareAndTransition();

        return () => {
            transitionId++;
            window.clearTimeout(transitionTimer);
        };
    });

    onMount(async () => {
        // The initial server-rendered image uses the CSS variable so the saved
        // choice can paint immediately. Pin it to its URL after hydration.
        const initialLayer = visible_backgrounds[0];
        const selection = background_values.background;
        if (!selection.startsWith('upload:')) {
            if (initialLayer) {
                initialLayer.kind = active_background.kind;
                initialLayer.url = active_background.url;
                initialLayer.posterKey = selection;
                initialLayer.videoOpacity = active_background.kind === 'video' ? 0 : 1;
                initialLayer.useBackgroundVariable = false;
            }
            return;
        }
        try {
            const record = await getBackgroundUpload(selection.slice('upload:'.length));
            if (record && background_values.background === selection) {
                const poster = getBackgroundPoster(selection);
                if (initialLayer) {
                    if (poster) initialLayer.url = poster;
                    initialLayer.useBackgroundVariable = false;
                }
                selectUploadedBackground(record.id, record.kind, URL.createObjectURL(record.blob));
            } else {
                if (initialLayer) initialLayer.useBackgroundVariable = false;
                if (background_values.background === selection) selectBuiltInBackground(defaults.background);
            }
        } catch (error) {
            console.error('Could not restore uploaded background', error);
        }
    });

</script>

<div class="absolute inset-0 h-full w-full pointer-events-none -z-5 select-none">
    {#each visible_backgrounds as background (background.id)}
        <div
            class="background-layer absolute inset-0 bg-cover bg-center bg-no-repeat"
            data-background-id={background.id}
            style={`opacity: ${background.opacity}; transition: opacity 400ms ease-in-out, background-position 650ms cubic-bezier(0.22, 1, 0.36, 1)`}
            style:background-position="center var(--patter-background-position, center)"
            style:background-image={background.kind === 'video' ? "var(--patter-background, url('/backgrounds/green_facade.jpg'))" : 'none'}
        >
            {#if background.kind === 'video'}
                <video class="absolute h-full w-full object-cover" style={`object-position: center var(--patter-background-position, center); opacity: ${background.videoOpacity}; transition: object-position 650ms cubic-bezier(0.22, 1, 0.36, 1), opacity 350ms ease-in-out`} src={background.url} autoplay muted preload="auto" playsinline aria-hidden="true" onloadeddata={(event) => handleVideoReady(background, event.currentTarget)} onended={() => handleVideoEnded(background)}></video>
            {:else}
                <div class="absolute inset-0 bg-cover bg-center" style={`background-position: center var(--patter-background-position, center); transition: background-position 650ms cubic-bezier(0.22, 1, 0.36, 1); ${background.useBackgroundVariable ? "background-image: var(--patter-background, url('/backgrounds/green_facade.jpg'))" : `background-image: url("${background.url}")`}`}></div>
            {/if}
        </div>
    {/each}

    <div 
        class="transition absolute inset-0 h-full w-full"
        style="backdrop-filter: blur(var(--patter-focus, 10px))"></div>

    <div
        class="transition absolute inset-0 h-full w-full"
        style="background-color: {tint_color}; opacity: var(--patter-tint, 0.5)"></div>

    <!-- ripples cause firefox browser to lag, perhaps too expensive to repaint. Swap with gif or webp -->
    <!-- {#if page.url.pathname === '/'}
    <div 
        class="absolute h-full w-full bg-cover mix-blend-overlay"
        style="background-image: url({ripples_image}); opacity: 1"></div>
    {/if} -->

    <div 
        class="absolute h-full w-full bg-repeat z-50"
        style="background-image: url({grain_image}); opacity: var(--patter-grain, 0.02)"></div>
</div>
