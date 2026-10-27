<script>
    import { smooth_width } from '$lib/state/smooth_width.js';
	import { goto } from '$app/navigation';
	import { playSound } from '$lib/state/sound.js';

	let { text = null, href = null, icon = null, sound = 'click', onclick = null, disabled = false, ariaLabel = null, round = false } = $props();

	function handleClick(event) {
		if (disabled) return;
		onclick?.(event);
		if (!href || event.defaultPrevented) {
			if (sound) playSound(sound);
			return;
		}

		if (/^(https?:)?\/\//.test(href)) {
			if (sound) playSound(sound);
			window.location.href = href;
			return;
		}

		const changesRoute = new URL(href, window.location.href).pathname !== window.location.pathname;
		if (sound && !changesRoute) playSound(sound);
		goto(href);
	}
</script>

{#snippet buttonContent()}
    <span data-control-content class="flex w-max shrink-0 min-h-(--patter_control_height) items-center gap-2 relative px-3 py-2 pointer-events-none">
        {text}
        {#if icon}
            <span aria-hidden="true" class="patter_icon patter_mask_icon size-5 pointer-events-none" style={`mask-image: url("${icon}"); -webkit-mask-image: url("${icon}")`}></span>
        {/if}
    </span>
{/snippet}

<button use:smooth_width={!round} data-ui-hover-sound={Boolean(sound)}
    type="button"
    disabled={disabled}
    class:patter_control_round={round}
    class:round_button={round}
    aria-label={ariaLabel}
    onclick={handleClick}
    class="patter_control patter_control_text group/hitbox relative flex w-fit cursor-pointer items-center disabled:cursor-default disabled:pointer-events-none"
>
    <span class="patter_surface patter_hover {disabled ? '' : 'patter_active'} absolute inset-0 rounded-xl patter_surface_gradient" aria-hidden="true"></span>
    {@render buttonContent()}
</button>

<style>
    .round_button { width: var(--patter_control_height); height: var(--patter_control_height); justify-content: center; }
    .round_button > .patter_surface { border-radius: 50%; }
</style>
