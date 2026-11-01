<script>
    import { wait_for_page_reveal } from '$lib/state/page_ready.js';
	import { onMount } from 'svelte';
    import Button from '$lib/components/button.svelte';
    import { pwa_install, prompt_pwa_install } from '$lib/state/pwa_install.svelte.js';

	let landingRoot;

	onMount(() => {
		let cancelled = false;
		let cleanup = () => {};

		import('$lib/state/landing_intro.js')
			.then(async ({ mountLandingIntro }) => {
                await wait_for_page_reveal();
				if (!cancelled) cleanup = mountLandingIntro(landingRoot);
			})
			.catch(() => landingRoot?.classList.remove('landing_intro_pending'));

		return () => {
			cancelled = true;
			cleanup();
		};
	});
</script>

<main bind:this={landingRoot} class="mobile_landing landing_intro_pending grid min-h-dvh w-full grid-cols-1 grid-rows-1">
    <div class="mobile_landing_content col-start-1 row-start-1 flex min-h-dvh w-full flex-col items-center justify-center gap-16 text-center sm:gap-24">

        <div class="flex flex-col gap-4">
            <h1 aria-label="Patter" class="patter_text_logo">
                {#each ['P', 'a', 't', 't', 'e', 'r'] as letter}
                    <span aria-hidden="true" class="inline-block" data-landing-intro-letter>{letter}</span>
                {/each}
            </h1>
            <div class="patter_text_main patter_text_secondary" data-landing-intro-reveal>
                <p>An ambient text editor for you to focus on writing.</p>
                <p class="mask-[linear-gradient(to_right,rgba(0,0,0,1)_0%,rgba(0,0,0,0.4)_100%)]">
                    Everything else stays out of sight
                </p>
            </div>
        </div>

        <div class="flex max-w-full items-center gap-2 px-1 self-center" data-landing-intro-reveal>
            <img src="/vector2.png" alt="" class="hidden h-5 scale-x-[-1] pointer-events-none select-none opacity-24 sm:block" draggable="false">
            <div class="flex max-w-full flex-wrap justify-center gap-3 sm:flex-nowrap sm:gap-4">
                <Button href="/editor" text="Start writing" sound="click"/>
                {#if !pwa_install.standalone}
                    <Button text={pwa_install.installed ? 'Open desktop app' : 'Get desktop app'} sound="click" disabled={!pwa_install.available && !pwa_install.installed} onclick={prompt_pwa_install} />
                {/if}
            </div>
            <img src="/vector2.png" alt="" class="hidden h-5 pointer-events-none select-none opacity-24 sm:block" draggable="false">
        </div>

    </div>
    <div class="landing_footer_anchor col-start-1 row-start-1 z-10 w-full max-w-3xl self-end justify-self-center">
    <footer data-landing-intro-reveal class="landing_footer patter_editor_controls px-4 sm:px-8 pt-8 patter_text_small">
        <a data-selectable-text aria-label="Send feedback by email" href="mailto:patter@hedwy.art" class="landing_subtext transition-[border-color] border-b-2 border-transparent hover:border-inherit">patter@hedwy.art</a>
        <a href="/privacy" class="footer_privacy landing_subtext transition-[border-color] border-b-2 border-transparent hover:border-inherit">privacy policy</a>
    </footer>
    </div>
</main>

<style>
    .mobile_landing { padding-inline: var(--patter_page_left) var(--patter_page_right); }
    .landing_subtext { opacity: var(--patter_landing_subtext_opacity); }
    .landing_footer { display: flex; align-items: center; justify-content: space-between; gap: var(--patter_space_6); padding-bottom: var(--patter_page_bottom); text-align: left; }
    .footer_privacy { flex-shrink: 0; }
    @media (max-width: 639px) {
        .landing_footer { align-items: flex-end; gap: var(--patter_space_4); }
        .footer_privacy { max-width: 6rem; text-align: right; }
    }
    @media (max-width: 639px), (hover: none), (pointer: coarse) {
        .mobile_landing { min-height: 100svh; padding-top: env(safe-area-inset-top); overflow-y: auto; max-height: 100dvh; }
        .mobile_landing_content { min-height: min(38rem, 80svh); gap: var(--patter_space_12); padding-block: var(--patter_space_12); }
        .landing_footer_anchor { grid-row: 2; }
        .mobile_landing footer { padding-top: var(--patter_space_3); padding-bottom: var(--patter_page_bottom); padding-right: calc(var(--patter_control_height) + var(--patter_space_8)); }
    }
</style>
