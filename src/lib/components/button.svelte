<script>
	import { goto } from '$app/navigation';

	let { text = null, href = null, icon = null, sound = "/type.mp3", onclick = null, cooldown = 150, disabled = false } = $props();

	let lastPlayed = 0;

	function playSound(src) {
		if (!src) return;

		const now = performance.now();
		if (now - lastPlayed < cooldown) return;
		lastPlayed = now;

		const audio = new Audio(src);
		audio.volume = 0.15;
		audio.play();
	}

	function handleClick(event) {
		if (disabled) return;
		playSound(sound);
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
    onclick={handleClick}
    class="group/hitbox flex items-center relative w-fit cursor-pointer font-[Bitter] disabled:cursor-default disabled:opacity-30 disabled:pointer-events-none">
    <div
        class="absolute inset-0 rounded-xl group-hover/hitbox:rounded-2xl group-active/hitbox:rounded-3xl
        bg-linear-to-b from-mauve-100/6 to-mauve-100/0
        backdrop-blur-lg 
        outline-2 outline-offset-2 outline-mauve-100/12 group-hover/hitbox:outline-mauve-100/24
        patter_shadow
        transition-[inset,border-radius,outline] duration-200 ease-out
        group-hover/hitbox:inset-1
        group-active/hitbox:inset-2">
    </div>

    <span class="flex items-center gap-2 relative px-4 py-3 pointer-events-none select-none min-h-12">
        {text}
        {#if icon}
            <img src="{icon}" alt="" class="size-5 fill-black select-none pointer-events-none opacity-80" draggable="false">
        {/if}
    </span>
</button>
