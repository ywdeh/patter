export const DEFAULT_EDITOR_PLACEHOLDER = 'Once, there was a glorious kingdom...';

const placeholders = {
    '/backgrounds/castle.webp': 'Happiness can be found, even in the darkest of times, if one only remembers to turn on the light',
    '/backgrounds/lantern_in_the_forest.webp': 'May it be a light to you in dark places, when all other lights go out',
    '/backgrounds/rain.webp': 'The rain softened the world, and the words began to fall',
    '/backgrounds/winter_street.webp': 'Beyond the frosted windows, every home held a story',
};

export function getEditorPlaceholder(background) {
    return placeholders[background] ?? DEFAULT_EDITOR_PLACEHOLDER;
}
