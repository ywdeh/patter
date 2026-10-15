<script>
	import { goto } from '$app/navigation';
	import { playSound } from '$lib/state/sound.js';

	let { text = null, href = null, icon = null, sound = 'click', onclick = null, disabled = false, ariaLabel = null } = $props();

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
    <span class="flex min-h-(--patter_control_height) items-center gap-2 relative px-3 py-2 pointer-events-none">
        {text}
        {#if icon}
            <img src={icon} alt="" class="size-5 fill-black pointer-events-none opacity-80" draggable="false">
        {/if}
    </span>
{/snippet}

<button
    type="button"
    disabled={disabled}
    aria-label={ariaLabel}
    onclick={handleClick}
    class="patter_control patter_control_text group/hitbox relative flex w-fit cursor-pointer items-center disabled:cursor-default disabled:pointer-events-none"
>
    <span class="patter_surface patter_hover {disabled ? '' : 'patter_active'} absolute inset-0 rounded-xl bg-linear-to-b from-mauve-100/6 to-mauve-100/0" aria-hidden="true"></span>
    {@render buttonContent()}
</button>
