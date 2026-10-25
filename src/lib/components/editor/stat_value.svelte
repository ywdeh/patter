<script>
    import { fly } from 'svelte/transition';
    import { motionDuration } from '$lib/state/motion.js';
    let { value } = $props();
    let previous;
    let direction = $state(1);
    $effect.pre(() => {
        if (previous !== undefined) direction = Number.parseFloat(value) >= Number.parseFloat(previous) ? 1 : -1;
        previous = value;
    });
    function slide() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 8;
    }
</script>

<span class="stat_value">
    <span class="stat_measure" aria-hidden="true">{value}</span>
    <span class="stat_mask">
        {#key value}
            <span class="stat_frame" in:fly={{ y: direction * slide(), duration: motionDuration('short', 150), delay: motionDuration('quick', 100) }} out:fly={{ y: direction * -slide(), duration: motionDuration('quick', 100) }}>{value}</span>
        {/key}
    </span>
</span>

<style>
    .stat_value { display: inline-grid; vertical-align: bottom; }
    .stat_measure { visibility: hidden; grid-area: 1 / 1; }
    .stat_mask { position: relative; grid-area: 1 / 1; mask-image: linear-gradient(to bottom, transparent, #000 25%, #000 75%, transparent); -webkit-mask-image: linear-gradient(to bottom, transparent, #000 25%, #000 75%, transparent); }
    .stat_frame { position: absolute; inset: 0; display: flex; align-items: center; }
</style>
