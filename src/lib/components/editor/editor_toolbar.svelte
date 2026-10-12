<script>
	import { onMount } from 'svelte';
	import Button from '$lib/components/button.svelte';
	import DropdownButton from '$lib/components/dropdown_button.svelte';
	import { editorHasContent, exportEditorDocument } from '$lib/state/editor_export.js';
	import { readTextImport } from '$lib/state/editor_import.js';

	let hasContent = $state(false);
	let importInput;
	let importError = $state('');
	const exportOptions = [
		{ label: 'Export as .txt', menuLabel: 'Select .txt', value: 'txt', primary: true },
		{ label: 'Export as .md', menuLabel: 'Select .md', value: 'md' }
	];

	onMount(() => {
		const update = (event) => { hasContent = event.detail?.hasContent ?? editorHasContent(); };
		window.addEventListener('patter-editor-content-change', update);
		queueMicrotask(() => { hasContent = editorHasContent(); });
		return () => window.removeEventListener('patter-editor-content-change', update);
	});

	async function importDocument(event) {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (!file) return;
		try {
			const body = await readTextImport(file);
			window.dispatchEvent(new CustomEvent('patter-import-document', { detail: { body } }));
			importError = '';
		} catch (error) {
			importError = error instanceof Error ? error.message : 'This file could not be imported.';
		}
	}

</script>

<div class="flex w-full shrink-0 min-w-0 flex-wrap items-center justify-between gap-3 px-2 sm:flex-nowrap sm:gap-4 sm:px-8" data-zen-mode-ui="editor-toolbar">
	<Button text="←" ariaLabel="Back home" href="/" />
	<div class="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2 sm:gap-4">
		<Button text="Import" onclick={() => importInput?.click()} />
		<DropdownButton text="Export" options={exportOptions} disabled={!hasContent} onexport={(format) => exportEditorDocument(format)} />
	</div>
	<input bind:this={importInput} class="sr-only" type="file" accept=".txt,.md,text/plain,text/markdown" onchange={importDocument} aria-label="Import a text or Markdown file" tabindex="-1" />
</div>
{#if importError}<p class="patter_text_small px-4 sm:px-8 pt-2 text-right text-red-200/80" role="status">{importError}</p>{/if}
