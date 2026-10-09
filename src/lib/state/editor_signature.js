export const EXPORT_SIGNATURE = '- written in Patter';
export const LEGACY_EXPORT_SIGNATURES = ['written in patter'];

export function createExportSignaturePattern() {
    const signatures = [EXPORT_SIGNATURE, ...LEGACY_EXPORT_SIGNATURES]
        .map((signature) => signature.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
        .join('|');
    return new RegExp(`(?:^|\\n)[\\t ]*(?:${signatures})[\\t ]*(?=\\n|$)`, 'giu');
}
