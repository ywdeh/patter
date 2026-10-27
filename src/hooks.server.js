import backgrounds from 'virtual:patter-backgrounds';

const background_catalog = JSON.stringify(backgrounds.map(({ src, kind }) => ({ src, kind })))
    .replace(/</gu, '\\u003c');

export function handle({ event, resolve }) {
    return resolve(event, {
        transformPageChunk: ({ html }) => html.replace('const backgrounds = [];', `const backgrounds = ${background_catalog};`)
    });
}
