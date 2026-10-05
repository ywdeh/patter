import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { backgroundKindFromFilename, backgroundExtensions } from './src/lib/state/background-formats.js';

const virtualBackgroundsId = 'virtual:patter-backgrounds';
const resolvedVirtualBackgroundsId = '\0' + virtualBackgroundsId;

function discoverBackgrounds() {
	return {
		name: 'patter-background-catalog',
		resolveId(id: string) {
			if (id === virtualBackgroundsId) return resolvedVirtualBackgroundsId;
		},
		load(id: string) {
			if (id !== resolvedVirtualBackgroundsId) return;
			const directory = path.resolve(process.cwd(), 'static/backgrounds');
			const files = fs.existsSync(directory) ? fs.readdirSync(directory) : [];
			const backgrounds = files
				.filter((file) => backgroundExtensions.includes(file.split('.').pop()?.toLowerCase() ?? ''))
				.sort((a, b) => a.localeCompare(b))
				.map((file) => ({ src: '/backgrounds/' + file, kind: backgroundKindFromFilename(file) }));
			return `export default ${JSON.stringify(backgrounds)};`;
		}
	};
}

export default defineConfig({
	server: {
		// Vite's recursive public-directory watcher can fail on locked image files on Windows.
		// The background catalog is discovered again on the next dev-server start.
		watch: {
			ignored: ['**/static/backgrounds/**']
		}
	},
	plugins: [
		discoverBackgrounds(),
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	]
});
