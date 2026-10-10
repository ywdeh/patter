<script>
	import { goto } from '$app/navigation';
	import { playTapSound } from '$lib/state/tap_sound.js';

	let { text = null, href = null, icon = null, sound = "/type.mp3", onclick = null, disabled = false, ariaLabel = null } = $props();

	function handleClick(event) {
		if (disabled) return;
		if (sound) playTapSound();
		onclick?.(event);
		if (!href || event.defaultPrevented) return;
		if (/^(https?:)?\/\//.test(href)) window.location.href = href;
		else goto(href);
	}
</script>

{#snippet buttonContent()}
    <span class="flex min-h-12 items-center gap-2 relative px-4 py-3 pointer-events-none">
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
