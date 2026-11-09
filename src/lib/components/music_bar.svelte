<script>
    import { disc_rotation } from '$lib/state/disc_rotation.js';
    import { smooth_width } from '$lib/state/smooth_width.js';
    import { fade } from 'svelte/transition';
    import { music_playback, seek_music } from '$lib/state/music_transport.svelte.js';
    import { motionDuration } from '$lib/state/motion.js';
    import { playSound } from '$lib/state/sound.js';
    import { sound_enabled } from '$lib/state/sound_settings.svelte.js';

    let preview_position = $state(null);
    let playback_position = $state(0);
    let hover_progress = $state(0);
    let hovering_progress = $state(false);
    const has_audio = $derived(Boolean(music_playback.track || music_playback.ambience));
    const position = $derived(preview_position ?? playback_position);
    const remaining = $derived(Math.max(0, music_playback.duration - position));
    const progress = $derived(music_playback.duration ? position / music_playback.duration * 100 : 0);
    const cover = $derived(music_playback.track?.cover ?? '/backgrounds/thumbnails/book.webp.webp');

    function time(value) {
        const seconds = Math.max(0, Math.ceil(value));
        return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }

    function preview_seek(event) {
        if (event.pointerType !== 'mouse') return;
        const bounds = event.currentTarget.getBoundingClientRect();
        hover_progress = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
        hovering_progress = true;
    }

    function commit_seek(event) {
        seek_music(Number(event.currentTarget.value));
        preview_position = null;
    }

    $effect(() => { music_playback.track?.id; preview_position = null; });

    $effect(() => {
        const position = music_playback.position;
        const duration = music_playback.duration;
        const running = !music_playback.loading && duration > 0;
        playback_position = position;
        if (!running) return;
        const started = performance.now();
        let frame;
        const advance = (now) => {
            playback_position = (position + (now - started) / 1000) % duration;
            frame = requestAnimationFrame(advance);
        };
        frame = requestAnimationFrame(advance);
        return () => cancelAnimationFrame(frame);
    });
