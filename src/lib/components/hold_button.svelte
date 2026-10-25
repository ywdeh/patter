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
    let rotation_complete = $state(false);
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
        rotation_complete = false;
        isHolding = true;
        holdTimer = window.setTimeout(() => {
            isHolding = false;
            isComplete = true;
            rotation_complete = true;
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
            class="block h-full bg-(--patter_surface_fill) transition-[width] ease-linear"
            class:w-full={isComplete}
            class:w-0={!isHolding && !isComplete}
            class:hold_progress={isHolding}
            style:--hold-duration={`${duration}ms`}
        ></span>
    </span>
    <span
        class="patter_surface patter_hover patter_active absolute inset-0 rounded-xl patter_surface_gradient"
    ></span>
    {#if iconOnly}
        <span class="hold_ring patter_hover patter_active absolute inset-0 pointer-events-none" aria-hidden="true"><svg width="100%" height="100%" viewBox="0 0 40 40" fill="none" style="overflow: visible">
            <circle class:ring_progress={isHolding || isComplete} style:--hold-duration={`${duration}ms`} cx="20" cy="20" r="20" pathLength="1" />
        </svg></span>
    {/if}
    <span class="relative flex min-h-(--patter_control_height) items-center px-3 py-2 pointer-events-none select-none">
        {#if iconOnly}
            <svg class="reset_icon patter_icon" class:reset_progress={isHolding || isComplete} class:rotation_complete style:--hold-duration={`${duration}ms`} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 10a8 8 0 1 0-1.5 7M20 4v6h-6" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" /></svg>
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

    .hold_ring {
        outline: none !important;
        width: auto;
        height: auto;
        overflow: visible;
        border-radius: 50%;
    }
    .hold_ring svg {
        position: absolute;
        inset: -3px;
        width: calc(100% + 6px);
        height: calc(100% + 6px);
    }
    .hold_ring circle {
        stroke: var(--patter_color_text);
        stroke-width: 2px;
        vector-effect: non-scaling-stroke;
        stroke-linecap: round;
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
        opacity: 0;
        transform: rotate(-90deg);
        transform-origin: center;
        transition: stroke-dashoffset var(--patter_motion_standard) ease-out, opacity var(--patter_motion_standard) ease-out;
    }
    .hold_ring circle.ring_progress {
        opacity: var(--patter_opacity_subtle);
        stroke-dashoffset: 0;
        transition-duration: var(--hold-duration), var(--patter_motion_standard);
        transition-timing-function: linear, ease-out;
    }

    .reset_icon {
        transform: rotate(0deg);
        transform-origin: center;
        transform-box: view-box;
        transition: transform var(--patter_motion_standard) ease-out, opacity var(--patter_motion_standard) ease-out, scale var(--patter_motion_standard) ease-out;
    }
    .reset_icon.reset_progress {
        transform: rotate(360deg);
        transition-duration: var(--hold-duration), var(--patter_motion_standard), var(--patter_motion_standard);
        transition-timing-function: ease-in-out, ease-out, ease-out;
    }
    .reset_icon.rotation_complete:not(.reset_progress) {
        transition-duration: 0ms, var(--patter_motion_standard), var(--patter_motion_standard);
    }
    @media (prefers-reduced-motion: reduce) {
        .reset_icon, .reset_icon.reset_progress { transform: none; transition: none; }
    }

    .hold_progress {
        width: 100%;
        transition-duration: var(--hold-duration);
    }
</style>
