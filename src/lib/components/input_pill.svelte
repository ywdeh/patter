<script>
    import { fit_label } from '$lib/state/fit_label.js';
    import { can_use_wheel_controls } from '$lib/state/user_interaction.js';
    import { onDestroy, untrack } from "svelte";
    import { fly } from "svelte/transition";
    import { playSound } from '$lib/state/sound.js';
    import { motionDuration } from '$lib/state/motion.js';

    let {
        text = null,
        value = $bindable(60),
        mode = "stepper",
        defaultValue = null,
        min = 0,
        max = 100,
        step = 10,
        unit = "",
        displayValues = null,
        displayFonts = null,
        holdInterval = 200,
        trueLabel = "On",
        falseLabel = "Off",
        ontrue = null,
        onfalse = null,
        onchange = null,
        sound = 'click'
    } = $props();
    const initialValue = untrack(() => value);
    const resetTo = $derived(mode === "toggle" ? Boolean(defaultValue ?? initialValue) : clamp(defaultValue ?? initialValue));
    const lower = $derived(mode === 'toggle' ? 0 : min);
    const upper = $derived(mode === 'toggle' ? 1 : max);
    const increment = $derived(mode === 'toggle' ? 1 : step);
    const displayValue = $derived(mode === 'toggle' ? (value ? trueLabel : falseLabel) : displayValues?.[value] ?? `${value}${unit}`);

    let holdTimer = null;
    let holdStarted = false;
    let holdResetTimer = null;
    let togglePending = $state(false);
    let direction = $state(1);
    let wheelRemainder = 0;
    let wheelOnCooldown = false;
    let wheelCooldownTimer = null;
    let wheelPressedDirection = $state(0);
    let wheelAnimationTimer = null;

    const outDuration = motionDuration('quick', 100);
    const inDuration = motionDuration('short', 150);
    const wheelCooldownDuration = motionDuration('short', 150);

    function playClick() {
        playSound(sound);
    }

    async function set_value(next, audible = true) {
        if (togglePending || next === value) return false;
        const previous = value;
        if (audible) playClick();
        direction = Number(next) > Number(previous) ? 1 : -1;
        if (mode === 'toggle') {
            togglePending = true;
            try {
                if (await (next ? ontrue : onfalse)?.() === false) return false;
                value = next;
                onchange?.(next);
            } finally { togglePending = false; }
        } else {
            value = next;
            onchange?.(next);
        }
        return true;
    }

    function clamp(v) {
        return Math.min(max, Math.max(min, v));
    }

    function step_(delta) {
        const next = mode === 'toggle' ? delta > 0 : clamp(value + delta);
        return set_value(next);
    }

    async function handleWheel(event) {
        if (!can_use_wheel_controls(event)) return;
        event.preventDefault();
        if (wheelOnCooldown || togglePending) return;
        const delta = event.deltaY * (event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? window.innerHeight : 1);
        wheelRemainder -= delta;
        if (Math.abs(wheelRemainder) < 5) return;
        const wheel_direction = Math.sign(wheelRemainder);
        wheelRemainder = 0;
        wheelOnCooldown = true;
        wheelCooldownTimer = setTimeout(() => {
            wheelOnCooldown = false;
            wheelCooldownTimer = null;
        }, wheelCooldownDuration);
        if (await step_(wheel_direction * increment)) {
            wheelPressedDirection = wheel_direction;
            clearTimeout(wheelAnimationTimer);
            wheelAnimationTimer = setTimeout(() => {
                wheelPressedDirection = 0;
                wheelAnimationTimer = null;
            }, outDuration);
        }
    }

    function attachNonPassiveWheel(node) {
        node.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            node.removeEventListener('wheel', handleWheel);
            clearTimeout(wheelCooldownTimer);
            clearTimeout(wheelAnimationTimer);
        };
    }

    function reset(audible = true) {
        void set_value(resetTo, audible);
    }

    function playResetClick() {
        if (value !== resetTo) playClick();
    }

    function handleValueKeydown(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        reset();
    }

    function startHold(delta) {
        clearInterval(holdTimer);
        clearTimeout(holdResetTimer);
        holdStarted = false;

        holdTimer = setInterval(() => {
            holdStarted = true;
            void step_(delta);
            if (Number(value) <= lower || Number(value) >= upper) {
                clearInterval(holdTimer);
                holdTimer = null;
            }
        }, holdInterval);
    }

    function endHold() {
        clearInterval(holdTimer);
        holdTimer = null;
        clearTimeout(holdResetTimer);
        holdResetTimer = setTimeout(() => (holdStarted = false), 0);
    }

    function handleClick(delta) {
        if (holdStarted) return;
        void step_(delta);
    }

    onDestroy(() => {
        clearInterval(holdTimer);
        clearTimeout(holdResetTimer);
        clearTimeout(wheelCooldownTimer);
        clearTimeout(wheelAnimationTimer);
    });

