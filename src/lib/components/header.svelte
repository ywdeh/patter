<script>
    import Button from '$lib/components/button.svelte';
</script>

<main class="grid min-h-dvh w-full grid-rows-[1fr_auto] items-center px-4 pt-12 pb-4 sm:px-6 sm:pt-16 sm:pb-6 md:px-24 md:py-24">
    <div class="flex flex-col items-center gap-16 text-center sm:gap-24">

        <div class="flex flex-col gap-4">
            <h1 class="patter_font_header text-7xl tracking-tight sm:text-8xl md:text-9xl">Patter</h1>
            <div class="patter_text_secondary">
                <p>An ambient text editor for you to focus on writing.</p>
                <p class="mask-[linear-gradient(to_right,rgba(0,0,0,1)_0%,rgba(0,0,0,0.4)_100%)]">
                    Everything else stays out of sight
                </p>
            </div>
        </div>

        <div class="flex max-w-full items-center gap-2 px-1 self-center">
            <img src="/vector2.png" alt="" class="hidden h-5 scale-x-[-1] pointer-events-none select-none opacity-24 sm:block" draggable="false">
            <div class="flex max-w-full flex-wrap justify-center gap-3 sm:flex-nowrap sm:gap-4">
                <Button href="/editor" text="Start writing" sound="click"/>
                <Button href="/editor" text="Desktop app" sound="click" disabled />
            </div>
            <img src="/vector2.png" alt="" class="hidden h-5 pointer-events-none select-none opacity-24 sm:block" draggable="false">
        </div>

    </div>
    <footer class="flex w-full flex-col-reverse items-center gap-1 pt-8 text-center patter_text_subtle sm:p-6">
        <p class="max-w-full opacity-80">Patter is in active development. Back up your files, just in case</p>
        <div class="flex justify-center gap-2">
                <p class="opacity-60">feedback <a href="mailto:itshedwy@icloud.com" class="transition-all border-b-2 border-transparent hover:border-inherit">itshedwy@icloud.com</a>, <a href="https://reddit.com/r/patterapp" target="_blank" class="transition-all border-b-2 border-transparent hover:border-inherit">reddit</a></p>
        </div>
    </footer>
</main>
