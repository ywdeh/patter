<script>
    import { onDestroy } from 'svelte';
    import { playSound } from '$lib/state/sound.js';
    import { motionDuration } from '$lib/state/motion.js';

    let {
        text = 'Hold to confirm',
        duration = 1000,
        oncomplete = null,
        sound = 'click'
    } = $props();

    let isHolding = $state(false);
    let isComplete = $state(false);
    let holdTimer;
    let resetTimer;
    let activeKey = null;

    function playButtonSound() {
        if (sound) playSound(sound);
    }

    function startHold() {
        if (isHolding || isComplete) return;
        clearTimeout(resetTimer);
        isComplete = false;
        isHolding = true;
        holdTimer = window.setTimeout(() => {
            isHolding = false;
            isComplete = true;
            playButtonSound();
            oncomplete?.();
            resetTimer = window.setTimeout(() => (isComplete = false), motionDuration('slow', 400));
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
    aria-describedby="hold-button-description"
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
    class="patter_control group/hitbox relative flex w-fit cursor-pointer select-none touch-none items-center patter_font_body"
>
    <span
        aria-hidden="true"
        class="patter_hover patter_active absolute inset-0 overflow-hidden rounded-xl"
    >
        <span
            class="block h-full bg-mauve-100/6 transition-[width] ease-linear"
            class:w-full={isComplete}
            class:w-0={!isHolding && !isComplete}
            class:hold_progress={isHolding}
            style:--hold-duration={`${duration}ms`}
        ></span>
    </span>
    <span
        class="patter_surface patter_hover patter_active absolute inset-0 rounded-xl bg-linear-to-b from-mauve-100/6 to-mauve-100/0"
    ></span>
    <span class="relative flex min-h-12 items-center px-4 py-3 pointer-events-none select-none">
        {text}
    </span>
    <span id="hold-button-description" class="sr-only">Press and hold for {duration / 1000} seconds to confirm.</span>
</button>

<style>
    .hold_progress {
        width: 100%;
        transition-duration: var(--hold-duration);
    }
</style>
