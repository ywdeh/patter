<script>
    import { track_event, track_setting } from '$lib/state/analytics.js';
    import { clear_recovery_snapshots } from '$lib/state/editor_recovery.js';
    import { editor_font_labels, editor_fonts } from '$lib/state/editor_fonts.js';
    import { reset_editor_visuals } from '$lib/state/editor_font_transition.js';
    import HoldButton from './hold_button.svelte';
    import { set_spread_origin } from '$lib/state/background_spread.js';
    import InputPill from './input_pill.svelte';
    import ToggleButton from './toggle_button.svelte';
    import AmbientMixer from './ambient_mixer.svelte';
    import BackgroundPicker from './background_picker.svelte';
    import { background_values, persistBackgroundValues, defaults, resetBackgroundValues } from '$lib/state/background_state.svelte.js';
    import { enterFullscreen, exitFullscreen, isFullscreenActive } from '$lib/fullscreen.js';
    import { sound_enabled, setSoundEnabled, typing_sound_enabled, setTypingSoundEnabled, interaction_sound_enabled, setInteractionSoundEnabled } from '$lib/state/sound_settings.svelte.js';
    import { playSound } from '$lib/state/sound.js';
    import { clearBackgroundUploads } from '$lib/state/background_media.js';
    import { setEditorDocument } from '$lib/state/editor_document.js';
    import { onMount, tick } from 'svelte';

    let { intro = false, onintroend = () => {} } = $props();
    const tabs = ['Scene', 'Writing', 'Audio'];
    const tint_labels = { 0: 'None' };
    const grain_labels = { 0: 'None', 1: 'Subtle', 2: 'Gentle', 3: 'Noticeable', 4: 'Strong' };
    let picker_active = $state(false);
    let panel_pinned = $state(false);
    let shell;
    let options_toggle;
    let mobile_mode = $state(false);
    let touch_open = $state(false);

    function handle_picker(active) {
        picker_active = active;
        panel_pinned = active;
    }

    let active_tab = $state('Scene');
    let is_fullscreen = $state(false);
    let fullscreen_pending = $state(false);
    let fullscreen_supported = $state(true);
    let browser_fullscreen = $state(false);
    let tab_list;
    let scroll_area;
    let content;
    let mixer;
    let has_overflow = $state(false);
    let top_fade = $state(0);
    let bottom_fade = $state(0);

    function update_scroll() {
        if (!scroll_area) return;
        const remaining = Math.max(0, scroll_area.scrollHeight - scroll_area.clientHeight);
        has_overflow = remaining > 1;
        const fade_distance = 32;
        top_fade = Math.min(fade_distance, Math.max(0, scroll_area.scrollTop));
        bottom_fade = Math.min(fade_distance, Math.max(0, remaining - scroll_area.scrollTop));
    }

    onMount(() => {
        const dismiss_pin = (event) => {
            if (!picker_active && !shell?.contains(event.target) && !options_toggle?.contains(event.target)) { panel_pinned = false; touch_open = false; }
        };
        window.addEventListener('pointerdown', dismiss_pin);
        const touch_layout = window.matchMedia('(max-width: 639px), (hover: none), (pointer: coarse)');
        const sync_touch_layout = () => { mobile_mode = touch_layout.matches; if (!mobile_mode) touch_open = false; };
        const dismiss_escape = (event) => { if (event.key === 'Escape' && touch_open) { touch_open = false; options_toggle?.focus(); } };
        sync_touch_layout();
        touch_layout.addEventListener('change', sync_touch_layout);
        window.addEventListener('keydown', dismiss_escape);

        fullscreen_supported = typeof document.documentElement.requestFullscreen === 'function' && document.fullscreenEnabled !== false;
        const display_mode = window.matchMedia('(display-mode: fullscreen)');
        const sync_fullscreen = () => {
            is_fullscreen = isFullscreenActive();
            browser_fullscreen = is_fullscreen && !document.fullscreenElement;
        };
        sync_fullscreen();
        const observer = new ResizeObserver(update_scroll);
        observer.observe(scroll_area);
        observer.observe(content);
        document.addEventListener('fullscreenchange', sync_fullscreen);
        display_mode.addEventListener('change', sync_fullscreen);
        return () => {
            window.removeEventListener('pointerdown', dismiss_pin);
            touch_layout.removeEventListener('change', sync_touch_layout);
            window.removeEventListener('keydown', dismiss_escape);
            observer.disconnect();
            document.removeEventListener('fullscreenchange', sync_fullscreen);
            display_mode.removeEventListener('change', sync_fullscreen);
        };
    });

    async function select_tab(tab) {
        if (active_tab === tab || (tab === 'Audio' && !sound_enabled.value)) return;
        active_tab = tab;
        track_event('options_tab_changed', { tab: tab.toLowerCase() });
        playSound('click');
        await tick();
        scroll_area.scrollTop = 0;
        update_scroll();
    }

    function handle_tab_key(event, index) {
        const available = tabs.filter((tab) => tab !== 'Audio' || sound_enabled.value);
        const current = available.indexOf(tabs[index]);
        let next;
        if (event.key === 'ArrowRight') next = (current + 1) % available.length;
        else if (event.key === 'ArrowLeft') next = (current + available.length - 1) % available.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = available.length - 1;
        else return;
        event.preventDefault();
        void select_tab(available[next]);
        tab_list.querySelectorAll('[role="tab"]')[tabs.indexOf(available[next])].focus();
    }

    $effect(() => {
        if (!sound_enabled.value && active_tab === 'Audio') {
            active_tab = 'Scene';
            if (scroll_area) scroll_area.scrollTop = 0;
            update_scroll();
        }
    });

    async function toggle_fullscreen() {
        if (fullscreen_pending || browser_fullscreen) return;
        fullscreen_pending = true;
        try {
            playSound('click');
            await (is_fullscreen ? exitFullscreen() : enterFullscreen());
            is_fullscreen = isFullscreenActive();
            browser_fullscreen = is_fullscreen && !document.fullscreenElement;
        } finally {
            fullscreen_pending = false;
        }
    }

    let reset_pending = false;
    async function reset_options(event) {
        if (reset_pending) return;
        reset_pending = true;
        try {
            if (event.shiftKey) {
                await clearBackgroundUploads();
                await clear_recovery_snapshots();
            }
            const apply = async () => {
                set_spread_origin(defaults.background, event);
                resetBackgroundValues();
                setSoundEnabled(true);
                setTypingSoundEnabled(true);
                setInteractionSoundEnabled(true);
                mixer?.reset_mix();
                if (event.shiftKey) {
                    setEditorDocument('');
                    window.dispatchEvent(new Event('patter-clear-saved-data'));
                    await tick();
                    for (const key of ['background-values', 'patter-doc', 'patter-sound-enabled', 'patter-typing-sound-enabled', 'patter-interaction-sound-enabled', 'patter-hover-sound-enabled', 'patter-click-sound-enabled', 'patter-video-posters', 'patter-background-ambient-colors-v3', 'patter-background-scrim-v1']) localStorage.removeItem(key);
                }
            };
            if (event.shiftKey) await reset_editor_visuals(apply);
            else await apply();
            track_event('settings_reset', { scope: event.shiftKey ? 'all' : 'options' });
        } catch (error) {
            console.error('Could not reset saved data', error);
        } finally {
            reset_pending = false;
        }
    }

    function toggle_sound() {
        setSoundEnabled(!sound_enabled.value);
        track_setting('sound', sound_enabled.value);
        if (sound_enabled.value) playSound('click');
    }

