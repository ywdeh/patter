<script>
    import { track_event, track_setting } from '$lib/state/analytics.js';
    import { onMount } from 'svelte';
    import InputPill from './input_pill.svelte';
    import { ambient_tracks, create_ambient_player } from '$lib/state/ambient_player.js';
    import { sound_enabled } from '$lib/state/sound_settings.svelte.js';

    let { embedded = false } = $props();

    export function reset_mix() {
        tracks = ambient_tracks.map((track) => ({ ...track }));
        player?.set_mix(tracks);
        player?.pause();
        error = '';
    }

    let tracks = $state(ambient_tracks.map((track) => ({ ...track })));
    let player = $state.raw(null);
    let error = $state('');

    function update_track(id, changes) {
        const starting = tracks.find((track) => track.id === id)?.volume === 0 && changes.volume > 0;
        tracks = tracks.map((track) => track.id === id ? { ...track, ...changes } : track);
        track_setting(`${id}_volume`, changes.volume);
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

    $effect(() => { player?.set_muted(!sound_enabled.value); });

    onMount(() => {
        player = create_ambient_player((status) => {
            if (status.error) error = status.error;
        });
        player.set_mix(tracks);
        const clear = reset_mix;
        window.addEventListener('patter-clear-saved-data', clear);
        return () => {
            window.removeEventListener('patter-clear-saved-data', clear);
            player.destroy();
        };
    });
</script>

<section role="group" class="ambient_mixer relative w-full shrink-0 transition-opacity patter_duration_standard" class:embedded class:patter_disabled={!sound_enabled.value} inert={!sound_enabled.value} aria-disabled={!sound_enabled.value} aria-label="Ambient sound mixer">
    {#if !embedded}<div aria-hidden="true" class="patter_surface pointer-events-none absolute inset-0 rounded-xl patter_surface_gradient"></div>{/if}
    <div class="mixer_content relative flex flex-col gap-5 p-4">
            <div class="ambient_channels">
                {#each tracks as track (track.id)}
                    <InputPill text={track.label} value={track.volume} min={0} max={100} step={5}
                        defaultValue={ambient_tracks.find((item) => item.id === track.id).volume}
                        unit="%" displayValues={{ 0: 'Off' }}
                        onchange={(volume) => update_track(track.id, { volume })} />
                {/each}
            </div>
            {#if error}<p class="patter_text_small" role="alert">{error}</p>{/if}
    </div>
</section>

<style>
    .embedded .mixer_content { padding: 0; }
    .ambient_channels { display: flex; flex-direction: column; gap: 1.25rem; }
</style>
