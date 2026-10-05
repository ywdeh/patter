<script>
    import Button from '$lib/components/button.svelte';
    import OptionsBar from '$lib/components/options_bar.svelte';
</script>

<OptionsBar />

<main class="flex h-screen w-screen flex-col items-center justify-center gap-12 p-8 text-center">
    <h1 class="font-[Amarante] text-9xl tracking-tight">Patter</h1>
    <Button href="/" text="Back home" sound="/type.mp3" />
</main>
