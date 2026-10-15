<script>
	import { can_use_wheel_controls } from '$lib/state/user_interaction.js';
	import { onMount, tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import { playSound } from '$lib/state/sound.js';
	import { motionDuration } from '$lib/state/motion.js';

	let {
		text = 'Export',
		options = [],
		onselect = null,
		onexport = null,
		disabled = false,
		sound = 'click',
		ariaLabel = 'Export options'
	} = $props();

	let root;
	let menu = $state(null);
	let menuTrigger;
	let open = $state(false);
	let selectedValue = $state('');
	let direction = $state(1);
	let wheelRemainder = 0;
	let wheelOnCooldown = false;
	let wheelCooldownTimer = null;
	const outDuration = motionDuration('quick', 100);
	const inDuration = motionDuration('short', 150);
	const wheelCooldownDuration = motionDuration('short', 150);
	const labelShift = 8;
	let menuPosition = $state({ top: 0, left: 0, minWidth: 0 });
	let selectedOption = $derived(options.find((option) => option.value === selectedValue) ?? options[0]);
	let selectedText = $derived(selectedOption?.label ?? text);

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
		updateMenuPosition();
		menu?.querySelector('button')?.focus();
	}

	function applyOption(option, returnFocus = false) {
		if (!option) return;
		if (option.value === selectedValue) return;
		const previousIndex = options.findIndex((item) => item.value === selectedValue);
		const nextIndex = options.findIndex((item) => item.value === option.value);
		direction = nextIndex > previousIndex ? 1 : -1;
		selectedValue = option.value;
		closeMenu();
		if (returnFocus) menuTrigger?.focus();
		playSound(sound);
		onselect?.(option.value, option);
	}

	function selectOption(option) {
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
		if (!can_use_wheel_controls()) return;
		if (disabled || wheelOnCooldown || options.length < 2) return;
		event.preventDefault();

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

<div bind:this={root} class="patter_control_text relative inline-flex w-fit" role="group" aria-label={text} {@attach attachNonPassiveWheel}>
	<div class="patter_control group/hitbox relative flex items-center w-fit" class:patter_disabled={disabled}>
		<div class="patter_surface patter_hover patter_active absolute inset-0 rounded-xl bg-linear-to-b from-mauve-100/6 to-mauve-100/0 backdrop-blur-lg"></div>
		<button type="button" disabled={disabled} class="relative min-h-12 cursor-pointer px-4 py-3 disabled:cursor-default disabled:pointer-events-none" onclick={exportSelected}>
			<span class="grid whitespace-nowrap">
				{#each options as option (option.value)}
					<span aria-hidden="true" class="invisible col-start-1 row-start-1">{option.label}</span>
				{/each}
				<span class="dropdown_value_mask relative col-start-1 row-start-1 h-6">
					{#key selectedValue}
						<span class="absolute inset-0 whitespace-nowrap" in:fly={{ y: direction * labelShift, duration: inDuration, delay: outDuration }} out:fly={{ y: direction * -labelShift, duration: outDuration }}>{selectedText}</span>
					{/key}
				</span>
			</span>
		</button>
		<div aria-hidden="true" class="relative h-5 w-0.5 shrink-0 bg-mauve-100/12"></div>
		<button bind:this={menuTrigger} type="button" disabled={disabled} aria-label={ariaLabel} aria-expanded={open} aria-controls={open ? 'export-format-options' : undefined} class="relative flex min-h-12 min-w-10 cursor-pointer items-center justify-center px-2 transition-colors hover:text-white disabled:cursor-default disabled:pointer-events-none" onclick={toggleMenu}>
			<svg aria-hidden="true" viewBox="0 0 12 8" class="h-2 w-3 transition-transform" class:rotate-180={open} fill="none"><path d="m1 1 5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</button>
	</div>

	{#if open}
		<div
			bind:this={menu}
			use:portalToBody
			id="export-format-options"
			role="group"
			aria-label="Export format"
			class="patter_control_text fixed z-500 min-w-max rounded-xl p-1 outline-2 outline-offset-2 outline-mauve-100/16"
			style={`top:${menuPosition.top}px;left:${menuPosition.left}px;min-width:${menuPosition.minWidth}px`}
		>
			<div aria-hidden="true" class="patter_surface pointer-events-none absolute inset-0 rounded-xl bg-linear-to-b from-mauve-100/6 to-mauve-100/0 backdrop-blur-lg"></div>
			{#each options as option (option.value)}
				<button type="button" aria-pressed={selectedValue === option.value} class="relative z-10 block w-full whitespace-nowrap rounded-lg px-4 py-3 text-left transition-colors hover:bg-mauve-100/10 focus-visible:bg-mauve-100/10 focus-visible:outline-2 focus-visible:outline-mauve-100/40" onclick={() => selectOption(option)}>
					{option.menuLabel ?? option.label}
					{#if selectedValue === option.value}<span class="ml-3 opacity-60" aria-hidden="true">✓</span>{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.dropdown_value_mask {
		-webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 25%, #000 75%, transparent 100%);
		mask-image: linear-gradient(to bottom, transparent 0%, #000 25%, #000 75%, transparent 100%);
	}
</style>
