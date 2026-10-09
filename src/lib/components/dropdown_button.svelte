<script>
	import { onMount, tick } from 'svelte';
	import { playTapSound } from '$lib/state/tap_sound.js';

	let {
		text = 'Export',
		options = [],
		onselect = null,
		onexport = null,
		disabled = false,
		ariaLabel = 'Export options'
	} = $props();

	let root;
	let menu = $state(null);
	let menuTrigger;
	let open = $state(false);
	let selectedValue = $state('');
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
		playTapSound();
		if (open) {
			closeMenu();
			return;
		}
		open = true;
		await tick();
		updateMenuPosition();
		menu?.querySelector('button')?.focus();
	}

	function selectOption(option) {
		if (!option) return;
		selectedValue = option.value;
		closeMenu();
		menuTrigger?.focus();
		playTapSound();
		onselect?.(option.value, option);
	}

	function exportSelected() {
		if (disabled || !selectedOption) return;
		playTapSound();
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
		};
	});
</script>

<div bind:this={root} class="patter_control_text relative inline-flex w-fit" role="group" aria-label={text}>
	<div class="patter_control group/hitbox relative flex items-center w-fit" class:patter_disabled={disabled}>
		<div class="patter_surface patter_hover patter_active absolute inset-0 rounded-xl bg-linear-to-b from-mauve-100/6 to-mauve-100/0 backdrop-blur-lg"></div>
		<button type="button" disabled={disabled} class="relative min-h-12 cursor-pointer select-none px-4 py-3 disabled:cursor-default disabled:pointer-events-none" onclick={exportSelected}>
			<span class="grid whitespace-nowrap">
				<span class="col-start-1 row-start-1">{selectedText}</span>
				{#each options as option (option.value)}
					<span aria-hidden="true" class="invisible col-start-1 row-start-1">{option.label}</span>
				{/each}
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
			class="patter_control_text fixed z-[10000] min-w-max rounded-xl p-1 outline-2 outline-offset-2 outline-mauve-100/16"
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
