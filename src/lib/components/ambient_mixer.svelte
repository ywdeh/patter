<script>
    import { disc_rotation } from '$lib/state/disc_rotation.js';
    import { track_event, track_setting } from '$lib/state/analytics.js';
    import { onMount, untrack } from 'svelte';
    import InputPill from './input_pill.svelte';
    import { ambient_tracks, create_ambient_player } from '$lib/state/ambient_player.js';
    import { music_playback, connect_music_controls } from '$lib/state/music_transport.svelte.js';
    import { sound_enabled } from '$lib/state/sound_settings.svelte.js';

    let { embedded = false } = $props();
    const groups = [{ id: 'music', label: 'Music' }, { id: 'ambience', label: 'Ambient sounds' }];

    export function reset_mix() {
        tracks = ambient_tracks.map((track) => ({ ...track }));
        player?.set_mix(tracks);
        player?.pause();
        error = '';
    }

    let tracks = $state(ambient_tracks.map((track) => ({ ...track })));
    let player = $state.raw(null);
    let error = $state('');

    function update_track(id, changes, switch_only = false) {
        const selected = tracks.find((track) => track.id === id);
        const starting = selected?.volume === 0 && changes.volume > 0;
        const exclusive = selected?.category === 'music' && changes.volume > 0;
        const previous_music = exclusive && selected.volume === 0
            ? tracks.find((track) => track.category === 'music' && track.id !== id && track.volume > 0) : null;
        if (previous_music) changes = { ...changes, volume: Math.max(0, Math.min(100, previous_music.volume + (switch_only ? 0 : changes.volume - selected.volume))) };
        tracks = tracks.map((track) => {
            const next = track.id === id ? { ...track, ...changes }
                : exclusive && track.category === 'music' ? { ...track, volume: 0 } : track;
            if (next.volume !== track.volume) track_setting(`${track.id}_volume`, next.volume);
            return next;
        });
        error = '';
        void sync_playback().then((started) => {
            if (starting && started && sound_enabled.value) track_event('audio_started', { track: id });
        });
    }

    async function sync_playback() {
        error = '';
        player?.set_mix(tracks);
        if (!tracks.some((track) => track.volume > 0)) player?.pause();
        else {
            try { if (!player) return false; await player.play(); return true; }
            catch (cause) { error = cause.message; }
        }
    }

    function refresh_music() {
        music_playback.ambience = tracks.filter((item) => item.category === 'ambience' && item.volume > 0).map((item) => item.label).join(', ');
        const track = tracks.find((item) => item.category === 'music' && item.volume > 0);
        if (untrack(() => music_playback.track?.id) !== track?.id) {
            music_playback.track = track ? { id: track.id, label: track.label, cover: track.cover } : null;
        }
        Object.assign(music_playback, track && player ? player.get_track_state(track.id)
            : { position: 0, duration: 0, loading: false });
    }

    $effect(() => { player?.set_muted(!sound_enabled.value); });

    $effect(() => {
        const active = tracks.some((track) => track.category === 'music' && track.volume > 0);
        refresh_music();
        if (!active) return;
        let timer;
        const monitor = () => {
            clearInterval(timer);
            refresh_music();
            if (document.visibilityState === 'visible') timer = setInterval(refresh_music, 250);
        };
        monitor();
        document.addEventListener('visibilitychange', monitor);
        return () => { clearInterval(timer); document.removeEventListener('visibilitychange', monitor); };
    });

    onMount(() => {
        player = create_ambient_player((status) => {
            if (status.error) error = status.error;
        });
        player.set_mix(tracks);
        const disconnect_music = connect_music_controls({
            seek(position) {
                const track = tracks.find((item) => item.category === 'music' && item.volume > 0);
                if (!track) return;
                player.seek_track(track.id, position);
                refresh_music();
            }
        });
        const clear = reset_mix;
        window.addEventListener('patter-clear-saved-data', clear);
        window.addEventListener('patter-reset-audio', clear);
        return () => {
            window.removeEventListener('patter-clear-saved-data', clear);
            window.removeEventListener('patter-reset-audio', clear);
            player.destroy();
            disconnect_music();
        };
    });
</script>

