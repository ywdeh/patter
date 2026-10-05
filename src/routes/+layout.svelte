<script lang="ts">
	import Background from '$lib/components/background.svelte';
	import './layout.css';
	import { afterNavigate, onNavigate } from '$app/navigation';
	import { onMount } from 'svelte';

	let { children } = $props();

	onNavigate((navigation) => {
		if (!navigation.from || navigation.from.url.pathname === navigation.to.url.pathname) return;

		const surface = document.querySelector('.route-surface');
		const background = document.querySelector('.route-background');
		for (const element of [surface, background]) {
			if (!element) continue;
			element.classList.remove('route-fade-in');
			element.classList.add('route-fade-out');
		}
		if (!surface && !background) return;

		return new Promise((resolve) => {
			window.setTimeout(resolve, 400);
		});
	});

	afterNavigate(({ from }) => {
		if (!from) return;
		const surface = document.querySelector('.route-surface');
		const background = document.querySelector('.route-background');
		for (const element of [surface, background]) {
			if (!element) continue;
			element.classList.remove('route-fade-out', 'route-fade-in');
			void element.getBoundingClientRect();
			element.classList.add('route-fade-in');
		}
	});

	onMount(() => {
		requestAnimationFrame(() => {
			const surface = document.querySelector('.route-surface');
			const background = document.querySelector('.route-background');
			for (const element of [surface, background]) {
				if (!element) continue;
				element.classList.remove('route-initial-hidden', 'route-fade-out', 'route-fade-in');
				void element.getBoundingClientRect();
				element.classList.add('route-fade-in');
			}
		});
	});
</script>

<svelte:head><link rel="icon" href="/patter.ico" /></svelte:head>

<Background />

<div class="route-surface route-initial-hidden">
	{@render children()}
</div>
