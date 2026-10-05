<script>
    import { onDestroy } from 'svelte';

    let {
        text = 'Hold to confirm',
        duration = 1000,
        oncomplete = null,
        sound = '/type.mp3'
    } = $props();

    let isHolding = $state(false);
    let isComplete = $state(false);
    let holdTimer;
    let resetTimer;
    let lastPlayed = 0;
    let activeKey = null;

    function playSound() {
        if (!sound || performance.now() - lastPlayed < 150) return;
        lastPlayed = performance.now();
        const audio = new Audio(sound);
        audio.volume = 0.15;
        audio.play().catch(() => {});
    }

    function startHold() {
        if (isHolding || isComplete) return;
        clearTimeout(resetTimer);
        isComplete = false;
        isHolding = true;
        holdTimer = window.setTimeout(() => {
            isHolding = false;
            isComplete = true;
            playSound();
            oncomplete?.();
            resetTimer = window.setTimeout(() => (isComplete = false), 350);
        }, duration);
    }

    function cancelHold() {
        if (!isHolding) return;
        clearTimeout(holdTimer);
        isHolding = false;
    }

    function handleKeydown(event) {
        if ((event.key !== ' ' && event.key !== 'Enter') || event.repeat) return;
        event.preventDefault();
        activeKey = event.key;
        startHold();
    }

    function handleKeyup(event) {
        if (activeKey !== event.key) return;
        activeKey = null;
        cancelHold();
    }

    onDestroy(() => {
        clearTimeout(holdTimer);
        clearTimeout(resetTimer);
    });
</script>

<button
    type="button"
    aria-label={text}
    aria-description="Hold to confirm for {duration / 1000} seconds"
    title="Hold for {duration / 1000} seconds to confirm"
    onpointerdown={(event) => {
        if (event.button === 0) startHold();
    }}
    onpointerup={cancelHold}
    onpointerleave={cancelHold}
    onpointercancel={cancelHold}
    onkeydown={handleKeydown}
    onkeyup={handleKeyup}
    onblur={cancelHold}
    class="group/hitbox relative flex w-fit cursor-pointer select-none touch-none items-center font-[Bitter]"
>
    <span
        aria-hidden="true"
        class="absolute inset-0 overflow-hidden rounded-xl transition-[inset,border-radius] duration-200 ease-out group-hover/hitbox:inset-1 group-hover/hitbox:rounded-2xl group-active/hitbox:inset-2 group-active/hitbox:rounded-3xl"
    >
        <span
            class="block h-full bg-mauve-100/20 transition-[width] ease-linear"
            class:w-full={isComplete}
            class:w-0={!isHolding && !isComplete}
            class:hold-progress={isHolding}
            style:--hold-duration={`${duration}ms`}
        ></span>
    </span>
    <span
        class="absolute inset-0 rounded-xl bg-linear-to-b from-mauve-100/6 to-mauve-100/0 backdrop-blur-lg outline-2 outline-offset-2 outline-mauve-100/12 patter_shadow transition-[inset,border-radius,outline] duration-200 ease-out group-hover/hitbox:inset-1 group-hover/hitbox:rounded-2xl group-hover/hitbox:outline-mauve-100/24 group-active/hitbox:inset-2 group-active/hitbox:rounded-3xl"
    ></span>
    <span class="relative flex min-h-12 items-center px-4 py-3 pointer-events-none select-none">
        {text}
    </span>
</button>

<style>
    .hold-progress {
        width: 100%;
        transition-duration: var(--hold-duration);
    }
</style>