<section role="group" class="ambient_mixer relative w-full shrink-0 transition-opacity patter_duration_standard" class:embedded aria-label="Ambient sound mixer">
    {#if !embedded}<div aria-hidden="true" class="patter_surface pointer-events-none absolute inset-0 rounded-xl patter_surface_gradient"></div>{/if}
    <div class="mixer_content relative flex flex-col gap-5 p-4">
            {#each groups as group, index}
                {#if index}<div class="mixer_divider" aria-hidden="true"></div>{/if}
                <section class="mixer_group" role="group" aria-label={group.label}>
                    <h3 class="patter_font_ui patter_text_small patter_text_muted">{group.label}</h3>
                    <div class="ambient_channels">
                {#each tracks.filter((track) => track.category === group.id) as track (track.id)}
                    <div class="mixer_channel">
                    <InputPill text={track.label} value={track.volume} min={0} max={100} step={5}
                        defaultValue={ambient_tracks.find((item) => item.id === track.id).volume}
                        unit="%" displayValues={{ 0: 'Off' }}
                        onplay={track.category === 'music' && track.volume === 0 && tracks.some((item) => item.category === 'music' && item.volume > 0)
                            ? () => update_track(track.id, { volume: 5 }, true) : null}
                        onchange={(volume) => update_track(track.id, { volume })}>
                        {#snippet label()}
                            <span class="track_label" class:playing={track.volume > 0}>
                                {#if track.cover}<span class="track_disc_slot"><span class="track_disc_frame patter_shadow"><img class="track_disc" use:disc_rotation={{ key: track.id, active: track.volume > 0 && music_playback.track?.id === track.id && music_playback.duration > 0 && !music_playback.loading && sound_enabled.value }} src={track.cover} alt="" /></span></span>{/if}
                                <span class="track_name">{track.label}</span>
                            </span>
                        {/snippet}
                    </InputPill>
                    </div>
                {/each}
                    </div>
                </section>
            {/each}
            {#if error}<p class="patter_text_small patter_text_error" role="alert">{error}</p>{/if}
    </div>
</section>

<style>
    .embedded .mixer_content { padding: 0; }
    .mixer_group { display: flex; flex-direction: column; gap: var(--patter_space_4); }
    .mixer_divider { height: 2px; flex-shrink: 0; background: var(--patter_divider); }
    .track_label { display: flex; align-items: center; min-width: 0; }
    .track_name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .track_disc_slot { display: flex; align-items: center; width: 0; flex-shrink: 0; overflow: visible; transition: width var(--patter_motion_standard) ease-out; }
    .track_disc_frame { display: block; width: var(--patter_space_8); height: var(--patter_space_8); margin-right: var(--patter_space_2); flex-shrink: 0; border-radius: 50%; opacity: 0; transform: translateX(calc(var(--patter_space_2) * -1)); transition: opacity var(--patter_motion_standard) ease-out, transform var(--patter_motion_standard) ease-out; }
    .track_disc { display: block; width: 100%; height: 100%; border-radius: 50%; object-fit: cover; mask-image: radial-gradient(circle, transparent 2px, #000 2px); }
    .playing .track_disc_slot, .mixer_channel:has(:global([data-setting-increase]:focus-visible)) .track_disc_slot { width: calc(var(--patter_space_8) + var(--patter_space_2)); }
    .playing .track_disc_frame, .mixer_channel:has(:global([data-setting-increase]:focus-visible)) .track_disc_frame { opacity: 1; transform: translateX(0); }
    @media (hover: hover) and (pointer: fine) {
        .mixer_channel:has(:global([data-setting-increase]:not(:disabled):hover)) .track_disc_slot { width: calc(var(--patter_space_8) + var(--patter_space_2)); }
        .mixer_channel:has(:global([data-setting-increase]:not(:disabled):hover)) .track_disc_frame { opacity: 1; transform: translateX(0); }
    }
    @media (prefers-reduced-motion: reduce) { .track_disc_slot { transition: none; } .track_disc_frame { transform: none; transition: opacity var(--patter_motion_standard) ease-out; } }
    .ambient_channels { display: flex; flex-direction: column; gap: var(--patter_setting_gap); }
</style>
