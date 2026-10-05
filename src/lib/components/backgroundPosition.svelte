<script>
    import { background_values, persistBackgroundValues } from '$lib/state/background.svelte.js';

    const positions = ['top', 'center', 'bottom'];

    function choose(position) {
        if (background_values.position === position) return;
        background_values.position = position;
        persistBackgroundValues();
        const audio = new Audio('/type.mp3');
        audio.volume = 0.15;
        audio.play().catch(() => {});
    }
</script>

<div class="col-span-2 flex w-full items-center gap-4" role="group" aria-label="Background image position">
    <div class="flex w-full items-center gap-4">
        {#each positions as position}
            {@const active = background_values.position === position}
            <button
                type="button"
                aria-pressed={active}
                aria-label={`Align background to ${position}`}
                onclick={() => choose(position)}
                class="group/hitbox relative flex h-10 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-xl"
            >
                <span class="absolute inset-0 rounded-xl bg-linear-to-b from-mauve-100/6 to-mauve-100/0 outline-2 outline-offset-2 {active ? 'outline-mauve-100/30' : 'outline-mauve-100/12'} backdrop-blur-lg patter_shadow transition-[inset,border-radius,outline] duration-200 ease-out group-hover/hitbox:inset-1 group-hover/hitbox:rounded-2xl group-hover/hitbox:outline-mauve-100/24 group-active/hitbox:inset-2 group-active/hitbox:rounded-3xl"></span>
                <span class="relative flex flex-col gap-1.5 pointer-events-none" aria-hidden="true">
                    {#each positions as linePosition}
                        <span class="h-0.5 w-5 rounded-full bg-mauve-100 transition-opacity duration-200" style:opacity={position === linePosition ? 1 : 0.6}></span>
                    {/each}
                </span>
            </button>
        {/each}
    </div>
</div>
