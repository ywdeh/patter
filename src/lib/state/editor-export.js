import { getEditorText } from '$lib/state/editor-counts.js';

const EXPORT_SIGNATURE = 'written in patter';

export function buildTextExport(title, body) {
    const cleanTitle = String(title ?? '').replace(/[\r\n]+/gu, ' ');
    const cleanBody = String(body ?? '').replace(/\r\n?/gu, '\n');
    return [cleanTitle, cleanBody, EXPORT_SIGNATURE]
        .filter((section, index) => index === 2 || section.trim() !== '')
        .join('\n\n');
}

function filenameFromTitle(title) {
    const safeTitle = String(title ?? '')
        .trim()
        .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '')
        .replace(/[. ]+$/gu, '')
        .slice(0, 100);
    return `${safeTitle || 'Patter'}.txt`;
}

export function downloadTextExport(title, body) {
    const file = new Blob([buildTextExport(title, body)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = filenameFromTitle(title);
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function editorHasContent() {
    const titleElement = document.querySelector('[data-patter-title]');
    const bodyElement = document.querySelector('[data-patter-body]');
    const title = String(titleElement?.innerText ?? '').trim();
    const body = bodyElement ? getEditorText(bodyElement).trim() : '';
    return title !== '' || body !== '';
}

export function exportEditorDocument() {
    const titleElement = document.querySelector('[data-patter-title]');
    const bodyElement = document.querySelector('[data-patter-body]');
    const title = String(titleElement?.innerText ?? '').replace(/[\r\n]+/gu, ' ');
    const body = bodyElement ? getEditorText(bodyElement) : '';
    if (!title.trim() && !body.trim()) return;
    downloadTextExport(title, body);
}
