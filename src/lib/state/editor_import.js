import { createExportSignaturePattern } from '$lib/state/editor_signature.js';

export function parseTextImport(value) {
    const text = String(value ?? '').replace(/\r\n?/gu, '\n').trimStart();
    return text
        .replace(createExportSignaturePattern(), '')
        .trimEnd();
}

export async function readTextImport(file) {
    if (!file || !/\.(txt|md)$/iu.test(file.name)) {
        throw new TypeError('Choose a .txt or .md file to import.');
    }
    return parseTextImport(await file.text());
}
