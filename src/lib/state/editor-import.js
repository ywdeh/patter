const EXPORT_SIGNATURE = 'written in patter';

export function parseTextImport(value) {
    const text = String(value ?? '').replace(/\r\n?/gu, '\n').trimStart();
    const withoutSignature = text
        .replace(new RegExp(`(?:^|\\n)[\\t ]*${EXPORT_SIGNATURE}[\\t ]*(?=\\n|$)`, 'giu'), '')
        .trimEnd();
    const titleSeparator = withoutSignature.indexOf('\n\n');

    if (titleSeparator > 0) {
        return {
            title: withoutSignature.slice(0, titleSeparator).replace(/[\r\n]+/gu, ' '),
            body: withoutSignature.slice(titleSeparator + 2)
        };
    }

    return { title: '', body: withoutSignature };
}

export async function readTextImport(file) {
    if (!file || !file.name.toLowerCase().endsWith('.txt')) {
        throw new TypeError('Choose a .txt file to import.');
    }
    return parseTextImport(await file.text());
}
