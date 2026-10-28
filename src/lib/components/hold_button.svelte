<script>
    import { smooth_width } from '$lib/state/smooth_width.js';
    import { onDestroy } from 'svelte';
    import { playSound } from '$lib/state/sound.js';
    import { motionDuration } from '$lib/state/motion.js';

    let {
        text = 'Hold to confirm',
        duration = 1000,
        oncomplete = null,
        iconOnly = false,
        icon = 'reset',
        compact = false,
        disabled = false,
        role = undefined,
        tabindex = undefined,
        onfocus = null,
        onpointerenter = null,
        sound = 'click'
    } = $props();

    const minimum_progress = 0.33;
    const component_id = $props.id();
    const description_id = `${component_id}-description`;
    let shift_down = $state(false);
    let progress = $state(0);
    const visual_progress = $derived(progress);
    const close_radius = $derived(3.5 * (1 - visual_progress));
    let phase = $state('idle');
    let button;
    let frame = 0;
    let completion_timer;
    let last_frame = 0;
    let pointer_id = null;
    let active_key = null;
    let return_started = 0;
    let return_progress = 0;

    function begin_return(now) {
        phase = 'returning';
        return_started = now;
        return_progress = progress;
    }

    async function finish() {
        phase = 'complete';
        pointer_id = null;
        active_key = null;
        completion_timer = window.setTimeout(() => {
            progress = 0;
            phase = 'idle';
        }, motionDuration('slow', 400));
        await oncomplete?.({ type: 'click', detail: 0, currentTarget: button, shiftKey: shift_down });
        if (sound) playSound(sound);
    }

    function advance(now) {
        frame = 0;
        const step = Math.max(0, now - last_frame) / Math.max(1, duration);
        last_frame = now;
        if (phase === 'holding') {
            progress = Math.min(1, progress + step);
            if (progress === 1) { void finish(); return; }
        } else if (phase === 'preview') {
            progress = Math.min(minimum_progress, progress + step);
            if (progress === minimum_progress) begin_return(now);
        } else if (phase === 'returning') {
            const elapsed = Math.min(1, (now - return_started) / Math.max(1, return_progress * duration * 1.7));
            progress = return_progress * (1 - elapsed) ** 3;
            if (progress === 0) { phase = 'idle'; return; }
        } else return;
        frame = requestAnimationFrame(advance);
    }

    function press() {
        if (disabled || phase === 'holding' || phase === 'complete') return false;
        phase = 'holding';
        if (!frame) {
            last_frame = performance.now();
            frame = requestAnimationFrame(advance);
        }
        return true;
    }

    function release() {
        pointer_id = null;
        active_key = null;
        if (phase !== 'holding') return;
        if (progress < minimum_progress) phase = 'preview';
        else begin_return(performance.now());
    }

    function pointer_down(event) {
        shift_down = event.shiftKey;
        if (event.button !== 0 || active_key !== null || !press()) return;
        pointer_id = event.pointerId;
    }

    function pointer_end(event) {
        if (event.pointerId === pointer_id) release();
    }

    function key_down(event) {
        if (![' ', 'Enter'].includes(event.key)) return;
        event.preventDefault();
        if (event.repeat || pointer_id !== null || !press()) return;
        active_key = event.key;
    }

    function key_up(event) {
        if (event.key !== active_key) return;
        event.preventDefault();
        release();
    }

    onDestroy(() => {
        if (frame) cancelAnimationFrame(frame);
        clearTimeout(completion_timer);
    });
</script>

<svelte:window onkeydown={(event) => { shift_down = event.shiftKey; }} onkeyup={(event) => { shift_down = event.shiftKey; }} onblur={() => { shift_down = false; release(); }} onpointerup={pointer_end} onpointercancel={pointer_end} />

<button use:smooth_width={!iconOnly} data-ui-hover-sound={Boolean(sound)}
    bind:this={button}
    type="button"
    {disabled} {role} {tabindex} {onfocus} {onpointerenter}
    class:compact
    aria-label={text}
    class:icon_only={iconOnly}
    class:patter_control_round={iconOnly}
    aria-describedby={description_id}
    onpointerdown={pointer_down}
    onpointerleave={pointer_end}
    onkeydown={key_down}
    onkeyup={key_up}
    onblur={release}
    class="patter_control patter_text_main group/hitbox relative flex w-fit cursor-pointer select-none touch-none items-center"
>
    <span aria-hidden="true" class="patter_surface patter_hover patter_active absolute inset-0 rounded-xl patter_surface_gradient">
        <span class="fill_clip hold_progress absolute inset-0 overflow-hidden" class:completed={phase === 'complete'}>
            <span class="hold_fill block h-full bg-(--patter_surface_fill)"
                style:width={iconOnly ? '100%' : `${visual_progress * 100}%`}
                style:--hold-angle={`${visual_progress * 360}deg`}></span>
        </span>
        {#if iconOnly}
            <span class="hold_ring hold_progress absolute inset-0 pointer-events-none" class:completed={phase === 'complete'}><svg width="100%" height="100%" fill="none" style="overflow: visible">
                <circle style:stroke-dashoffset={1 - visual_progress} style:opacity={progress > 0 ? 'var(--patter_opacity_subtle)' : 0} cx="50%" cy="50%" r="50%" pathLength="1" />
            </svg></span>
        {/if}
    </span>
    <span data-control-content class="hold_content relative flex w-max shrink-0 min-h-(--patter_control_height) items-center px-3 py-2 pointer-events-none select-none">
        {#if iconOnly && icon === 'close'}
            <svg class="patter_icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d={`M${8 - close_radius} ${8 - close_radius}L${8 + close_radius} ${8 + close_radius}M${8 + close_radius} ${8 - close_radius}L${8 - close_radius} ${8 + close_radius}`} stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        {:else if iconOnly}
            <svg class="reset_icon patter_icon" style:transform={`rotate(${visual_progress * 360}deg)`} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 10a8 8 0 1 0-1.5 7M20 4v6h-6" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" /></svg>
        {:else}
            {text}
        {/if}
    </span>
    <span id={description_id} class="sr-only">Press and hold for {duration / 1000} seconds to confirm.</span>
</button>

<style>
    .icon_only {
        width: var(--patter_control_height);
        height: var(--patter_control_height);
        justify-content: center;
    }
    .icon_only.compact { width: 1.5rem; height: 1.5rem; flex-shrink: 0; }
    .compact > .hold_content { min-height: 0; padding: 0; }
    .icon_only > .patter_surface { border-radius: 50%; }
    .fill_clip { border-radius: inherit; pointer-events: none; }

    .hold_progress { transition: opacity var(--patter_motion_slow) ease-out; }
    .hold_progress.completed { opacity: 0; }

    .hold_ring svg {
        position: absolute;
        inset: -3px;
        width: calc(100% + 6px);
        height: calc(100% + 6px);
    }
    .hold_ring circle {
        stroke: var(--patter_color_text);
        stroke-width: 2px;
        stroke-linecap: round;
        stroke-dasharray: 1;
        transform: rotate(-90deg);
        transform-origin: center;
    }
    .reset_icon {
        transform-origin: center;
        transform-box: view-box;
        transition: opacity var(--patter_motion_standard) ease-out, scale var(--patter_motion_standard) ease-out;
    }
    .hold_fill { transition: none; }
    .icon_only .hold_fill {
        border-radius: 50%;
        background: conic-gradient(var(--patter_surface_fill) 0deg var(--hold-angle), transparent var(--hold-angle) 360deg);
    }
    @media (prefers-reduced-motion: reduce) { .reset_icon { transform: none !important; } }

</style>
