<script>
    import { onMount, tick } from 'svelte';
    import { page } from '$app/state';
    import AmbientMixer from './ambient_mixer.svelte';
    import ToggleButton from './toggle_button.svelte';
    import { track_setting } from '$lib/state/analytics.js';
    import { typing_sound_enabled, setTypingSoundEnabled, interaction_sound_enabled, setInteractionSoundEnabled } from '$lib/state/sound_settings.svelte.js';

    let open = $state(false);
    let panel;
    let position = $state({ left: 0, bottom: 0, width: 384, max_height: 600 });

    function place_panel() {
        const trigger = document.querySelector('.music_bar');
        if (!trigger) { open = false; return; }
        const rect = trigger.getBoundingClientRect();
        const viewport = window.visualViewport;
        const left = viewport?.offsetLeft ?? 0;
        const top = viewport?.offsetTop ?? 0;
        const width = Math.min(384, (viewport?.width ?? innerWidth) - 32);
        position = {
            width,
            left: Math.max(left + 16, Math.min(rect.left + rect.width / 2 - width / 2, left + (viewport?.width ?? innerWidth) - width - 16)),
            bottom: innerHeight - rect.top + 12,
            max_height: Math.max(0, rect.top - top - 28)
        };
    }

    function close_panel(restore_focus = false) {
        open = false;
        if (restore_focus) document.querySelector('.music_toggle')?.focus({ preventScroll: true });
    }

    $effect(() => { page.url.pathname; close_panel(); });

    onMount(() => {
        const toggle = async () => {
            if (open) { close_panel(); return; }
            place_panel();
            open = true;
            await tick();
            panel.focus({ preventScroll: true });
        };
        const outside = (event) => {
            if (open && !panel.contains(event.target) && !event.target.closest('.music_toggle')) close_panel();
        };
        const keyboard = (event) => {
            if (open && event.key === 'Escape') { event.preventDefault(); close_panel(true); }
        };
        const reposition = () => { if (open) place_panel(); };
        const observer = new ResizeObserver(reposition);
        const player = document.querySelector('.music_bar');
        if (player) observer.observe(player);
        window.addEventListener('patter-toggle-sound-panel', toggle);
        window.addEventListener('pointerdown', outside);
        window.addEventListener('keydown', keyboard);
        window.addEventListener('resize', reposition);
        window.visualViewport?.addEventListener('resize', reposition);
        window.visualViewport?.addEventListener('scroll', reposition);
        return () => {
            observer.disconnect();
            window.removeEventListener('patter-toggle-sound-panel', toggle);
            window.removeEventListener('pointerdown', outside);
            window.removeEventListener('keydown', keyboard);
            window.removeEventListener('resize', reposition);
            window.visualViewport?.removeEventListener('resize', reposition);
            window.visualViewport?.removeEventListener('scroll', reposition);
        };
    });
</script>

<div bind:this={panel} id="patter_sound_panel" role="dialog" aria-label="Sound options" tabindex="-1" inert={!open} aria-hidden={!open} class="sound_panel patter_font_ui patter_text_main" class:open data-patter-panel="3" style={`left: ${position.left}px; bottom: ${position.bottom}px; width: ${position.width}px; max-height: ${position.max_height}px`}>
    <span class="sound_surface patter_surface patter_surface_gradient" aria-hidden="true"></span>
    <div class="sound_scroll">

        <AmbientMixer embedded />
        <div class="sound_divider" aria-hidden="true"></div>
        <ToggleButton text="Typewriter" bind:value={typing_sound_enabled.value} onchange={(value) => { setTypingSoundEnabled(value); track_setting('typewriter', value); }} />
        <ToggleButton text="Interactions" bind:value={interaction_sound_enabled.value} onchange={(value) => { setInteractionSoundEnabled(value); track_setting('interaction_sound', value); }} />
    </div>
</div>

<style>
    .sound_panel { position: fixed; z-index: 60; border-radius: 12px; opacity: 0; visibility: hidden; pointer-events: none; transition: opacity var(--patter_motion_standard) ease-out, visibility 0s var(--patter_motion_standard); display: flex; }
    .sound_panel:focus-visible { background-color: transparent; box-shadow: none; }
    .sound_panel.open { opacity: 1; visibility: visible; pointer-events: auto; transition-delay: 0s; }
    .sound_surface { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; }
    .sound_scroll { position: relative; display: flex; flex-direction: column; gap: var(--patter_setting_gap); padding: var(--patter_space_6); overflow-y: auto; overscroll-behavior: contain; min-height: 0; width: 100%; }
    .sound_divider { height: 2px; flex-shrink: 0; background: var(--patter_divider); }
    @media (max-width: 359px) { .sound_scroll :global([data-setting-control]) { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--patter_space_2); } }
    @media (max-width: 399px) { .sound_scroll { padding: var(--patter_space_4); } }
</style>
