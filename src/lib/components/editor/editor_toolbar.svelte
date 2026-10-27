<script>
    import { list_recovery_snapshots, dismiss_recovery_snapshot, cancel_pending_recovery } from '$lib/state/editor_recovery.js';
    import { createExportFilename } from '$lib/state/editor_filename.js';
	import { track_event } from '$lib/state/analytics.js';
	import { onMount } from 'svelte';
	import Button from '$lib/components/button.svelte';
	import DropdownButton from '$lib/components/dropdown_button.svelte';
	import { editorHasContent, exportEditorDocument } from '$lib/state/editor_export.js';
	import { readTextImport } from '$lib/state/editor_import.js';

	let hasContent = $state(false);
	let importInput;
    let recent_snapshots = [];
    let restoring = $state(false);
    let open_options = $state([{ label: 'Open file', value: 'file' }]);
    const snapshot_date = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    async function refresh_snapshots() {
        try {
            recent_snapshots = await list_recovery_snapshots();
            open_options = [{ label: 'Open file', value: 'file' }, ...recent_snapshots.map((snapshot, index) => ({
                value: String(snapshot.id),
                dismissible: true,
                separator: index === 0,
                label: createExportFilename(snapshot.text, 'txt', new Date(snapshot.created)).replace(/\.txt$/, ''),
                meta: snapshot_date.format(snapshot.created)
            })), ...(recent_snapshots.length ? [] : [{ value: 'empty', label: 'No saved snapshots', separator: true, empty: true }])];
        } catch { importError = 'Recent writing could not be loaded on this device.'; }
    }

    function preview_snapshot(value) {
        const snapshot = recent_snapshots.find((item) => String(item.id) === value);
        window.dispatchEvent(new CustomEvent('patter-preview-snapshot', { detail: { text: snapshot?.text ?? null } }));
    }

    async function dismiss_snapshot(value) {
        const snapshot = recent_snapshots.find((item) => String(item.id) === value);
        if (!snapshot) return false;
        try {
            await dismiss_recovery_snapshot(snapshot.id);
            preview_snapshot(null);
            await refresh_snapshots();
            return true;
        } catch {
            return false;
        }
    }

    async function select_open(value) {
        if (value === 'file') { importInput?.click(); return; }
        const snapshot = recent_snapshots.find((item) => String(item.id) === value);
        if (!snapshot || restoring) return;
        restoring = true;
        try {
            cancel_pending_recovery();
            window.dispatchEvent(new CustomEvent('patter-import-document', { detail: { body: snapshot.text, restored: true } }));
            importError = '';
        } catch { importError = 'This snapshot could not be restored. Your current writing is unchanged.'; }
        finally { restoring = false; }
    }
	let importError = $state('');
	const exportOptions = [
		{ label: 'Save as .txt', menuLabel: 'as txt', value: 'txt', primary: true },
		{ label: 'Save as .md', menuLabel: 'as md', value: 'md' }
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
            cancel_pending_recovery();
			window.dispatchEvent(new CustomEvent('patter-import-document', { detail: { body } }));
			importError = '';
            track_event('document_imported', { format: /\.md$/i.test(file.name) ? 'md' : 'txt' });
		} catch (error) {
			importError = error instanceof Error ? error.message : 'This file could not be opened.';
		}
	}

</script>

<div class="flex w-full shrink-0 min-w-0 flex-wrap items-center justify-between gap-3 px-2 sm:flex-nowrap sm:gap-4 sm:px-8" data-zen-mode-ui="editor-toolbar">
	<Button round icon="/chevron_left.svg" ariaLabel="Back home" href="/" />
	<div class="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2 sm:gap-4">
		<DropdownButton text="Save" options={exportOptions} disabled={!hasContent} onexport={(format) => exportEditorDocument(format)} />
		<DropdownButton text="Open" ariaLabel="Open options" options={open_options} menuWidth="18.5rem" disabled={restoring} onopen={refresh_snapshots} onpreview={preview_snapshot} ondismiss={dismiss_snapshot} onselect={select_open} />
	</div>
	<input bind:this={importInput} class="sr-only" type="file" accept=".txt,.md,text/plain,text/markdown" onchange={importDocument} aria-label="Open a text or Markdown file" tabindex="-1" />
</div>
{#if importError}<p class="patter_text_small px-4 sm:px-8 pt-2 text-right text-red-200/80" role="status">{importError}</p>{/if}
