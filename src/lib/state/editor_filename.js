function stripInlineMarkdown(value) {
    return value
        .replace(/!?(\[([^\]]*)\])\([^)]*\)/gu, '$2')
        .replace(/(`{1,3})(.*?)\1/gu, '$2')
        .replace(/(\*\*|__)(.*?)\1/gu, '$2')
        .replace(/([*_~])([^*_~]+)\1/gu, '$2')
        .replace(/\\([\\`*_{}\[\]()#+\-.!>])/gu, '$1')
        .trim();
}

function titleCaseFirstWords(value, count = 5) {
    return value.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)
        ?.slice(0, count)
        .map((word) => word[0].toLocaleUpperCase() + word.slice(1))
        .join(' ') ?? '';
}

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
    const normalized = String(source ?? '').replace(/\r\n?/gu, '\n').trimStart();
    const heading = normalized.match(/^ {0,3}#{1,3}[\t ]+(.+?)[\t ]*(?:\n|$)/u)?.[1];
    const visibleText = stripInlineMarkdown(heading ?? normalized.split('\n', 1)[0]);
    const firstVisibleCharacter = Array.from(visibleText.trimStart())[0] ?? '';

    let name;
    if (heading) {
        name = visibleText;
    } else if (/^[\p{L}\p{N}]/u.test(firstVisibleCharacter)) {
        name = titleCaseFirstWords(visibleText);
    } else {
        name = `Patter document ${localHourMinute(date)}`;
    }

    return `${cleanFilename(name) || `Patter document ${localHourMinute(date)}`}.${format === 'md' ? 'md' : 'txt'}`;
}
