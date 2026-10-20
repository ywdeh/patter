<script>
    import { can_use_wheel_controls } from '$lib/state/user_interaction.js';
    import { untrack } from "svelte";
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
        holdInterval = 200,
        trueLabel = "On",
        falseLabel = "Off",
        ontrue = null,
        onfalse = null,
        onchange = null,
        sound = 'click'
    } = $props();
    const initialValue = untrack(() => value);
    const resetTo = $derived(clamp(defaultValue ?? initialValue));
    const displayValue = $derived(displayValues?.[value] ?? `${value}${unit}`);

    let holdTimer = null;
    let holdStarted = false;
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

    async function setToggle(next, event) {
        if (togglePending || event?.type !== "click" || !event.isTrusted || next === value) return;

        togglePending = true;
        try {
            playClick();
            direction = next ? 1 : -1;
            const actionResult = (next ? ontrue : onfalse)?.();
            if (actionResult instanceof Promise && await actionResult === false) return;

            value = next;
            onchange?.(next);
        } finally {
            togglePending = false;
        }
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

    function handleWheel(event) {
        if (!can_use_wheel_controls(event)) return;
        if (mode === "toggle") return;
        event.preventDefault();
        if (wheelOnCooldown) return;

        const delta = event.deltaY * (event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? window.innerHeight : 1);
        wheelRemainder -= delta;

        if (Math.abs(wheelRemainder) >= 5) {
            const direction = Math.sign(wheelRemainder);
            const previousValue = value;
            step_(direction * step);
            wheelRemainder = 0;
            if (value !== previousValue) {
                wheelPressedDirection = direction;
                clearTimeout(wheelAnimationTimer);
                wheelAnimationTimer = setTimeout(() => {
                    wheelPressedDirection = 0;
                    wheelAnimationTimer = null;
                }, outDuration);
            }
            wheelOnCooldown = true;
            wheelCooldownTimer = setTimeout(() => {
                wheelOnCooldown = false;
                wheelCooldownTimer = null;
            }, wheelCooldownDuration);
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

    function reset(playSound = true) {
        if (resetTo !== value) {
            if (playSound) playClick();
            direction = resetTo > value ? 1 : -1;
            value = resetTo;
            onchange?.(resetTo);
        }
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

<div role="group" aria-label={text ?? 'Setting controls'} class="flex gap-3 items-center w-full">
    <p class="flex-1">{text}</p>
    {#if mode === "toggle"}
    <div class="flex flex-[1.5] gap-3 justify-between items-center bg-linear-to-r from-mauve-100/0 via-mauve-100/12 to-mauve-100/0 rounded-full text-center">
        <button
            onclick={(event) => setToggle(false, event)}
            disabled={!value}
            class="patter_control patter_control_round group transition h-(--patter_pill_height) aspect-square shrink-0 group/inputpill flex items-center justify-center relative cursor-pointer  disabled:pointer-events-none">
            <span aria-hidden="true" class="patter_surface patter_hover patter_active absolute inset-0 rounded-full bg-linear-to-b from-mauve-100/6 to-mauve-100/0"></span>
            <span class="flex items-center gap-2 relative px-2 pointer-events-none">
                <img src="/chevron_left.svg" alt={falseLabel} class="size-4">
            </span>
        </button>

        <div class="min-w-14 h-6 relative overflow-hidden">
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
            onclick={(event) => setToggle(true, event)}
            disabled={value}
            class="patter_control patter_control_round group transition h-(--patter_pill_height) aspect-square shrink-0 group/inputpill flex items-center justify-center relative cursor-pointer  disabled:pointer-events-none">
            <span aria-hidden="true" class="patter_surface patter_hover patter_active absolute inset-0 rounded-full bg-linear-to-b from-mauve-100/6 to-mauve-100/0"></span>
            <span class="flex items-center gap-2 relative px-2 pointer-events-none">
                <img src="/chevron_right.svg" alt={trueLabel} class="size-4">
            </span>
        </button>
    </div>
    {:else}
    <div class="flex flex-[1.5] gap-3 justify-between items-center bg-linear-to-r from-mauve-100/0 via-mauve-100/12 to-mauve-100/0 rounded-full text-center">
        <button
            onclick={() => handleClick(-step)}
            onpointerdown={() => startHold(-step)}
            onpointerup={endHold}
            onpointerleave={endHold}
            disabled={value <= min}
            class:wheel_pressed={wheelPressedDirection === -1}
            class="patter_control patter_control_round group transition h-(--patter_pill_height) aspect-square shrink-0 group/inputpill flex items-center justify-center relative cursor-pointer  disabled:pointer-events-none">
            <span
                aria-hidden="true"
                class="patter_surface patter_hover patter_active absolute inset-0 rounded-full bg-linear-to-b from-mauve-100/6 to-mauve-100/0">
            </span>

            <span class="flex items-center gap-2 relative px-2 pointer-events-none">
                <img src="/chevron_left.svg" alt="decrease" class="size-4">
            </span>
        </button>

        <div class="min-w-16 h-6 relative overflow-hidden" role="button" tabindex="0" aria-label={`${displayValue}; press Enter or Space, or double-click, to reset to default`} onclick={playResetClick} onkeydown={handleValueKeydown} ondblclick={() => reset(false)} {@attach attachNonPassiveWheel}>
            {#key value}
                <p
                    class="absolute inset-0"
                    in:fly={{ x: direction * 20, duration: inDuration, delay: outDuration }}
                    out:fly={{ x: direction * -20, duration: outDuration }}
                >
                    {displayValue}
                </p>
            {/key}
        </div>

        <button
            onclick={() => handleClick(step)}
            onpointerdown={() => startHold(step)}
            onpointerup={endHold}
            onpointerleave={endHold}
            disabled={value >= max}
            class:wheel_pressed={wheelPressedDirection === 1}
            class="patter_control patter_control_round group transition h-(--patter_pill_height) aspect-square shrink-0 group/inputpill flex items-center justify-center relative cursor-pointer  disabled:pointer-events-none">
            <span
                aria-hidden="true"
                class="patter_surface patter_hover patter_active absolute inset-0 rounded-full bg-linear-to-b from-mauve-100/6 to-mauve-100/0">
            </span>

            <span class="flex items-center gap-2 relative px-2 pointer-events-none">
                <img src="/chevron_right.svg" alt="increase" class="size-4">
            </span>
        </button>

        <button
            onclick={() => reset()}
            disabled={value === resetTo}
            aria-label="Reset to default"
            class="patter_control patter_control_round group transition h-6 aspect-square shrink-0 group/inputpill flex items-center justify-center relative cursor-pointer  disabled:pointer-events-none">
            <span
                aria-hidden="true"
                class="patter_surface patter_hover patter_active absolute inset-0 rounded-full bg-linear-to-b from-mauve-100/6 to-mauve-100/0">
            </span>

            <span class="flex items-center gap-2 px-1 relative pointer-events-none">
                <img src="/undo.svg" alt="" class="size-5">
            </span>
        </button>
    </div>
    {/if}
</div>
