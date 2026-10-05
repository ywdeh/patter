const EXPORT_SIGNATURE = 'written in patter';

export function parseTextImport(value) {
    const text = String(value ?? '').replace(/\r\n?/gu, '\n').trimStart();
    return text
        .replace(new RegExp(`(?:^|\\n)[\\t ]*${EXPORT_SIGNATURE}[\\t ]*(?=\\n|$)`, 'giu'), '')
        .trimEnd();
}

export async function readTextImport(file) {
    if (!file || !file.name.toLowerCase().endsWith('.txt')) {
        throw new TypeError('Choose a .txt file to import.');
    }
    return parseTextImport(await file.text());
}
