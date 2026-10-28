<script lang="ts">
    import { background_startup } from '$lib/state/background_state.svelte.js';
    import { route_navigation_is_urgent } from '$lib/state/route_navigation.js';
    import { begin_page_reveal, finish_page_reveal } from '$lib/state/page_ready.js';
    import { mount_mobile_viewport } from '$lib/state/mobile_viewport.js';
    import { mount_panel_occlusion } from '$lib/state/panel_occlusion.js';
    import { mount_ui_hover_sound } from '$lib/state/ui_hover_sound.js';
	import Background from '$lib/components/background.svelte';
	import OptionsBar from '$lib/components/options_bar.svelte';
	import '$lib/styles/patter_styles.css';
	import { afterNavigate, beforeNavigate, onNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { mount_user_interaction } from '$lib/state/user_interaction.js';
	import { mount_pwa_install } from '$lib/state/pwa_install.svelte.js';
	import { motionDuration } from '$lib/state/motion.js';
	import { playSound } from '$lib/state/sound.js';
	import { fade_page_in, fade_page_out, finish_route_fade, get_page_motion_targets } from '$lib/state/page_motion.js';

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
		void Promise.all([document.fonts.ready, background_startup]).then(async () => {
			if (version !== routeRevealVersion) return;
			await fade_page_in(get_page_motion_targets());
            if (version !== routeRevealVersion) return;
            finish_page_reveal();
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
        routeRevealVersion++;
        begin_page_reveal();

		playSound('paper_turn');
		playSound('click', 0.5);

		const fade = fade_page_out(get_page_motion_targets());
        if (route_navigation_is_urgent()) finish_route_fade();
        return fade;
	});

	afterNavigate(({ from }) => {
		routeTransitionInProgress = false;
		if (!from) return;
		revealSurfaceWhenFontsReady();
	});

	onMount(() => {
		const cleanupInstall = mount_pwa_install();
		const cleanupInteraction = mount_user_interaction();
        const cleanupViewport = mount_mobile_viewport();
        const cleanupPanels = mount_panel_occlusion();
        const cleanupHoverSound = mount_ui_hover_sound();
		const handleFullscreenChange = () => {
			void fade_page_in(get_page_motion_targets());
		};
		document.addEventListener('fullscreenchange', handleFullscreenChange);
        const stopOnWriting = (event: Event) => {
            if ((event.target as Element)?.closest('[data-patter-body]')) stopOptionsIntro();
        };
        document.addEventListener('beforeinput', stopOnWriting);

		revealSurfaceWhenFontsReady(true);

		return () => {
            stopOptionsIntro();
            routeRevealVersion++;
            finish_page_reveal();
            document.removeEventListener('beforeinput', stopOnWriting);
			cleanupInstall();
			cleanupInteraction();
            cleanupHoverSound();
            cleanupPanels();
            cleanupViewport();
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
