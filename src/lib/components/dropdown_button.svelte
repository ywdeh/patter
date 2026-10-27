<script>
    import HoldButton from './hold_button.svelte';
    import { onMount, tick } from 'svelte';
    import { playSound } from '$lib/state/sound.js';
    import { motionDuration } from '$lib/state/motion.js';

    let { text = 'Save', options = [], onselect = null, onexport = null, onopen = null, onpreview = null, ondismiss = null, menuWidth = null, disabled = false, sound = 'click', ariaLabel = 'Save options' } = $props();
    const menu_id = $props.id();
    let keyboard_open = false;
    let trigger = $state();
    let menu = $state(null);
    let open = $state(false);
    let dismissing = $state(null);
    let close_timer;
    let position_frame = 0;
    let position = $state({ top: 0, left: 0, minWidth: 0, maxHeight: null });

    function cancel_close() { clearTimeout(close_timer); }
    function close_menu() {
        cancel_close();
        open = false;
        onpreview?.(null);
    }
    function schedule_close() {
        cancel_close();
        close_timer = window.setTimeout(() => {
            if (!menu?.contains(document.activeElement) && !trigger?.matches(':focus-visible')) close_menu();
        }, motionDuration('short', 150));
    }
    function schedule_position() {
        if (!open || position_frame) return;
        position_frame = requestAnimationFrame(() => {
            position_frame = 0;
            if (open) position_menu();
        });
    }
    function position_menu() {
        if (!trigger || !menu) return;
        const rect = trigger.getBoundingClientRect();
        const viewport = window.visualViewport;
        const view_left = viewport?.offsetLeft ?? 0;
        const view_top = viewport?.offsetTop ?? 0;
        const view_width = viewport?.width ?? innerWidth;
        const view_height = viewport?.height ?? innerHeight;
        const width = Math.min(Math.max(rect.width, menu.offsetWidth), view_width - 16);
        const natural_height = menu.querySelector('.dropdown_choices')?.scrollHeight + 8 || menu.offsetHeight;
        const below = Math.max(0, view_top + view_height - rect.bottom - 20);
        const above = Math.max(0, rect.top - view_top - 20);
        const opens_above = below < natural_height && above > below;
        const max_height = Math.max(0, opens_above ? above : below);
        position = {
            left: Math.max(view_left + 8, Math.min(view_left + view_width - width - 8, rect.right - width)),
            top: opens_above ? Math.max(view_top + 8, rect.top - Math.min(natural_height, max_height) - 12) : rect.bottom + 12,
            minWidth: Math.min(rect.width, width),
            maxHeight: max_height
        };

    }
    async function open_menu(focus = false) {
        cancel_close();
        if (disabled) return;
        if (open) { if (focus) menu?.querySelector('button')?.focus(); return; }
        keyboard_open = focus;
        open = true;
        await tick();
        if (!open || disabled) return;
        position_menu();
        if (focus) menu?.querySelector('button')?.focus();
        await onopen?.();
        await tick();
        if (open && !disabled) position_menu();
    }
    function menu_motion(node) {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        return {
            duration: keyboard_open ? 0 : motionDuration('standard', 200),
            easing: (t) => 1 - Math.pow(1 - t, 3),
            css: (t) => `opacity: ${t}; transform: translateY(calc(var(--dropdown-enter-y, 4px) * ${reduced ? 0 : 1 - t}))`
        };
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
    async function dismiss(option, event) {
        event.preventDefault?.();
        event.stopPropagation?.();
        if (!ondismiss || dismissing !== null) return;
        const buttons = [...menu.querySelectorAll('button')];
        const focused = menu.contains(document.activeElement);
        const index = buttons.indexOf(event.currentTarget);
        dismissing = option.value;
        try {
            await ondismiss(option.value, option);
            await tick();
            if (open && focused) {
                const remaining = [...menu.querySelectorAll('button:not(:disabled)')];
                remaining[Math.min(Math.max(0, index - 1), remaining.length - 1)]?.focus({ preventScroll: true });
            }
            schedule_position();
        } finally { dismissing = null; }
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
    $effect(() => {
        if (!menu) return;
        const observer = new ResizeObserver(schedule_position);
        observer.observe(menu);
        return () => observer.disconnect();
    });
    onMount(() => {
        function outside(event) {
            if (!trigger?.contains(event.target) && !menu?.contains(event.target)) close_menu();
        }
        function escape(event) {
            if (event.key === 'Escape' && open) { close_menu(); trigger?.focus({ preventScroll: true }); }
        }
        const viewport = schedule_position;
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape);
        window.addEventListener('resize', viewport);
        window.visualViewport?.addEventListener('resize', viewport);
        window.visualViewport?.addEventListener('scroll', viewport);
        window.addEventListener('scroll', viewport, true);
        return () => {
            close_menu();
            cancelAnimationFrame(position_frame);
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('keydown', escape);
            window.removeEventListener('resize', viewport);
            window.visualViewport?.removeEventListener('resize', viewport);
            window.visualViewport?.removeEventListener('scroll', viewport);
            window.removeEventListener('scroll', viewport, true);
        };
    });
</script>

<button data-ui-hover-sound={Boolean(sound)} bind:this={trigger} type="button" {disabled} aria-label={ariaLabel} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menu_id : undefined}
    class="patter_control patter_control_text group/hitbox relative inline-flex min-h-(--patter_control_height) items-center gap-2 px-3 py-2 cursor-pointer disabled:cursor-default disabled:pointer-events-none"
    onclick={toggle_menu} onpointerenter={(event) => { if (event.pointerType === 'mouse') void open_menu(); }} onpointerleave={schedule_close}
    onkeydown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); void open_menu(true); } }}>
    <span aria-hidden="true" class="patter_surface patter_hover {disabled ? '' : 'patter_active'} absolute inset-0 rounded-xl patter_surface_gradient"></span>
    <span class="relative pointer-events-none">{text}</span>
    <svg class="save_chevrons patter_icon relative size-4 pointer-events-none" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m5 5 3-3 3 3m-6 6 3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
