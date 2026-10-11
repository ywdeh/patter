<script lang="ts">
	import Background from '$lib/components/background.svelte';
	import '$lib/styles/patter_styles.css';
	import { afterNavigate, beforeNavigate, onNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { playSound } from '$lib/state/sound.js';

	let { children } = $props();
	let routeRevealVersion = 0;
	let routeTransitionPromise: Promise<void> | null = null;
	let routeTransitionInProgress = false;

	function fadeIn(element: HTMLElement | null | undefined, animationClass = 'route_fade_in') {
		if (!element) return;
		element.classList.remove('route_initial_hidden', 'route_fade_out', 'route_fade_in', 'route_fullscreen_fade_in', 'route_fullscreen_fade_out');
		void element.getBoundingClientRect();
		element.classList.add(animationClass);
	}

	function revealSurfaceWhenFontsReady() {
		const version = ++routeRevealVersion;
		void document.fonts.ready.then(() => {
			if (version !== routeRevealVersion) return;
			fadeIn(document.querySelector<HTMLElement>('.route_surface'));
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

		const surface = document.querySelector('.route_surface');
		const background = document.querySelector<HTMLElement>('.route_background');
		for (const element of [surface, background]) {
			if (!element) continue;
			element.classList.remove('route_fade_in');
			element.classList.add('route_fade_out');
		}
		if (!surface && !background) return;

		routeTransitionPromise = new Promise((resolve) => {
			window.setTimeout(resolve, 400);
		});
		return routeTransitionPromise;
	});

	afterNavigate(({ from }) => {
		routeTransitionInProgress = false;
		routeTransitionPromise = null;
		if (!from) return;
		const background = document.querySelector<HTMLElement>('.route_background');
		fadeIn(background);
		revealSurfaceWhenFontsReady();
	});

	onMount(() => {
		const handleFullscreenChange = () => {
			fadeIn(document.querySelector<HTMLElement>('.route_surface'), 'route_fullscreen_fade_in');
			fadeIn(document.querySelector<HTMLElement>('.route_background'), 'route_fullscreen_fade_in');
		};
		document.addEventListener('fullscreenchange', handleFullscreenChange);

		requestAnimationFrame(() => {
			const background = document.querySelector<HTMLElement>('.route_background');
			fadeIn(background);
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
