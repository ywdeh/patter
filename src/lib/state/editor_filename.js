import { render_markdown_line } from './markdown_render.js';

function cleanFilename(value) {
    const cleaned = value
        .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '')
        .replace(/[. ]+$/u, '')
        .replace(/\s+/gu, ' ')
        .trim()
        .slice(0, 80)
        .replace(/[. ]+$/u, '');
    return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(cleaned) ? '' : cleaned;
}

function localHourMinute(date) {
    return `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
}

export function createExportFilename(source, format = 'txt', date = new Date()) {
    const lines = String(source ?? '').replace(/\r\n?/gu, '\n').split('\n');
    let name = '';
    for (const line of lines) {
        const text = render_markdown_line(line.trim(), 0)._visible_text;
        const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['’][\p{L}\p{N}][\p{L}\p{N}\p{M}]*)*/gu);
        if (!words) continue;
        name = words.slice(0, 5).join(' ');
        break;
    }
    const extension = format === 'md' || format === 'png' ? format : 'txt';
    return `${cleanFilename(name) || `Patter document ${localHourMinute(date)}`}.${extension}`;
}
