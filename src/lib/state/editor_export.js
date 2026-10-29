import { track_event } from './analytics.js';
import { getEditorDocument } from '$lib/state/editor_document.js';
import { EXPORT_SIGNATURE } from '$lib/state/editor_signature.js';
import { createExportFilename } from '$lib/state/editor_filename.js';

export function buildTextExport(body) {
    const cleanBody = String(body ?? '').replace(/\r\n?/gu, '\n');
    return [cleanBody, EXPORT_SIGNATURE]
        .filter((section, index) => index === 1 || section.trim() !== '')
        .join('\n\n');
}

export function downloadTextExport(body, format = 'txt', filenameSource = body) {
	const normalizedFormat = format === 'md' ? 'md' : 'txt';
	const mimeType = normalizedFormat === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
	const file = new Blob([buildTextExport(body)], { type: mimeType });
    download_file(file, createExportFilename(filenameSource, normalizedFormat));
}

export function download_file(file, filename) {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function editorHasContent() {
    return getEditorDocument().trim() !== '';
}

export function exportEditorDocument(format = 'txt', text = getEditorDocument()) {
    const body = getEditorDocument();
    if (!body.trim()) return;
	downloadTextExport(text, format, body);
    track_event('document_exported', { format: format === 'md' ? 'md' : 'txt' });
}