</script>

{#snippet chevron(direction)}
    <span aria-hidden="true" class="patter_icon patter_mask_icon size-4" style={`mask-image: url(/chevron_${direction}.svg); -webkit-mask-image: url(/chevron_${direction}.svg)`}></span>
{/snippet}

{#snippet reset_control()}
        <button data-ui-hover-sound={Boolean(sound)}
            onclick={() => reset()}
            disabled={value === resetTo || togglePending}
            aria-label="Reset to default"
            class="patter_control patter_control_round group transition size-6 shrink-0 group/inputpill flex items-center justify-center relative cursor-pointer  disabled:pointer-events-none">
            <span
                aria-hidden="true"
                class="patter_surface patter_hover patter_active absolute inset-0 rounded-full patter_surface_gradient">
            </span>

            <span class="relative flex size-4 shrink-0 items-center justify-center pointer-events-none">
                <svg class="patter_icon size-4 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 10a8 8 0 1 0-1.5 7M20 4v6h-6" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </span>
        </button>
{/snippet}

<svelte:window onblur={endHold} />

<div data-setting-control role="group" aria-label={text ?? 'Setting controls'} class="flex gap-3 items-center w-full">
    <p class="flex-1 patter_font_body">{text}</p>

    <div class="flex flex-[1.5] gap-3 justify-between items-center patter_pill_gradient rounded-full text-center">
        <button data-ui-hover-sound={Boolean(sound)}
            aria-label={mode === "toggle" ? `${text ?? "Setting"}: ${falseLabel}` : `Decrease ${text ?? "value"}`}
            onclick={() => handleClick(-increment)}
            onpointerdown={(event) => { if (event.button === 0) startHold(-increment); }}
            onpointerup={endHold}
            onpointerleave={endHold}
            onpointercancel={endHold}
            onblur={endHold}
            disabled={Number(value) <= lower || togglePending}
            class:wheel_pressed={wheelPressedDirection === -1}
            class="patter_control patter_control_round group transition h-(--patter_pill_height) aspect-square shrink-0 group/inputpill flex items-center justify-center relative cursor-pointer  disabled:pointer-events-none">
            <span
                aria-hidden="true"
                class="patter_surface patter_hover patter_active absolute inset-0 rounded-full patter_surface_gradient">
            </span>

            <span class="flex items-center gap-2 relative px-2 pointer-events-none">
                {@render chevron("left")}
            </span>
        </button>

        <div class="min-w-16 h-6 relative overflow-hidden rounded-full" style="--patter_focus_radius: 9999px" role="button" tabindex="0" aria-label={`${displayValue}; press Enter or Space, or double-click, to reset to default`} onclick={playResetClick} onkeydown={handleValueKeydown} ondblclick={() => reset(false)} {@attach attachNonPassiveWheel}>
            {#key value}
                <p
                    class="absolute inset-0 patter_font_ui"
                    style:font-family={displayFonts?.[value]}
                    use:fit_label={{ value, font: displayFonts?.[value] }}
                    in:fly={{ x: direction * 20, duration: inDuration, delay: outDuration }}
                    out:fly={{ x: direction * -20, duration: outDuration }}
                >
                    {displayValue}
                </p>
            {/key}
        </div>

        <button data-ui-hover-sound={Boolean(sound)}
            aria-label={mode === "toggle" ? `${text ?? "Setting"}: ${trueLabel}` : `Increase ${text ?? "value"}`}
            onclick={() => handleClick(increment)}
            onpointerdown={(event) => { if (event.button === 0) startHold(increment); }}
            onpointerup={endHold}
            onpointerleave={endHold}
            onpointercancel={endHold}
            onblur={endHold}
            disabled={Number(value) >= upper || togglePending}
            class:wheel_pressed={wheelPressedDirection === 1}
            class="patter_control patter_control_round group transition h-(--patter_pill_height) aspect-square shrink-0 group/inputpill flex items-center justify-center relative cursor-pointer  disabled:pointer-events-none">
            <span
                aria-hidden="true"
                class="patter_surface patter_hover patter_active absolute inset-0 rounded-full patter_surface_gradient">
            </span>

            <span class="flex items-center gap-2 relative px-2 pointer-events-none">
                {@render chevron("right")}
            </span>
        </button>

        {@render reset_control()}
    </div>
</div>
