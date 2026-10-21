const horizontalSpaces = /[\t \u00a0]+/gu;
const trailingHorizontalSpaces = /[\t \u00a0]+$/u;
const wordSeparators = /\s+/u;
const DEFAULT_READING_WORDS_PER_MINUTE = 270;

const graphemeSegmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

function countGraphemes(text) {
    if (/^[\x00-\x7f]*$/u.test(text)) return text.length;
    if (!graphemeSegmenter) return Array.from(text).length;
    let count = 0;
    for (const _segment of graphemeSegmenter.segment(text)) count++;
    return count;
}

function countCharacters(text) {
    return text
        .replace(/\r\n?/gu, '\n')
        .split('\n')
        .reduce((total, line) => {
            const withoutTrailingSpaces = line.replace(trailingHorizontalSpaces, '');
            const collapsedSpaces = withoutTrailingSpaces.replace(horizontalSpaces, ' ');
            return total + countGraphemes(collapsedSpaces);
        }, 0);
}

function countWords(text) {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(wordSeparators).length : 0;
}

export function countEditorText(body) {
    return {
        words: countWords(body),
        characters: countCharacters(body)
    };
}

export function estimateReadingTime(wordCount, wordsPerMinute = DEFAULT_READING_WORDS_PER_MINUTE) {
    const words = Math.max(0, Number(wordCount) || 0);
    const rate = Math.max(1, Number(wordsPerMinute) || DEFAULT_READING_WORDS_PER_MINUTE);
    return formatMinutes(words === 0 ? 0 : Math.ceil(words / rate));
}

export function formatMinutes(totalMinutes) {
    let minutes = totalMinutes;
    const hours = Math.floor(minutes / 60);
    minutes %= 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}