</script>

    <section class:has_audio={has_audio} use:smooth_width class="music_bar patter_text_small patter_control patter_control_round" aria-label="Music player" aria-busy={music_playback.loading} transition:fade={{ duration: motionDuration('standard', 200) }}>
        <span class="music_surface patter_surface patter_hover patter_active absolute inset-0 rounded-full patter_surface_gradient" aria-hidden="true"></span>
        <div class="music_clip"><div class="music_content" data-control-content>
        <button type="button" class="music_toggle patter_control patter_control_round" aria-label="Open sound options" title="Audio" aria-controls="patter_sound_panel" data-ui-hover-sound="true" onclick={() => { window.dispatchEvent(new Event('patter-toggle-sound-panel')); playSound('click'); }}>
            {#if music_playback.track}
            {#key music_playback.track.id}
            <span class="disc_frame patter_shadow" transition:fade={{ duration: motionDuration('standard', 200) }}>
                <span class="disc_cutout">
                    <span class="disc_artwork" use:disc_rotation={{ key: music_playback.track.id, active: !music_playback.loading && music_playback.duration > 0 && sound_enabled.value }}>
                        {#key cover}<img class="music_disc" src={cover} alt="" transition:fade={{ duration: motionDuration('standard', 200) }} />{/key}
                    </span>
                </span>
            </span>
            {/key}
            {:else}
                <span class="sound_icon" transition:fade={{ duration: motionDuration('standard', 200) }}>
                    <span class="patter_icon patter_mask_icon size-4" style="mask-image: url(/music_note.svg); -webkit-mask-image: url(/music_note.svg)" aria-hidden="true"></span>
                </span>
            {/if}
        </button>
        <span class="music_spacer" aria-hidden="true"></span>
        {#if has_audio}
        <div class="music_details" transition:fade={{ duration: motionDuration('standard', 200) }}>
            {#if music_playback.track}
            <div class="music_heading"><span class="music_names"><span class="music_title_stack">{#key music_playback.track.id}<span class="music_title" transition:fade={{ duration: motionDuration('standard', 200) }}>{music_playback.track.label}</span>{/key}</span>{#if music_playback.ambience}<span class="ambience_stack">{#key music_playback.ambience}<span class="ambience_summary" title={music_playback.ambience} transition:fade={{ duration: motionDuration('standard', 200) }}>, {music_playback.ambience}</span>{/key}</span>{/if}</span><span class="music_time" aria-label={`${time(remaining)} remaining`}>-{time(remaining)}</span></div>
            <div class="music_seek">
                <span class="music_seek_track" aria-hidden="true"></span>
                <span class="music_seek_preview" class:visible={hovering_progress && music_playback.duration > 0} style:transform={`scaleX(${hover_progress})`} aria-hidden="true"></span>
            <input class="music_progress" type="range" aria-label="Seek music" aria-valuetext={`${time(position)} of ${time(music_playback.duration)}`}
                min="0" max={music_playback.duration || 1} step="any" value={position} disabled={!music_playback.duration}
                style={`--music-progress: ${progress}%`} oninput={(event) => { preview_position = Number(event.currentTarget.value); }} onchange={commit_seek} onpointermove={preview_seek} onpointerleave={() => { hovering_progress = false; }} onpointercancel={() => { preview_position = null; hovering_progress = false; }} />
            </div>
            {:else if music_playback.ambience}
                <div class="ambience_stack">{#key music_playback.ambience}<span class="ambience_summary" title={music_playback.ambience} transition:fade={{ duration: motionDuration('standard', 200) }}>{music_playback.ambience}</span>{/key}</div>
            {/if}
        </div>
        {/if}
        </div></div>
    </section>

<style>
    .music_bar { position: relative; display: flex; width: max-content; max-width: 100%; margin-inline: auto; border-radius: var(--patter_radius_round); color: var(--patter_color_text); opacity: 1; }
    .music_clip { min-width: 0; max-width: 100%; overflow: hidden; border-radius: inherit; }
    .music_content { display: flex; align-items: center; gap: var(--patter_space_2); width: var(--patter_control_height); min-height: var(--patter_control_height); }
    .has_audio .music_content { width: 15rem; padding-right: var(--patter_space_3); }
    .ambience_stack { display: grid; min-width: 0; }
    .ambience_summary { grid-area: 1 / 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: var(--patter_opacity_subtle); }
    .music_surface { pointer-events: none; }
    .music_spacer { width: var(--patter_control_height); height: var(--patter_control_height); flex-shrink: 0; }
    .music_toggle { position: absolute; inset: 0; display: grid; align-items: center; justify-items: start; padding-left: calc((var(--patter_control_height) - 2rem) / 2); width: 100%; height: 100%; cursor: pointer; }
    .sound_icon { grid-area: 1 / 1; display: grid; place-items: center; width: 2rem; height: 2rem; }
    .disc_frame { grid-area: 1 / 1; display: block; width: 2rem; height: 2rem; border-radius: 50%; }
    .disc_cutout { display: block; width: 100%; height: 100%; border-radius: 50%; mask-image: radial-gradient(circle, transparent 2px, #000 2px); }
    .disc_artwork { display: grid; width: 100%; height: 100%; }
    .music_disc { grid-area: 1 / 1; width: 2rem; height: 2rem; object-fit: cover; border-radius: 50%; }
    .music_details { pointer-events: none; width: calc(15rem - var(--patter_control_height) - var(--patter_space_2) - var(--patter_space_3)); flex-shrink: 0; min-width: 0; }
    .music_heading { display: flex; align-items: baseline; gap: var(--patter_space_4); }
    .music_names { display: flex; align-items: baseline; gap: 0; min-width: 0; }
    .music_title_stack { display: grid; min-width: 0; flex-shrink: 0;  }
    .music_title { grid-area: 1 / 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .music_time { margin-left: auto; flex-shrink: 0; font-variant-numeric: tabular-nums; opacity: var(--patter_opacity_secondary); }
    .music_seek { position: relative; }
    .music_seek_track, .music_seek_preview { position: absolute; top: calc(50% - 1px); left: 0; width: 100%; height: 2px; border-radius: 1px; pointer-events: none; }
    .music_seek_track { background: var(--patter_surface_hover); }
    .music_seek_preview { background: var(--patter_color_text); transform-origin: left; opacity: 0; transition: opacity var(--patter_motion_standard) ease-out; }
    @media (hover: hover) and (pointer: fine) { .music_seek_preview.visible { opacity: var(--patter_opacity_subtle); } }
    .music_progress { pointer-events: auto; position: relative; display: block; appearance: none; width: 100%; height: 1rem; margin: 0; background: transparent; cursor: pointer; accent-color: var(--patter_color_text); }
    .music_progress::-webkit-slider-runnable-track { height: 2px; border-radius: 1px; background: linear-gradient(to right, var(--patter_color_text) var(--music-progress), transparent var(--music-progress)); }
    .music_progress::-moz-range-track { height: 2px; border-radius: 1px; background: transparent; }
    .music_progress::-moz-range-progress { height: 2px; background: var(--patter_color_text); }
    .music_progress::-webkit-slider-thumb { appearance: none; width: 6px; height: 6px; margin-top: -2px; border-radius: 50%; background: currentColor; opacity: 0; }
    .music_progress::-moz-range-thumb { width: 6px; height: 6px; border: 0; border-radius: 50%; background: currentColor; opacity: 0; }
    .music_progress:disabled { cursor: default; }
    @media (hover: none), (pointer: coarse) { .music_toggle { min-height: 44px; } .music_progress { height: 24px; } }
</style>
