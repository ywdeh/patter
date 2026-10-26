<script>
    import { onMount, tick } from 'svelte';
    import { playSound } from '$lib/state/sound.js';
    import { motionDuration } from '$lib/state/motion.js';

    let { text = 'Save', options = [], onselect = null, onexport = null, disabled = false, sound = 'click', ariaLabel = 'Save options' } = $props();
    const menu_id = $props.id();
    let trigger;
    let menu = $state(null);
    let open = $state(false);
    let close_timer;
    let position = $state({ top: 0, left: 0, minWidth: 0 });

    function cancel_close() { clearTimeout(close_timer); }
    function close_menu() { cancel_close(); open = false; }
    function schedule_close() {
        cancel_close();
        close_timer = window.setTimeout(() => {
            if (!menu?.contains(document.activeElement) && !trigger?.matches(':focus-visible')) close_menu();
        }, motionDuration('short', 150));
    }
    function position_menu() {
        if (!trigger || !menu) return;
        const rect = trigger.getBoundingClientRect();
        const bounds = menu.getBoundingClientRect();
        const width = Math.max(rect.width, bounds.width);
        position = {
            left: Math.max(8, Math.min(innerWidth - width - 8, rect.right - width)),
            top: rect.bottom + 12 + bounds.height <= innerHeight - 8 ? rect.bottom + 12 : Math.max(8, rect.top - bounds.height - 12),
            minWidth: rect.width
        };
    }
    async function open_menu(focus = false) {
        cancel_close();
        if (disabled) return;
        open = true;
        await tick();
        if (!open || disabled) return;
        position_menu();
        if (focus) menu?.querySelector('button')?.focus();
    }
    function toggle_menu(event) {
        if (disabled) return;
        playSound(sound);
        if (open) close_menu();
        else void open_menu(event.detail === 0);
    }
    function choose(option) {
        if (disabled) return;
        close_menu();
        trigger?.focus({ preventScroll: true });
        playSound(sound);
        onselect?.(option.value, option);
        onexport?.(option.value, option);
    }
    function portal(node) {
        document.body.append(node);
        return { destroy() { node.remove(); } };
    }
    function menu_key(event) {
        if (event.key === 'Tab') {
            close_menu();
            trigger?.focus({ preventScroll: true });
            if (event.shiftKey) event.preventDefault();
            return;
        }
        const buttons = Array.from(menu?.querySelectorAll('button') ?? []);
        const index = buttons.indexOf(document.activeElement);
        let next;
        if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
        else if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = buttons.length - 1;
        else return;
        event.preventDefault();
        buttons[next]?.focus();
    }
    $effect(() => { if (disabled) close_menu(); });
    onMount(() => {
        function outside(event) {
            if (!trigger?.contains(event.target) && !menu?.contains(event.target)) close_menu();
        }
        function escape(event) {
            if (event.key === 'Escape' && open) { close_menu(); trigger?.focus({ preventScroll: true }); }
        }
        function viewport() { if (open) position_menu(); }
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape);
        window.addEventListener('resize', viewport);
        window.addEventListener('scroll', viewport, true);
        return () => {
            cancel_close();
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('keydown', escape);
            window.removeEventListener('resize', viewport);
            window.removeEventListener('scroll', viewport, true);
        };
    });
</script>

<button bind:this={trigger} type="button" {disabled} aria-label={ariaLabel} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menu_id : undefined}
    class="patter_control patter_control_text group/hitbox relative inline-flex min-h-(--patter_control_height) items-center gap-2 px-3 py-2 cursor-pointer disabled:cursor-default disabled:pointer-events-none"
    onclick={toggle_menu} onpointerenter={(event) => { if (event.pointerType === 'mouse') void open_menu(); }} onpointerleave={schedule_close}
    onkeydown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); void open_menu(true); } }}>
    <span aria-hidden="true" class="patter_surface patter_hover {disabled ? '' : 'patter_active'} absolute inset-0 rounded-xl patter_surface_gradient"></span>
    <span class="relative pointer-events-none">{text}</span>
    <svg class="save_chevrons patter_icon relative size-4 pointer-events-none" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m5 5 3-3 3 3m-6 6 3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
</button>
{#if open}
    <div bind:this={menu} use:portal id={menu_id} role="menu" tabindex="-1" aria-label="Save format" class="patter_control_text fixed z-500 min-w-max rounded-xl p-1"
        style={`top:${position.top}px;left:${position.left}px;min-width:${position.minWidth}px`}
        onpointerenter={cancel_close} onpointerleave={schedule_close} onkeydown={menu_key} onfocusout={schedule_close}>
        <span aria-hidden="true" class="patter_surface pointer-events-none absolute inset-0 rounded-xl patter_surface_gradient"></span>
        {#each options as option (option.value)}
            <button type="button" role="menuitem" tabindex="-1" class="relative block w-full whitespace-nowrap rounded-lg px-3 py-2 text-left cursor-pointer transition-colors hover:bg-(--patter_surface_normal)" onclick={() => choose(option)}>{option.menuLabel ?? option.label}</button>
        {/each}
    </div>
{/if}

<style>
    .patter_control:active .save_chevrons { scale: 1; }
</style>
