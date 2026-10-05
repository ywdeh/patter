<script>
    import { untrack } from "svelte";
    import { fly } from "svelte/transition";
    import { playTapSound } from '$lib/state/tap-sound.js';

    let {
        text = null,
        value = $bindable(60),
        defaultValue = null,
        min = 0,
        max = 100,
        step = 10,
        unit = "%",
        holdInterval = 200,
        onchange = null
    } = $props();

    // Fallback only used when no defaultValue is passed
    const initialValue = untrack(() => value);
    const resetTo = $derived(clamp(defaultValue ?? initialValue));

    let holdTimer = null;
    let holdStarted = false;
    let direction = $state(1);

    const outDuration = 110;
    const inDuration = 145;

    function playClick() {
        playTapSound();
    }

    function clamp(v) {
        return Math.min(max, Math.max(min, v));
    }

    function step_(delta) {
        const next = clamp(value + delta);
        if (next !== value) {
            playClick();
            direction = delta > 0 ? 1 : -1;
            value = next;
            onchange?.(next);
        }
    }

    function reset() {
        if (resetTo !== value) {
            playClick();
            direction = resetTo > value ? 1 : -1;
            value = resetTo;
            onchange?.(resetTo);
        }
    }

    function startHold(delta) {
        holdStarted = false;

        holdTimer = setInterval(() => {
            holdStarted = true;
            step_(delta);
        }, holdInterval);
    }

    function endHold() {
        clearInterval(holdTimer);
        holdTimer = null;
        setTimeout(() => (holdStarted = false), 0);
    }

    function handleClick(delta) {
        if (holdStarted) return;
        step_(delta);
    }

</script>

<div class="flex gap-4 items-center w-full">
    <p class="flex-1 select-none">{text}</p>
    <div class="flex flex-[1.5] gap-4 justify-between items-center bg-linear-to-r from-mauve-100/0 via-mauve-100/12 to-mauve-100/0 rounded-full text-center">
        <button
            onclick={() => handleClick(-step)}
            onpointerdown={() => startHold(-step)}
            onpointerup={endHold}
            onpointerleave={endHold}
            disabled={value <= min}
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
                <img src="/sub.svg" alt="decrease" class="size-5">
            </p>
        </button>

        <div class="min-w-15 h-6 relative overflow-hidden select-none tabular-nums">
            {#key value}
                <p
                    class="absolute inset-0"
                    in:fly={{ x: direction * 20, duration: inDuration, delay: outDuration }}
                    out:fly={{ x: direction * -20, duration: outDuration }}
                >
                    {value}{unit}
                </p>
            {/key}
        </div>

        <button
            onclick={() => handleClick(step)}
            onpointerdown={() => startHold(step)}
            onpointerup={endHold}
            onpointerleave={endHold}
            disabled={value >= max}
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
                <img src="/add.svg" alt="increase" class="size-5">
            </p>
        </button>

        <button
            onclick={reset}
            disabled={value === resetTo}
            aria-label="Reset to default"
            class="group transition h-6 aspect-square shrink-0 group/inputpill flex items-center justify-center relative cursor-pointer disabled:opacity-30 disabled:pointer-events-none">
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

            <p class="flex items-center gap-2 px-1 relative pointer-events-none select-none">
                <img src="/undo.svg" alt="reset" class="size-5">
            </p>
        </button>
    </div>
</div>
