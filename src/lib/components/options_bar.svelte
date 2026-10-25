<script>
    import { editor_font_labels } from '$lib/state/editor_fonts.js';
    import HoldButton from './hold_button.svelte';
    import { set_spread_origin } from '$lib/state/background_spread.js';
    import InputPill from './input_pill.svelte';
    import AmbientMixer from './ambient_mixer.svelte';
    import BackgroundPicker from './background_picker.svelte';
    import { background_values, persistBackgroundValues, defaults, selectBuiltInBackground } from '$lib/state/background_state.svelte.js';
    import { enterFullscreen, exitFullscreen, isFullscreenActive } from '$lib/fullscreen.js';
    import { sound_enabled, setSoundEnabled } from '$lib/state/sound_settings.svelte.js';
    import { playSound } from '$lib/state/sound.js';
    import { onMount, tick } from 'svelte';

    let { intro = false, onintroend = () => {} } = $props();
    const tabs = ['Scene', 'Writing', 'Audio'];
    const tint_labels = { 0: 'None' };
    const grain_labels = { 0: 'None', 1: 'Subtle', 2: 'Gentle', 3: 'Noticeable', 4: 'Strong' };
    let picker_active = $state(false);
    let panel_pinned = $state(false);
    let shell;

    function handle_picker(active) {
        picker_active = active;
        panel_pinned = active;
    }

    let active_tab = $state('Scene');
    let is_fullscreen = $state(false);
    let fullscreen_pending = $state(false);
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
            if (!picker_active && !shell?.contains(event.target)) panel_pinned = false;
        };
        window.addEventListener('pointerdown', dismiss_pin);

        const display_mode = window.matchMedia('(display-mode: fullscreen)');
        const sync_fullscreen = () => (is_fullscreen = isFullscreenActive());
        sync_fullscreen();
        const observer = new ResizeObserver(update_scroll);
        observer.observe(scroll_area);
        observer.observe(content);
        document.addEventListener('fullscreenchange', sync_fullscreen);
        display_mode.addEventListener('change', sync_fullscreen);
        return () => {
            window.removeEventListener('pointerdown', dismiss_pin);
            observer.disconnect();
            document.removeEventListener('fullscreenchange', sync_fullscreen);
            display_mode.removeEventListener('change', sync_fullscreen);
        };
    });

    async function select_tab(tab) {
        if (active_tab === tab) return;
        active_tab = tab;
        playSound('click');
        await tick();
        scroll_area.scrollTop = 0;
        update_scroll();
    }

    function handle_tab_key(event, index) {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault();
        void select_tab(tabs[next]);
        tab_list.querySelectorAll('[role="tab"]')[next].focus();
    }

    async function toggle_fullscreen() {
        if (fullscreen_pending) return;
        fullscreen_pending = true;
        try {
            playSound('click');
            await (is_fullscreen ? exitFullscreen() : enterFullscreen());
            is_fullscreen = isFullscreenActive();
        } finally {
            fullscreen_pending = false;
        }
    }

    function reset_current_tab(event) {
        if (active_tab === 'Scene') {
            set_spread_origin(defaults.background, event);
            for (const key of ['focus', 'tint', 'tintShade', 'grain', 'position']) background_values[key] = defaults[key];
            selectBuiltInBackground(defaults.background);
        } else if (active_tab === 'Writing') {
            background_values.textSize = defaults.textSize;
            background_values.editorFont = defaults.editorFont;
            persistBackgroundValues();
        } else mixer?.reset_mix();
    }

    function toggle_sound() {
        setSoundEnabled(!sound_enabled.value);
        if (sound_enabled.value) playSound('click');
    }

</script>

