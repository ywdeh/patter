# Patter

Patter is an ambient writing editor built with SvelteKit, Svelte 5, Tailwind CSS, and Milkdown.

## Development

Install dependencies and start the Vite development server:

```sh
npm install
npm run dev
```

## Backgrounds

Add built-in image or video files to `static/backgrounds`. The Vite plugin discovers supported files automatically. Image thumbnail WebPs are generated under `static/backgrounds/thumbnails` when the catalog is loaded; full-size originals remain in use for the page background. The dev server ignores changes under this folder to avoid Windows file-watcher lock errors, so restart it after adding or replacing a background.

Videos are muted in the picker and play only while their thumbnail is hovered. The selected background video continues to play in the page background.

## Checks and production preview

```sh
npm run check
npm run build
npm run preview
```
