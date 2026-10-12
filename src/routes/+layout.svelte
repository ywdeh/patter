<script lang="ts">
	import Background from '$lib/components/background.svelte';
	import '$lib/styles/patter_styles.css';
	import { afterNavigate, beforeNavigate, onNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { playSound } from '$lib/state/sound.js';
	import { fade_page_in, fade_page_out } from '$lib/state/page_motion.js';

	let { children } = $props();
	let routeRevealVersion = 0;
	let routeTransitionPromise: Promise<void> | null = null;
	let routeTransitionInProgress = false;

	function get_page_motion_targets() {
		return [
			document.querySelector<HTMLElement>('.route_surface'),
			document.querySelector<HTMLElement>('.route_background')
		].filter((element): element is HTMLElement => !!element);
	}

	function revealSurfaceWhenFontsReady() {
		const version = ++routeRevealVersion;
		void document.fonts.ready.then(() => {
			if (version !== routeRevealVersion) return;
			const surface = document.querySelector<HTMLElement>('.route_surface');
			if (surface) void fade_page_in([surface]);
		});
	}

	beforeNavigate((navigation) => {
		if (routeTransitionInProgress) navigation.cancel();
	});

	onNavigate((navigation) => {
		const destination = navigation.to;
		if (!navigation.from || !destination || navigation.from.url.pathname === destination.url.pathname) return;
		if (routeTransitionInProgress) return;
		routeTransitionInProgress = true;

		playSound('paper_turn');
		playSound('click', 0.5);

		routeTransitionPromise = fade_page_out(get_page_motion_targets());
		return routeTransitionPromise;
	});

	afterNavigate(({ from }) => {
		routeTransitionInProgress = false;
		routeTransitionPromise = null;
		if (!from) return;
		const background = document.querySelector<HTMLElement>('.route_background');
		if (background) void fade_page_in([background]);
		revealSurfaceWhenFontsReady();
	});

	onMount(() => {
		const handleFullscreenChange = () => {
			void fade_page_in(get_page_motion_targets(), 'fullscreen');
		};
		document.addEventListener('fullscreenchange', handleFullscreenChange);

		requestAnimationFrame(() => {
			const background = document.querySelector<HTMLElement>('.route_background');
			if (background) void fade_page_in([background]);
		});
		revealSurfaceWhenFontsReady();

		return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
	});
</script>

<svelte:head><link rel="icon" href="/patter.ico" /></svelte:head>

<Background />

<div class="route_surface route_initial_hidden">
	{@render children()}
</div>
