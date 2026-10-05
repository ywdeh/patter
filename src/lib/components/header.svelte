<script>
    import Button from '$lib/components/button.svelte';
    import InputPill from './input_pill.svelte';
    let optionsVisible = $state(false);
</script>

<div class="flex flex-col p-24 items-center justify-center gap-12 w-screen h-screen">

    <div class="flex flex-col gap-24 items-center text-center">

        <div class="flex flex-col gap-4">
            <h1 class="font-[Amarante] text-9xl tracking-tight">Patter</h1>
            <h2 class="opacity-60 font-[Bitter]">
                <p>Ambient text editor for you to focus on writing.</p>
                <div class="mask-[linear-gradient(to_right,rgba(0,0,0,1)_0%,rgba(0,0,0,0.4)_100%)]">
                    Everything else stays out of sight
                </div>
            </h2>
        </div>

        <div class="flex gap-2 px-1 self-center items-center">
            <img src="/vector2.png" alt="" class="h-5 scale-x-[-1] pointer-events-none select-none opacity-24" draggable="false">
            <div class="flex gap-4">
                <Button href="/editor" text="Pick up the pen" sound="/type.mp3"/>
            </div>
            <img src="/vector2.png" alt="" class="h-5 pointer-events-none select-none opacity-24" draggable="false">
        </div>

        <div class="absolute flex flex-col gap-1 w-full bottom-0 p-6 opacity-30 text-xs tracking-wide">
            <p>With care by <a href="https://hedwy.art" target="_blank" class="transition-all border-b-2 border-transparent hover:border-inherit">Hedwy</a>. Feedback: <a href="mailto:itshedwy@icloud.com" class="transition-all border-b-2 border-transparent hover:border-inherit">itshedwy@icloud.com</a></p>
            <p>Patter is still in development. Save your files often, just in case</p>
        </div>

    </div>
</div>