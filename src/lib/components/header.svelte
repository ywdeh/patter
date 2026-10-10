<script>
    import Button from '$lib/components/button.svelte';
</script>

<main class="flex flex-col px-6 py-24 md:p-24 items-center justify-center gap-12 w-screen h-screen">

    <div class="flex flex-col gap-24 items-center text-center">

        <div class="flex flex-col gap-4">
            <h1 class="patter_font_header text-9xl tracking-tight">Patter</h1>
            <div class="patter_text_secondary">
                <p>Ambient text editor for you to focus on writing.</p>
                <p class="mask-[linear-gradient(to_right,rgba(0,0,0,1)_0%,rgba(0,0,0,0.4)_100%)]">
                    Everything else stays out of sight
                </p>
            </div>
        </div>

        <div class="flex gap-2 px-1 self-center items-center">
            <img src="/vector2.png" alt="" class="h-5 scale-x-[-1] pointer-events-none select-none opacity-24" draggable="false">
            <div class="flex gap-4">
                <Button href="/editor" text="Start writing" sound="/type.mp3"/>
                <Button href="/editor" text="Desktop app" sound="/type.mp3" disabled />
            </div>
            <img src="/vector2.png" alt="" class="h-5 pointer-events-none select-none opacity-24" draggable="false">
        </div>

        <div class="absolute flex flex-col gap-1 w-full bottom-0 p-6 patter_text_subtle">
            <p>Feedback: <a href="mailto:itshedwy@icloud.com" class="transition-all border-b-2 border-transparent hover:border-inherit">itshedwy@icloud.com</a></p>
            <p>Patter is still in development. Save your files often, just in case</p>
        </div>

    </div>
</main>
