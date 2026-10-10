# Patter

Patter is an ambient writing editor built with SvelteKit, Svelte 5, and Tailwind CSS. Drafts are stored locally in the browser; users should export important writing for backup.

## Project layout

- `src/routes` contains the home, editor, and error routes.
- `src/lib/components` contains the page and control components.
- `src/lib/state` contains focused editor, background, and interaction logic.
- `src/lib/styles/patter_styles.css` contains shared design tokens and component styles.
- `static` contains files served publicly, including fonts, sounds, icons, and built-in backgrounds.
- `unused` is a flat archive of retired assets and one-off scripts. It is outside `static` and is not deployed as public content.

## Development

```sh
npm install
npm run dev
```

Add supported built-in image or video backgrounds directly to `static/backgrounds`. The Vite plugin discovers the supported formats and creates image thumbnails under `static/backgrounds/thumbnails` when the catalog loads. The dev server deliberately ignores changes in this folder to avoid Windows file-watcher lock errors, so restart it after adding or replacing a background.

## Checks and production preview

```sh
npm run check
npm run build
npm run preview
```

There is no automated test suite configured yet. Before a release, also smoke-test the editor, import/export, background selection and upload, and fullscreen behavior in the target browsers.
