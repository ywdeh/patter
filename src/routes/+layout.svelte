<script lang="ts">
	import Background from '$lib/components/background.svelte';
	import './layout.css';
	import { afterNavigate, onNavigate } from '$app/navigation';
	import { onMount } from 'svelte';

	let { children } = $props();

	onNavigate((navigation) => {
		if (!navigation.from || navigation.from.url.pathname === navigation.to.url.pathname) return;

		const surface = document.querySelector('.route-surface');
		if (!surface) return;
		surface.classList.remove('route-fade-in');
		surface.classList.add('route-fade-out');

		return new Promise((resolve) => {
			window.setTimeout(resolve, 400);
		});
	});

	afterNavigate(({ from }) => {
		if (!from) return;
		const surface = document.querySelector('.route-surface');
		if (!surface) return;
		surface.classList.remove('route-fade-out', 'route-fade-in');
		void surface.getBoundingClientRect();
		surface.classList.add('route-fade-in');
	});

	onMount(() => {
		requestAnimationFrame(() => {
			const surface = document.querySelector('.route-surface');
			if (!surface) return;
			surface.classList.remove('route-initial-hidden');
			void surface.getBoundingClientRect();
			surface.classList.add('route-fade-in');
		});
	});
</script>

<svelte:head><link rel="icon" href="/patter.ico" /></svelte:head>

<Background />

<div class="route-surface route-initial-hidden">
	{@render children()}
</div>
