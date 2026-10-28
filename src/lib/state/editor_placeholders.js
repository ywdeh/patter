export const DEFAULT_EDITOR_PLACEHOLDER = 'Once, there was a glorious kingdom';

const placeholders = {
    '/backgrounds/castle.webp': 'Happiness can be found, even in the darkest of times, if one only remembers to turn on the light',
    '/backgrounds/lantern_in_the_forest.webp': 'Every lantern in that forest was meant to be someone’s way out, but no lantern burns forever',
    '/backgrounds/book.webp': 'A book is a memory that never asked to be made, yet has every right to remain',
    '/backgrounds/winter_street.webp': 'On the coldest night of winter, a visitor stood in the shadows and, trembling, held out his hand',
};

export function getEditorPlaceholder(background) {
    return placeholders[background] ?? DEFAULT_EDITOR_PLACEHOLDER;
}
