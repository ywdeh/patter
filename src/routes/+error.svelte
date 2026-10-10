<script>
    import Button from '$lib/components/button.svelte';
    import OptionsBar from '$lib/components/options_bar.svelte';
</script>

<OptionsBar />

<svelte:head>
    <title>Patter</title>
</svelte:head>

<main class="flex h-screen w-screen flex-col items-center justify-center gap-12 p-8 text-center">
    <h1 aria-label="Page not found — Patter" class="patter_font_header text-9xl tracking-tight">Patter</h1>
    <Button href="/" text="Back home" sound="/type.mp3" />
</main>
