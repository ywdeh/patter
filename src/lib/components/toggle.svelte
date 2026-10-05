<script>
    import { fly } from "svelte/transition";
    import { playTapSound } from '$lib/state/tap-sound.js';

    let {
        text = null,
        value = $bindable(false),
        trueLabel = "On",
        falseLabel = "Off",
        ontrue = null,
        onfalse = null,
        onchange = null
    } = $props();

    let direction = $state(1);

    const outDuration = 110;
    const inDuration = 145;

    function playClick() {
        playTapSound();
    }

    function set(next) {
        if (next === value) return;

        playClick();
        direction = next ? 1 : -1;
        value = next;

        // Fire only on user interaction (not on mount)
        if (next) ontrue?.();
        else onfalse?.();
        onchange?.(next);
    }
</script>

<div class="flex gap-4 items-center w-full">
    <p class="flex-1 select-none">{text}</p>
    <div class="flex flex-[1.5] gap-4 justify-between items-center bg-linear-to-r from-mauve-100/0 via-mauve-100/12 to-mauve-100/0 rounded-full text-center">
        <button
            onclick={() => set(false)}
            disabled={!value}
            class="group transition h-10 aspect-square shrink-0 group/inputpill flex items-center justify-center relative cursor-pointer disabled:opacity-30 disabled:pointer-events-none">
            <div
                class="absolute inset-0 rounded-full
                bg-linear-to-b from-mauve-100/6 to-mauve-100/0
                backdrop-blur-none
                outline-2 outline-offset-2 outline-mauve-100/12 group-hover/inputpill:outline-mauve-100/24
                patter_shadow
                transition-[inset,border-radius,outline] duration-200 ease-out
                group-hover/inputpill:inset-1
                group-active/inputpill:inset-2 group-disabled:inset-2">
            </div>

            <p class="flex items-center gap-2 relative px-2 pointer-events-none select-none">
                <img src="/sub.svg" alt={falseLabel} class="size-5">
            </p>
        </button>

        <div class="min-w-15 h-6 relative overflow-hidden select-none">
            {#key value}
                <p
                    class="absolute inset-0"
                    in:fly={{ x: direction * 20, duration: inDuration, delay: outDuration }}
                    out:fly={{ x: direction * -20, duration: outDuration }}
                >
                    {value ? trueLabel : falseLabel}
                </p>
            {/key}
        </div>

        <button
            onclick={() => set(true)}
            disabled={value}
            class="group transition h-10 aspect-square shrink-0 group/inputpill flex items-center justify-center relative cursor-pointer disabled:opacity-30 disabled:pointer-events-none">
            <div
                class="absolute inset-0 rounded-full
                bg-linear-to-b from-mauve-100/6 to-mauve-100/0
                backdrop-blur-none
                outline-2 outline-offset-2 outline-mauve-100/12 group-hover/inputpill:outline-mauve-100/24
                patter_shadow
                transition-[inset,border-radius,outline] duration-200 ease-out
                group-hover/inputpill:inset-1
                group-active/inputpill:inset-2 group-disabled:inset-2">
            </div>

            <p class="flex items-center gap-2 relative px-2 pointer-events-none select-none">
                <img src="/add.svg" alt={trueLabel} class="size-5">
            </p>
        </button>
    </div>
</div>
