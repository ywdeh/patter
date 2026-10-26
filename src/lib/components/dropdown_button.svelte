<script>
	import { can_use_wheel_controls } from '$lib/state/user_interaction.js';
	import { onMount, tick } from 'svelte';
	import { playSound } from '$lib/state/sound.js';
	import { motionDuration } from '$lib/state/motion.js';

	let {
		text = 'Save',
		options = [],
		onselect = null,
		onexport = null,
		disabled = false,
		sound = 'click',
		ariaLabel = 'Save options'
	} = $props();

	let root;
	let menu = $state(null);
	let menuTrigger;
	let open = $state(false);
	let selectedValue = $state('');
	let wheelRemainder = 0;
	let wheelOnCooldown = false;
	let wheelCooldownTimer = null;
	const wheelCooldownDuration = motionDuration('short', 150);
	let menuPosition = $state({ top: 0, left: 0, minWidth: 0 });
	let selectedOption = $derived(options.find((option) => option.value === selectedValue) ?? options[0]);

	$effect(() => {
		if (disabled) closeMenu();
	});

	$effect(() => {
		if (!options.some((option) => option.value === selectedValue)) {
			selectedValue = options.find((option) => option.primary)?.value ?? options[0]?.value ?? '';
		}
	});

	function closeMenu() {
		open = false;
	}

	function portalToBody(node) {
		document.body.append(node);
		return {
			destroy() {
				node.remove();
		}
	};
	}

	function updateMenuPosition() {
		if (!root || !menu) return;
		const trigger = root.getBoundingClientRect();
		const menuBounds = menu.getBoundingClientRect();
		const width = Math.max(trigger.width, menuBounds.width);
		const left = Math.max(8, Math.min(window.innerWidth - width - 8, trigger.right - width));
		const below = trigger.bottom + 12;
		const top = below + menuBounds.height <= window.innerHeight - 8
			? below
			: Math.max(8, trigger.top - menuBounds.height - 12);
		menuPosition = { top, left, minWidth: trigger.width };
	}

	async function toggleMenu() {
		if (disabled) return;
		playSound(sound);
		if (open) {
			closeMenu();
			return;
		}
		open = true;
		await tick();
		if (disabled || !open) return;
		updateMenuPosition();
		menu?.querySelector('button')?.focus();
	}

	function applyOption(option, returnFocus = false) {
		if (disabled || !option) return;
		if (option.value === selectedValue) return;
		const previousIndex = options.findIndex((item) => item.value === selectedValue);
		const nextIndex = options.findIndex((item) => item.value === option.value);
		selectedValue = option.value;
		closeMenu();
		if (returnFocus) menuTrigger?.focus();
		playSound(sound);
		onselect?.(option.value, option);
	}

	function selectOption(option) {
		if (disabled || !option) return;
		if (option?.value === selectedValue) {
			closeMenu();
			menuTrigger?.focus();
			playSound(sound);
			onselect?.(option.value, option);
			return;
		}
		applyOption(option, true);
	}

	function handleWheel(event) {
		if (!can_use_wheel_controls(event)) return;
		if (disabled || options.length < 2) return;
		event.preventDefault();
		if (wheelOnCooldown) return;

		const delta = event.deltaY * (event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? window.innerHeight : 1);
		wheelRemainder += delta;
		if (Math.abs(wheelRemainder) < 5) return;

		const step = Math.sign(wheelRemainder);
		wheelRemainder = 0;
		const currentIndex = options.findIndex((option) => option.value === selectedValue);
		const nextIndex = Math.max(0, Math.min(options.length - 1, currentIndex + step));
		if (nextIndex !== currentIndex) applyOption(options[nextIndex]);

		wheelOnCooldown = true;
		wheelCooldownTimer = setTimeout(() => {
			wheelOnCooldown = false;
			wheelCooldownTimer = null;
		}, wheelCooldownDuration);
	}

	function attachNonPassiveWheel(node) {
		node.addEventListener('wheel', handleWheel, { passive: false });
		return () => {
			node.removeEventListener('wheel', handleWheel);
			clearTimeout(wheelCooldownTimer);
		};
	}

	function exportSelected() {
		if (disabled || !selectedOption) return;
		playSound(sound);
		onexport?.(selectedValue, selectedOption);
	}

	function handleDocumentPointerDown(event) {
		if (!root?.contains(event.target) && !menu?.contains(event.target)) closeMenu();
	}

	function handleDocumentKeydown(event) {
		if (event.key === 'Escape' && open) {
			closeMenu();
			menuTrigger?.focus();
		}
	}

	function handleViewportChange() {
		if (open) updateMenuPosition();
	}

	onMount(() => {
		document.addEventListener('pointerdown', handleDocumentPointerDown);
		document.addEventListener('keydown', handleDocumentKeydown);
		window.addEventListener('resize', handleViewportChange);
		window.addEventListener('scroll', handleViewportChange, true);
		return () => {
			document.removeEventListener('pointerdown', handleDocumentPointerDown);
			document.removeEventListener('keydown', handleDocumentKeydown);
			window.removeEventListener('resize', handleViewportChange);
			window.removeEventListener('scroll', handleViewportChange, true);
			clearTimeout(wheelCooldownTimer);
		};
	});
</script>

<div bind:this={root} class="patter_control_text relative inline-flex w-fit" class:pointer-events-none={disabled} role="group" aria-label={text} {@attach attachNonPassiveWheel}>
	<div class="patter_control group/hitbox relative flex items-center w-fit" class:patter_disabled={disabled}>
		<div class="patter_surface patter_hover patter_active absolute inset-0 rounded-xl patter_surface_gradient backdrop-blur-lg"></div>
		<button type="button" disabled={disabled} aria-label={selectedOption?.label ?? text} class="relative min-h-(--patter_control_height) cursor-pointer px-3 py-2 disabled:cursor-default disabled:pointer-events-none" onclick={exportSelected}>
			{text}
		</button>
		<button bind:this={menuTrigger} type="button" disabled={disabled} aria-label={ariaLabel} aria-expanded={open} aria-controls={open ? 'export-format-options' : undefined} class="relative flex min-h-(--patter_control_height) min-w-9 cursor-pointer items-center justify-center px-2 transition-colors hover:text-mauve-100 disabled:cursor-default disabled:pointer-events-none" onclick={toggleMenu}>
            <svg class="save_chevrons patter_icon size-4 pointer-events-none" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m5 5 3-3 3 3m-6 6 3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</button>
	</div>

	{#if open}
		<div
			bind:this={menu}
			use:portalToBody
			id="export-format-options"
			role="group"
			aria-label="Save format"
			class="patter_control_text fixed z-500 min-w-max rounded-xl p-1 outline-2 outline-offset-2 patter_outline_normal"
			style={`top:${menuPosition.top}px;left:${menuPosition.left}px;min-width:${menuPosition.minWidth}px`}
		>
			<div aria-hidden="true" class="patter_surface pointer-events-none absolute inset-0 rounded-xl patter_surface_gradient backdrop-blur-lg"></div>
			{#each options as option (option.value)}
				<button type="button" aria-pressed={selectedValue === option.value} class="relative z-10 block w-full whitespace-nowrap rounded-lg px-3 py-2 text-left transition-colors hover:bg-(--patter_surface_normal)" onclick={() => selectOption(option)}>
					{option.menuLabel ?? option.label}
					{#if selectedValue === option.value}<span class="ml-3 opacity-(--patter_opacity_secondary)" aria-hidden="true">✓</span>{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
    .patter_control:active .save_chevrons, .patter_control.wheel_pressed .save_chevrons { scale: 1; }
</style>
