<script>
	import { onMount } from 'svelte';
    import Button from '$lib/components/button.svelte';
    import { pwa_install, prompt_pwa_install } from '$lib/state/pwa_install.svelte.js';

	let landingRoot;

	onMount(() => {
		let cancelled = false;
		let cleanup = () => {};

		import('$lib/state/landing_intro.js')
			.then(({ mountLandingIntro }) => {
				if (!cancelled) cleanup = mountLandingIntro(landingRoot);
			})
			.catch(() => landingRoot?.classList.remove('landing_intro_pending'));

		return () => {
			cancelled = true;
			cleanup();
		};
	});
</script>

<main bind:this={landingRoot} class="landing_intro_pending grid min-h-dvh w-full grid-cols-1 grid-rows-1 px-4 sm:px-6 md:px-24">
    <div class="col-start-1 row-start-1 flex min-h-dvh w-full flex-col items-center justify-center gap-16 text-center sm:gap-24">

        <div class="flex flex-col gap-4">
            <h1 aria-label="Patter" class="patter_font_header text-7xl tracking-tight sm:text-8xl md:text-9xl">
                {#each ['P', 'a', 't', 't', 'e', 'r'] as letter}
                    <span aria-hidden="true" class="inline-block" data-landing-intro-letter>{letter}</span>
                {/each}
            </h1>
            <div class="patter_text_secondary" data-landing-intro-reveal>
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
    <footer data-landing-intro-reveal class="col-start-1 row-start-1 z-10 flex w-full flex-col-reverse items-center gap-1 self-end px-6 pt-8 pb-6 text-center patter_text_subtle">
        <p class="max-w-full opacity-80">Patter is in active development. Back up your files, just in case</p>
        <div class="flex justify-center gap-2">
                <p class="opacity-60">feedback <a href="mailto:itshedwy@icloud.com" class="transition-all border-b-2 border-transparent hover:border-inherit">itshedwy@icloud.com</a>, <a href="https://reddit.com/r/patterapp" target="_blank" class="transition-all border-b-2 border-transparent hover:border-inherit">reddit</a></p>
        </div>
    </footer>
</main>
