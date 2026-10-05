import { getEditorText } from '$lib/state/editor-counts.js';

const EXPORT_SIGNATURE = 'written in patter';

export function buildTextExport(body) {
    const cleanBody = String(body ?? '').replace(/\r\n?/gu, '\n');
    return [cleanBody, EXPORT_SIGNATURE]
        .filter((section, index) => index === 1 || section.trim() !== '')
        .join('\n\n');
}

export function downloadTextExport(body) {
    const file = new Blob([buildTextExport(body)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Patter.txt';
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function editorHasContent() {
    const bodyElement = document.querySelector('[data-patter-body]');
    const body = bodyElement ? getEditorText(bodyElement).trim() : '';
    return body !== '';
}

export function exportEditorDocument() {
    const bodyElement = document.querySelector('[data-patter-body]');
    const body = bodyElement ? getEditorText(bodyElement) : '';
    if (!body.trim()) return;
    downloadTextExport(body);
}