</button>
{#if open}
    <div bind:this={menu} use:portal data-patter-panel="1" id={menu_id} role="menu" tabindex="-1" aria-label={ariaLabel} class="dropdown_menu patter_control_text fixed z-500 rounded-xl p-1" inert={!open} transition:menu_motion
        style={`top:${position.top}px;left:${position.left}px;min-width:${position.minWidth}px;width:${menuWidth ?? 'max-content'};--dropdown-max-height:${position.maxHeight === null ? 'calc(var(--patter_viewport_height, 100dvh) - 2rem)' : `${position.maxHeight}px`};--dropdown-enter-y:${position.top < (trigger?.getBoundingClientRect().top ?? 0) ? '-4px' : '4px'}`}
        onpointerenter={cancel_close} onpointerleave={schedule_close} onkeydown={menu_key} onfocusout={schedule_close}>
        <span aria-hidden="true" class="patter_surface pointer-events-none absolute inset-0 rounded-xl patter_surface_gradient"></span>
        <div class="dropdown_choices">
        {#each options as option (option.value)}
            {#if option.separator}
                <div class="dropdown_separator" role="separator" aria-label={option.separatorLabel ?? undefined}>
                    {#if option.separatorLabel}<span class="patter_font_ui patter_text_subtle">{option.separatorLabel}</span>{/if}
                </div>
            {/if}
            {#if option.empty}
                <p class="px-3 py-2 opacity-(--patter_opacity_secondary)">{option.label}</p>
            {:else}
            <div class="dropdown_row" role="none">
            <button data-ui-hover-sound={Boolean(sound)} type="button" role="menuitem" tabindex="-1" class="dropdown_item relative block w-full rounded-lg px-3 py-2 text-left cursor-pointer" class:has_timestamp={Boolean(option.meta)} onclick={() => choose(option)}
                onpointerenter={() => onpreview?.(option.value)} onpointerleave={(event) => { if (document.activeElement !== event.currentTarget) onpreview?.(null); }}
                onfocus={() => onpreview?.(option.value)} onblur={(event) => { if (!event.currentTarget.matches(':hover')) onpreview?.(null); }}>
                <span class="dropdown_option_title">{option.menuLabel ?? option.label}</span>{#if option.meta}<span class="dropdown_option_time patter_font_ui patter_text_subtle">{option.meta}</span>{/if}
            </button>
            {#if option.dismissible && ondismiss}
                <div class="dropdown_dismiss" role="none">
                    <HoldButton iconOnly compact icon="close" role="menuitem" tabindex={-1} {sound}
                        text={`Dismiss snapshot ${option.label}${option.meta ? `, ${option.meta}` : ''}`} disabled={dismissing !== null}
                        onpointerenter={() => onpreview?.(null)} onfocus={() => onpreview?.(null)} oncomplete={(event) => dismiss(option, event)} />
                </div>
            {/if}
            </div>
            {/if}
        {/each}
        </div>
    </div>
{/if}

<style>
    .patter_control:active .save_chevrons { scale: 1; }
    .dropdown_menu { max-width: calc(100vw - 1rem); max-height: var(--dropdown-max-height); }
    .dropdown_choices { max-height: max(0px, calc(var(--dropdown-max-height) - 0.5rem)); overflow-y: auto; overscroll-behavior: contain; }
    .dropdown_separator {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0.5rem 0;
        pointer-events: none;
    }
    .dropdown_separator::before, .dropdown_separator::after {
        content: '';
        flex: 1;
        height: 2px;
        background: linear-gradient(to right, transparent, var(--patter_surface_normal));
    }
    .dropdown_separator::after { transform: rotate(180deg); }
    .dropdown_separator > span { flex-shrink: 0; }
    .dropdown_option_title { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
    .has_timestamp .dropdown_option_title {
        width: 8rem;
        max-width: 8rem;
        flex: 0 1 8rem;
        text-overflow: clip;
        -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 1rem), transparent);
        mask-image: linear-gradient(to right, #000 calc(100% - 1rem), transparent);
    }
    .dropdown_option_time { margin-left: auto; padding-left: 0.5rem; flex-shrink: 0; }
    .dropdown_row { display: flex; align-items: stretch; }
    .dropdown_row > .dropdown_item:first-child { flex: 1; min-width: 0; }
    .dropdown_dismiss { align-self: center; margin-inline: 0.25rem; }
    .dropdown_item { display: flex; align-items: baseline; white-space: nowrap; transition: background-color var(--patter_motion_standard) ease; }
    .dropdown_item:hover, .dropdown_item:focus-visible { background: var(--patter_surface_normal); }
    .dropdown_item:active { background: var(--patter_surface_hover); }

</style>
