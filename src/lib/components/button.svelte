<script>
	import { goto } from '$app/navigation';
	import { playTapSound } from '$lib/state/tap_sound.js';

	let { text = null, href = null, icon = null, sound = "/type.mp3", onclick = null, disabled = false, ariaLabel = null } = $props();

	function handleClick(event) {
		if (disabled) return;
		if (sound) playTapSound();
		onclick?.(event);

		if (!href || event.defaultPrevented) return;

		if (/^(https?:)?\/\//.test(href)) {
			window.location.href = href; // external
		} else {
			goto(href); // internal SvelteKit navigation
		}
	}
</script>

<button type="button"
	disabled={disabled}
	aria-label={ariaLabel}
    onclick={handleClick}
	class="patter_control patter_control_text group/hitbox flex items-center relative w-fit cursor-pointer disabled:cursor-default  disabled:pointer-events-none">
    <div
        class="patter_surface patter_hover active:patter_active {disabled ? '' : 'patter_active'} absolute inset-0 rounded-xl bg-linear-to-b from-mauve-100/6 to-mauve-100/0">
    </div>

    <span class="flex items-center gap-2 relative px-4 py-3 pointer-events-none select-none min-h-12">
        {text}
        {#if icon}
            <img src="{icon}" alt="" class="size-5 fill-black select-none pointer-events-none opacity-80" draggable="false">
        {/if}
    </span>
</button>