<div bind:this={shell} class:panel_pinned={panel_pinned} class="options_shell patter_ui_text patter_unselectable patter_options_motion transition ease-in-out" class:options_intro={intro}
    onpointerenter={onintroend} onpointerleave={() => { if (!picker_active) panel_pinned = false; }} onfocusin={onintroend} role="group" aria-label="Options bar"
    data-zen-mode-ui="options" ondragstart={(event) => event.preventDefault()}>
    <section id="patter_options_panel" class="options_panel" aria-label="Customization">
        <div aria-hidden="true" class="options_glass patter_surface pointer-events-none rounded-xl patter_surface_gradient"></div>
        <header class="options_header">
            <HoldButton iconOnly text={`Reset ${active_tab.toLowerCase()}`} oncomplete={reset_current_tab} />
            <div class="quick_actions">
                <button type="button" class="icon_button patter_control patter_control_round group/hitbox" aria-label={sound_enabled.value ? 'Mute sound' : 'Enable sound'} aria-pressed={sound_enabled.value} onclick={toggle_sound}>
                    <span aria-hidden="true" class="icon_surface patter_surface patter_hover patter_active patter_surface_gradient"></span>
                    <svg class="patter_icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linejoin="round" />{#if sound_enabled.value}<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linecap="round" />{:else}<path d="m16 9 5 6m0-6-5 6" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linecap="round" />{/if}</svg>
                </button>
                <button type="button" class="icon_button patter_control patter_control_round group/hitbox" aria-label={is_fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} aria-pressed={is_fullscreen} disabled={fullscreen_pending} onclick={toggle_fullscreen}>
                    <span aria-hidden="true" class="icon_surface patter_surface patter_hover patter_active patter_surface_gradient"></span>
                    <svg class="patter_icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={is_fullscreen ? 'M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5' : 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5'} stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </button>
            </div>
        </header>
        <div bind:this={tab_list} class="options_tabs" style={`--active-tab: ${tabs.indexOf(active_tab)}`} role="tablist" aria-label="Customize your space">
            {#each tabs as tab, index}
                <button type="button" role="tab" id={'options_tab_' + tab.toLowerCase()} aria-controls={'options_content_' + tab.toLowerCase()} aria-selected={active_tab === tab} tabindex={active_tab === tab ? 0 : -1} onclick={() => select_tab(tab)} onkeydown={(event) => handle_tab_key(event, index)}>{tab}</button>
            {/each}
        </div>
        <div bind:this={scroll_area} onscroll={update_scroll} style={`--options-top-fade: ${top_fade}px; --options-bottom-fade: ${bottom_fade}px`} class="options_scroll scrollbar-thin scrollbar-thumb-mauve-100/12" data-wheel-controls={has_overflow ? 'disabled' : undefined}>
            <div bind:this={content} class="tab_stack">
                <div id="options_content_scene" role="tabpanel" aria-labelledby="options_tab_scene" tabindex="0" inert={active_tab !== 'Scene'} aria-hidden={active_tab !== 'Scene'} class:tab_inactive={active_tab !== 'Scene'} class="tab_content">
                    <BackgroundPicker sound="paper_turn" compact onpickerchange={handle_picker} />
                    <div class="options_divider" aria-hidden="true"></div>
                    <div class="setting_rows">
                        <InputPill text="Focus" min={0} max={15} step={1} bind:value={background_values.focus} defaultValue={defaults.focus} onchange={(value) => persistBackgroundValues({ focus: value })} />
                        <InputPill text="Tint" min={0} max={80} step={5} bind:value={background_values.tint} defaultValue={defaults.tint} displayValues={tint_labels} unit="%" onchange={(value) => persistBackgroundValues({ tint: value })} />
                        <InputPill text="Tint color" min={0} max={2} step={1} displayValues={{ 0: 'Dusk', 1: 'Ember', 2: 'Fern' }} bind:value={background_values.tintShade} defaultValue={defaults.tintShade} onchange={(value) => persistBackgroundValues({ tintShade: value })} />
                        <InputPill text="Grain" min={0} max={4} step={1} bind:value={background_values.grain} defaultValue={defaults.grain} displayValues={grain_labels} onchange={(value) => persistBackgroundValues({ grain: value })} />
                    </div>
                </div>
                <div id="options_content_writing" role="tabpanel" aria-labelledby="options_tab_writing" tabindex="0" inert={active_tab !== 'Writing'} aria-hidden={active_tab !== 'Writing'} class:tab_inactive={active_tab !== 'Writing'} class="tab_content">
                    <InputPill text="Font" min={0} max={3} step={1} bind:value={background_values.editorFont} defaultValue={defaults.editorFont} displayValues={editor_font_labels} onchange={(value) => persistBackgroundValues({ editorFont: value })} />
                    <InputPill text="Text size" min={14} max={24} step={1} bind:value={background_values.textSize} defaultValue={defaults.textSize} onchange={(value) => persistBackgroundValues({ textSize: value })} />
                </div>
                <div id="options_content_audio" role="tabpanel" aria-labelledby="options_tab_audio" tabindex="0" inert={active_tab !== 'Audio'} aria-hidden={active_tab !== 'Audio'} class:tab_inactive={active_tab !== 'Audio'} class="tab_content">
                    <AmbientMixer bind:this={mixer} embedded />
                </div>
            </div>
        </div>

    </section>
</div>

<style>
    .options_shell {
        position: absolute;
        z-index: 55;
        right: 0;
        top: 0;
        display: flex;
        align-items: center;
        width: 25rem;
        max-width: calc(100vw - 3rem);
        height: 100dvh;
        padding: 1.5rem;
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
        position: relative;
        isolation: isolate;
        display: flex;
        flex-direction: column;
        width: 100%;
        flex-shrink: 0;
        min-height: 0;
        max-height: calc(100dvh - 3rem);
        padding: 1rem;
        border-radius: 0.75rem;
    }
    .options_glass { position: absolute; inset: 0; z-index: -1; }
    .options_header, .quick_actions { display: flex; align-items: center; }
    .options_header { justify-content: space-between; padding-bottom: 1rem; flex-shrink: 0; }
    .quick_actions { gap: 1rem; }
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
        padding: 0.75rem 0.25rem 1rem;
        cursor: pointer;
        opacity: var(--patter_opacity_secondary);
        transition: opacity var(--patter_motion_standard) ease-out;
    }
    .options_tabs button:hover, .options_tabs button[aria-selected='true'] { opacity: 1; }
    .options_divider, .options_tabs::after {
        height: 2px;
        background: linear-gradient(to right, transparent, var(--patter_surface_normal), transparent);
        flex-shrink: 0;
        pointer-events: none;
    }
    .options_tabs::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background-image: radial-gradient(ellipse at center, var(--patter_surface_selected), transparent 75%), linear-gradient(to right, transparent, var(--patter_surface_normal), transparent);
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
        margin: 0 -0.5rem;
        padding: 1.25rem 0.5rem;
        overflow-y: auto;
        overflow-x: hidden;
        overscroll-behavior: contain;
        scrollbar-gutter: stable;
    }
    .tab_content, .setting_rows { display: flex; flex-direction: column; gap: 1.25rem; }
    .tab_content { padding: 0.25rem; }
    .tab_stack { display: grid; }
    .tab_content { grid-area: 1 / 1; align-self: start; }
    .tab_inactive { visibility: hidden; pointer-events: none; }
    @media (max-width: 639px) { .options_shell { display: none; } }
</style>
