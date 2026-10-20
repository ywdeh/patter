export const EXPORT_SIGNATURE = '- written in Patter';

export function createExportSignaturePattern() {
    const signature = EXPORT_SIGNATURE.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    return new RegExp(`(?:^|\\n)[\\t ]*(?:${signature})[\\t ]*(?=\\n|$)`, 'giu');
}
