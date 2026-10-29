<script>
    import { playSound } from '$lib/state/sound.js';

    const label_id = $props.id();
    let { text, value = $bindable(false), disabled = false, onchange = null, sound = 'click' } = $props();

    function toggle() {
        if (disabled) return;
        value = !value;
        onchange?.(value);
        if (sound) playSound(sound);
    }
</script>

<div class="flex min-w-0 items-center justify-between gap-2">
    <span id={label_id} class="min-w-0 flex-1 pointer-events-none patter_font_body">{text}</span>
    <button type="button" role="switch" aria-labelledby={label_id} aria-checked={value} {disabled}
        data-ui-hover-sound={Boolean(sound)} onclick={toggle}
        class="toggle_control patter_control patter_control_round relative flex size-8 shrink-0 cursor-pointer items-center justify-center">
        <span aria-hidden="true" class="patter_surface patter_hover patter_active absolute inset-0 rounded-full patter_surface_gradient"></span>
        <span aria-hidden="true" class="patter_icon relative size-2 pointer-events-none">
            <span class="toggle_dot absolute inset-0 rounded-full bg-current" class:is_on={value}></span>
        </span>
    </button>
</div>

<style>
    @media (hover: none), (pointer: coarse) {
        .toggle_control::after { content: ''; position: absolute; inset: calc(var(--patter_space_3) / -2); border-radius: 50%; }
    }
    .toggle_dot { opacity: 0; transition: opacity var(--patter_motion_standard) ease-out; }
    .toggle_dot.is_on { opacity: 1; }
    @media (hover: hover) and (pointer: fine) {
        .toggle_control:not(:disabled)[aria-checked="false"]:hover .toggle_dot { opacity: var(--patter_opacity_subtle); }
    }
</style>