</script>

<button bind:this={options_toggle} type="button" class="mobile_options_toggle patter_control patter_control_round group/hitbox" data-zen-mode-ui="options" data-ui-hover-sound="true" aria-label={touch_open ? 'Close options' : 'Open options panel'} aria-expanded={touch_open} aria-controls="patter_options_panel" onclick={() => { touch_open = !touch_open; playSound('click'); onintroend(); }}>
    <span aria-hidden="true" class="patter_surface patter_hover patter_active absolute inset-0 rounded-full patter_surface_gradient"></span>
    <svg class="patter_icon relative size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={touch_open ? 'm6 6 12 12M18 6 6 18' : 'M4 7h16M4 17h16M8 4v6m8 4v6'} stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
</button>
<div bind:this={shell} class:touch_open={touch_open} inert={mobile_mode && !touch_open} aria-hidden={mobile_mode && !touch_open ? true : undefined} class:panel_pinned={panel_pinned} class="options_shell patter_ui_text patter_unselectable patter_options_motion transition ease-in-out" class:options_intro={intro}
    onpointerenter={onintroend} onpointerleave={() => { if (!picker_active) panel_pinned = false; }} onfocusin={onintroend} role="group" aria-label="Options bar"
    data-zen-mode-ui="options" ondragstart={(event) => event.preventDefault()}>
    <section data-patter-panel="2" id="patter_options_panel" class="options_panel" aria-label="Customization">
        <div aria-hidden="true" class="options_glass patter_surface pointer-events-none rounded-xl patter_surface_gradient"></div>
        <header class="options_header">
            <HoldButton iconOnly text="Reset options; hold Shift to clear writing, recovery history and all app data" oncomplete={reset_options} />
            <div class="quick_actions">
                <button data-ui-hover-sound="true" type="button" class="icon_button patter_control patter_control_round group/hitbox" aria-label={sound_enabled.value ? 'Mute sound' : 'Enable sound'} aria-pressed={sound_enabled.value} onclick={toggle_sound}>
                    <span aria-hidden="true" class="icon_surface patter_surface patter_hover patter_active patter_surface_gradient"></span>
                    <svg class="patter_icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"  stroke-linecap="round" />{#if sound_enabled.value}<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linecap="round"  stroke-linejoin="round" />{:else}<path d="m16 9 5 6m0-6-5 6" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linecap="round"  stroke-linejoin="round" />{/if}</svg>
                </button>
                <button data-ui-hover-sound="true" type="button" class="icon_button patter_control patter_control_round group/hitbox" aria-label={is_fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} aria-pressed={is_fullscreen} disabled={fullscreen_pending || browser_fullscreen || !fullscreen_supported} onclick={toggle_fullscreen}>
                    <span aria-hidden="true" class="icon_surface patter_surface patter_hover patter_active patter_surface_gradient"></span>
                    <svg class="patter_icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={is_fullscreen ? 'M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5' : 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5'} stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </button>
            </div>
        </header>
        <div bind:this={tab_list} class="options_tabs" style={`--active-tab: ${tabs.indexOf(active_tab)}`} role="tablist" aria-label="Customize your space">
            {#each tabs as tab, index}
                <button data-ui-hover-sound="true" type="button" role="tab" id={'options_tab_' + tab.toLowerCase()} aria-controls={'options_content_' + tab.toLowerCase()} aria-selected={active_tab === tab} disabled={tab === 'Audio' && !sound_enabled.value} onclick={() => select_tab(tab)} onkeydown={(event) => handle_tab_key(event, index)}>{tab}</button>
            {/each}
        </div>
        <div bind:this={scroll_area} onscroll={update_scroll} style={`--options-top-fade: ${top_fade}px; --options-bottom-fade: ${bottom_fade}px`} class="options_scroll scrollbar-thin scrollbar-thumb-mauve-100/12" data-wheel-controls={has_overflow ? 'disabled' : undefined}>
            <div bind:this={content} class="tab_stack">
                <div id="options_content_scene" role="tabpanel" aria-labelledby="options_tab_scene" inert={active_tab !== 'Scene'} aria-hidden={active_tab !== 'Scene'} class:tab_inactive={active_tab !== 'Scene'} class="tab_content">
                    <BackgroundPicker sound="paper_turn" compact onpickerchange={handle_picker} />
                    <div class="options_divider" aria-hidden="true"></div>
                    <div class="setting_rows">
                        <InputPill text="Focus" min={0} max={15} step={1} bind:value={background_values.focus} defaultValue={defaults.focus} onchange={(value) => { persistBackgroundValues({ focus: value }); track_setting('focus', value); }} />
                        <InputPill text="Tint" min={0} max={80} step={5} bind:value={background_values.tint} defaultValue={defaults.tint} displayValues={tint_labels} unit="%" onchange={(value) => { persistBackgroundValues({ tint: value }); track_setting('tint', value); }} />
                        <InputPill text="Tone" min={0} max={2} step={1} displayValues={{ 0: 'Cool', 1: 'Warm', 2: 'Olive' }} bind:value={background_values.tintShade} defaultValue={defaults.tintShade} onchange={(value) => { persistBackgroundValues({ tintShade: value }); track_setting('tintShade', value); }} />
                        <InputPill text="Grain" min={0} max={4} step={1} bind:value={background_values.grain} defaultValue={defaults.grain} displayValues={grain_labels} onchange={(value) => { persistBackgroundValues({ grain: value }); track_setting('grain', value); }} />
                    </div>
                </div>
                <div id="options_content_writing" role="tabpanel" aria-labelledby="options_tab_writing" inert={active_tab !== 'Writing'} aria-hidden={active_tab !== 'Writing'} class:tab_inactive={active_tab !== 'Writing'} class="tab_content">
                    <InputPill text="Font" min={0} max={3} step={1} bind:value={background_values.editorFont} defaultValue={defaults.editorFont} displayValues={editor_font_labels} displayFonts={editor_fonts} onchange={(value) => { persistBackgroundValues({ editorFont: value }); track_setting('editorFont', value); }} />
                    <InputPill text="Text size" min={mobile_mode ? 16 : 14} max={24} step={1} value={mobile_mode ? Math.max(16, background_values.textSize) : background_values.textSize} defaultValue={defaults.textSize} onchange={(value) => { background_values.textSize = value; persistBackgroundValues({ textSize: value }); track_setting('textSize', value); }} />
                    <div class="options_divider" aria-hidden="true"></div>
                    <InputPill text="Controls" mode="toggle" falseLabel="Wide" trueLabel="Narrow" value={!background_values.cornerControls} defaultValue={!defaults.cornerControls} onchange={(value) => { background_values.cornerControls = !value; persistBackgroundValues({ cornerControls: !value }); track_setting('corner_controls', !value); }} />
                    <div class="options_divider" aria-hidden="true"></div>
                    <ToggleButton text="Markdown" bind:value={background_values.markdown} onchange={(value) => { persistBackgroundValues({ markdown: value }); track_setting('markdown', value); }} />
                </div>
                <div id="options_content_audio" role="tabpanel" aria-labelledby="options_tab_audio" inert={active_tab !== 'Audio'} aria-hidden={active_tab !== 'Audio'} class:tab_inactive={active_tab !== 'Audio'} class="tab_content">
                    <AmbientMixer bind:this={mixer} embedded />
                    <div class="options_divider" aria-hidden="true"></div>
                    <div class="system_sounds">
                        <ToggleButton text="Typewriter" bind:value={typing_sound_enabled.value} onchange={(value) => { setTypingSoundEnabled(value); track_setting('typewriter', value); }} />
                        <ToggleButton text="Interactions" bind:value={interaction_sound_enabled.value} onchange={(value) => { setInteractionSoundEnabled(value); track_setting('interaction_sound', value); }} />
                    </div>
                </div>
            </div>
        </div>

    </section>
</div>

<style>
    .options_shell {
        pointer-events: none;
        position: absolute;
        z-index: 55;
        right: 0;
        top: 0;
        display: flex;
        align-items: center;
        width: 25rem;
        max-width: calc(100vw - 3rem);
        height: 100dvh;
        padding: var(--patter_space_6);
        opacity: var(--patter_opacity_disabled);
        transform: translateX(calc(100% - 3 * var(--patter_control_height) - 2rem));
        filter: saturate(0);
    }
    .options_shell.options_intro {
        opacity: var(--patter_opacity_secondary);
        transform: translateX(calc(100% - 5 * var(--patter_control_height) - 2rem));
    }
    .options_shell:hover, .options_shell:focus-within, .options_shell.panel_pinned {
        opacity: 1;
        transform: translateX(0);
        filter: saturate(1);
    }
    .options_panel {
        pointer-events: auto;
        position: relative;
        isolation: isolate;
        display: flex;
        flex-direction: column;
        width: 100%;
        flex-shrink: 0;
        min-height: 0;
        max-height: calc(100dvh - 3rem);
        padding: var(--patter_space_4);
        border-radius: 0.75rem;
    }
    @media (min-width: 640px) and (hover: hover) and (pointer: fine) {
        .options_panel::before { content: ''; position: absolute; z-index: -1; inset-block: calc(var(--patter_space_3) * -1); inset-inline: calc(var(--patter_space_6) * -1); pointer-events: auto; }
    }
    .options_glass { position: absolute; inset: 0; z-index: -1; }
    .options_header, .quick_actions { display: flex; align-items: center; }
    .options_header { justify-content: space-between; padding-bottom: var(--patter_space_4); flex-shrink: 0; }
    .quick_actions { gap: var(--patter_space_4); }
    .icon_button {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: var(--patter_control_height);
        height: var(--patter_control_height);
        flex-shrink: 0;
        cursor: pointer;
        color: inherit;
    }
    .icon_button svg { position: relative; width: 1.25rem; height: 1.25rem; pointer-events: none; }
    .icon_surface { position: absolute; inset: 0; border-radius: 50%; }
    .options_tabs {
        position: relative;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        flex-shrink: 0;
    }
    .options_tabs button {
        position: relative;
        padding: var(--patter_space_3) var(--patter_space_1) var(--patter_space_4);
        cursor: pointer;
        opacity: var(--patter_opacity_secondary);
        transition: opacity var(--patter_motion_standard) ease-out, var(--patter_focus_transition);
    }
    .options_tabs button:hover, .options_tabs button[aria-selected='true'] { opacity: 1; }
    .options_tabs button:disabled { opacity: var(--patter_opacity_disabled); cursor: default; pointer-events: none; }
    .options_divider, .options_tabs::after {
        height: 2px;
        background: var(--patter_divider);
        flex-shrink: 0;
        pointer-events: none;
    }
    .options_tabs::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background-image: radial-gradient(ellipse at center, var(--patter_surface_selected), transparent 75%), var(--patter_divider);
        background-size: 50% 100%, 100% 100%;
        background-repeat: no-repeat;
        background-position: calc(var(--active-tab) * 50%) 0, 0 0;
        transition: background-position var(--patter_motion_standard) ease-out;
    }
    @media (prefers-reduced-motion: reduce) { .options_tabs::after { transition: none; } }
    .options_scroll {
        mask-image: linear-gradient(to bottom, transparent 0, #000 var(--options-top-fade), #000 calc(100% - var(--options-bottom-fade)), transparent 100%);
        -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 var(--options-top-fade), #000 calc(100% - var(--options-bottom-fade)), transparent 100%);
        flex: 1;
        min-height: 0;
        margin: 0 calc(var(--patter_space_2) * -1);
        padding: var(--patter_space_5) var(--patter_space_2);
        overflow-y: auto;
        overflow-x: hidden;
        overscroll-behavior: contain;
        scrollbar-gutter: stable;
    }
    .system_sounds { display: flex; flex-direction: column; gap: var(--patter_setting_gap); padding: var(--patter_space_1); }
    .tab_content, .setting_rows { display: flex; flex-direction: column; gap: var(--patter_setting_gap); }
    .tab_content { padding: var(--patter_space_1); }
    .tab_stack { display: grid; }
    .tab_content { grid-area: 1 / 1; align-self: start; }
    .tab_inactive { visibility: hidden; pointer-events: none; }
    @media (max-width: 420px) {
        .options_scroll :global([data-setting-control]) { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--patter_space_2); }
        .options_scroll :global([data-setting-control] > div) { min-width: 0; width: 100%; }
    }
    .mobile_options_toggle { display: none; }
    @media (max-width: 639px), (hover: none), (pointer: coarse) {
        .mobile_options_toggle { position: fixed; right: max(1rem, env(safe-area-inset-right)); top: calc(var(--patter_viewport_height, 100dvh) - 44px - max(1rem, env(safe-area-inset-bottom))); z-index: 60; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; cursor: pointer; }
        .options_shell { --patter_setting_gap: var(--patter_space_4); position: fixed; width: min(25rem, 100vw); max-width: 100vw; height: var(--patter_viewport_height, 100dvh); padding: max(var(--patter_space_4), env(safe-area-inset-top)) max(var(--patter_space_4), env(safe-area-inset-right)) calc(var(--patter_mobile_controls_clearance) + env(safe-area-inset-bottom)) max(var(--patter_space_4), env(safe-area-inset-left)); align-items: center; }
        .options_shell:not(.touch_open) { opacity: 0; transform: translateX(100%); pointer-events: none; }
        .options_shell:not(.touch_open) .options_panel { pointer-events: none; }
        .options_shell.touch_open { opacity: 1; transform: translateX(0); filter: none; }
        .options_panel { max-height: 100%; padding: var(--patter_space_3); }
        .options_header { padding-bottom: var(--patter_space_2); }
        .quick_actions { gap: var(--patter_space_3); }
        .options_scroll { padding-block: var(--patter_space_3); }
    }
</style>
