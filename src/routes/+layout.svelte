<script lang="ts">
	import Background from '$lib/components/background.svelte';
	import OptionsBar from '$lib/components/options_bar.svelte';
	import '$lib/styles/patter_styles.css';
	import { afterNavigate, beforeNavigate, onNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { mount_user_interaction } from '$lib/state/user_interaction.js';
	import { mount_pwa_install } from '$lib/state/pwa_install.svelte.js';
	import { motionDuration } from '$lib/state/motion.js';
	import { playSound } from '$lib/state/sound.js';
	import { fade_page_in, fade_page_out, get_page_motion_targets } from '$lib/state/page_motion.js';

	let { children } = $props();
    let optionsIntro = $state(false);
    let optionsIntroAllowed = true;
    let optionsIntroTimer: ReturnType<typeof setTimeout>;
    function stopOptionsIntro() {
        optionsIntroAllowed = false;
        optionsIntro = false;
        clearTimeout(optionsIntroTimer);
    }
	let routeRevealVersion = 0;
	let routeTransitionInProgress = false;

	function revealSurfaceWhenFontsReady(initial = false) {
		const version = ++routeRevealVersion;
		void document.fonts.ready.then(async () => {
			if (version !== routeRevealVersion) return;
			const surface = document.querySelector<HTMLElement>('.route_surface');
			if (surface) await fade_page_in([surface]);
            if (initial && optionsIntroAllowed && version === routeRevealVersion
                && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                optionsIntro = true;
                optionsIntroTimer = setTimeout(stopOptionsIntro,
                    motionDuration('slow', 400) * 2 + motionDuration('gentle', 600));
            }
		});
	}

	beforeNavigate((navigation) => {
        if (navigation.from) stopOptionsIntro();
		if (routeTransitionInProgress) navigation.cancel();
	});

	onNavigate((navigation) => {
		const destination = navigation.to;
		if (!navigation.from || !destination || navigation.from.url.pathname === destination.url.pathname) return;
		if (routeTransitionInProgress) return;
		routeTransitionInProgress = true;

		playSound('paper_turn');
		playSound('click', 0.5);

		return fade_page_out(get_page_motion_targets());
	});

	afterNavigate(({ from }) => {
		routeTransitionInProgress = false;
		if (!from) return;
		const background = document.querySelector<HTMLElement>('.route_background');
		if (background) void fade_page_in([background]);
		revealSurfaceWhenFontsReady();
	});

	onMount(() => {
		const cleanupInstall = mount_pwa_install();
		const cleanupInteraction = mount_user_interaction();
		const handleFullscreenChange = () => {
			void fade_page_in(get_page_motion_targets());
		};
		document.addEventListener('fullscreenchange', handleFullscreenChange);
        const stopOnWriting = (event: Event) => {
            if ((event.target as Element)?.closest('[data-patter-body]')) stopOptionsIntro();
        };
        document.addEventListener('beforeinput', stopOnWriting);

		requestAnimationFrame(() => {
			const background = document.querySelector<HTMLElement>('.route_background');
			if (background) void fade_page_in([background]);
		});
		revealSurfaceWhenFontsReady(true);

		return () => {
            stopOptionsIntro();
            document.removeEventListener('beforeinput', stopOnWriting);
			cleanupInstall();
			cleanupInteraction();
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
		};
	});
</script>

<svelte:head><link rel="icon" href="/patter.ico" /></svelte:head>

<Background />

<div class="route_surface route_initial_hidden">
	<OptionsBar intro={optionsIntro} onintroend={stopOptionsIntro} />
	{@render children()}
</div>
