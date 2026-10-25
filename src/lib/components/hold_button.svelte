<script>
    import { onDestroy } from 'svelte';
    import { playSound } from '$lib/state/sound.js';
    import { motionDuration } from '$lib/state/motion.js';

    let {
        text = 'Hold to confirm',
        duration = 1000,
        oncomplete = null,
        iconOnly = false,
        sound = 'click'
    } = $props();

    let isHolding = $state(false);
    let isComplete = $state(false);
    let button;
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
            oncomplete?.({ type: 'click', detail: 0, currentTarget: button });
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
    bind:this={button}
    type="button"
    aria-label={text}
    class:icon_only={iconOnly}
    class:patter_control_round={iconOnly}
    aria-describedby="hold-button-description"
    onpointerdown={(event) => {
        if (event.button === 0) startHold();
    }}
    onpointerup={cancelHold}
    onpointerleave={cancelHold}
    onpointercancel={cancelHold}
    onkeydown={handleKeydown}
    onkeyup={handleKeyup}
    onblur={cancelHold}
    class="patter_control patter_control_text group/hitbox relative flex w-fit cursor-pointer select-none touch-none items-center patter_font_body"
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
    <span class="relative flex min-h-(--patter_control_height) items-center px-3 py-2 pointer-events-none select-none">
        {#if iconOnly}
            <svg class="reset_icon" class:reset_progress={isHolding || isComplete} style:--hold-duration={`${duration}ms`} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1.5 7M4 4v6h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        {:else}
            {text}
        {/if}
    </span>
    <span id="hold-button-description" class="sr-only">Press and hold for {duration / 1000} seconds to confirm.</span>
</button>

<style>
    .icon_only {
        width: var(--patter_control_height);
        height: var(--patter_control_height);
        justify-content: center;
    }
    .icon_only > .patter_surface,
    .icon_only > .overflow-hidden { border-radius: 50%; }

    .reset_icon {
        transform: rotate(0deg);
        transform-origin: center;
        transform-box: view-box;
        transition: transform var(--patter_motion_standard) ease-out;
    }
    .reset_icon.reset_progress {
        transform: rotate(-360deg);
        transition-duration: var(--hold-duration);
        transition-timing-function: ease-in-out;
    }
    @media (prefers-reduced-motion: reduce) {
        .reset_icon, .reset_icon.reset_progress { transform: none; transition: none; }
    }

    .hold_progress {
        width: 100%;
        transition-duration: var(--hold-duration);
    }
</style>
