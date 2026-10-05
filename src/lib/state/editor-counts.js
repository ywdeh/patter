const blockTags = new Set([
    'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT',
    'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3',
    'H4', 'H5', 'H6', 'HEADER', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE',
    'SECTION', 'TABLE', 'TR', 'UL'
]);

const horizontalSpaces = /[\t \u00a0]+/gu;
const trailingHorizontalSpaces = /[\t \u00a0]+$/u;
const wordSeparators = /\s+/u;
const DEFAULT_READING_WORDS_PER_MINUTE = 270;

const graphemeSegmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

function textFromNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const children = Array.from(node.childNodes);
    if (node.tagName === 'BR') return '\n';

    // Contenteditable uses one or more BRs as the visual marker for a blank line.
    if (children.length > 0 && children.every((child) => child.nodeName === 'BR')) {
        return '\n'.repeat(Math.max(0, children.length - 1));
    }

    let text = '';
    let previousWasBlock = false;
    for (const child of children) {
        const isBlock = child.nodeType === Node.ELEMENT_NODE && blockTags.has(child.nodeName);
        if (isBlock && previousWasBlock) text += '\n';
        text += textFromNode(child);
        previousWasBlock = isBlock;
    }
    return text;
}

function countGraphemes(text) {
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

export function getEditorText(element) {
    return textFromNode(element);
}

export function countEditorText(titleElement, bodyElement) {
    const title = getEditorText(titleElement);
    const body = getEditorText(bodyElement);

    return {
        words: countWords(`${title}\n${body}`),
        characters: countCharacters(title) + countCharacters(body)
    };
}

export function estimateReadingTime(wordCount, wordsPerMinute = DEFAULT_READING_WORDS_PER_MINUTE) {
    const words = Math.max(0, Number(wordCount) || 0);
    const rate = Math.max(1, Number(wordsPerMinute) || DEFAULT_READING_WORDS_PER_MINUTE);
    let minutes = words === 0 ? 0 : Math.ceil(words / rate);
    const hours = Math.floor(minutes / 60);
    minutes %= 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}
