import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { backgroundKindFromFilename, backgroundExtensions } from './src/lib/state/background_formats.js';

const virtualBackgroundsId = 'virtual:patter-backgrounds';
const resolvedVirtualBackgroundsId = '\0' + virtualBackgroundsId;

function discoverBackgrounds() {
	const thumbnailDirectory = path.resolve(process.cwd(), 'static/backgrounds/thumbnails');
	const thumbnailJobs = new Map<string, Promise<boolean>>();

	async function ensureThumbnail(file: string) {
		const sourcePath = path.resolve(process.cwd(), 'static/backgrounds', file);
		const thumbnailPath = path.join(thumbnailDirectory, `${file}.webp`);
		const existingJob = thumbnailJobs.get(thumbnailPath);
		if (existingJob) return existingJob;

		const job = (async () => {
			const sourceStat = await fs.promises.stat(sourcePath);
			try {
				const thumbnailStat = await fs.promises.stat(thumbnailPath);
				if (thumbnailStat.mtimeMs >= sourceStat.mtimeMs) return true;
			} catch {
			}

			await fs.promises.mkdir(thumbnailDirectory, { recursive: true });
			const temporaryPath = `${thumbnailPath}.tmp.webp`;
			try {
				await sharp(sourcePath)
					.rotate()
					.resize(480, 480, { fit: 'inside', withoutEnlargement: true })
					.webp({ quality: 72 })
					.toFile(temporaryPath);
				await fs.promises.rename(temporaryPath, thumbnailPath);
				return true;
			} catch (error) {
				await fs.promises.rm(temporaryPath, { force: true });
				console.warn(`Could not create thumbnail for ${file}; using its original image.`, error);
				return false;
			}
		})();
		thumbnailJobs.set(thumbnailPath, job);
		return job;
	}

	return {
		name: 'patter-background-catalog',
		resolveId(id: string) {
			if (id === virtualBackgroundsId) return resolvedVirtualBackgroundsId;
		},
		async load(id: string) {
			if (id !== resolvedVirtualBackgroundsId) return;
			const directory = path.resolve(process.cwd(), 'static/backgrounds');
			const files = fs.existsSync(directory) ? fs.readdirSync(directory) : [];
			const backgrounds = await Promise.all(files
				.filter((file) => backgroundExtensions.includes(file.split('.').pop()?.toLowerCase() ?? ''))
				.sort((a, b) => a.localeCompare(b))
				.map(async (file) => {
					const kind = backgroundKindFromFilename(file);
					const hasThumbnail = kind === 'image'
						? await ensureThumbnail(file)
						: fs.existsSync(path.join(thumbnailDirectory, `${file}.webp`));
					return {
						src: '/backgrounds/' + file,
						kind,
						thumbnail: hasThumbnail ? `/backgrounds/thumbnails/${file}.webp` : null
					};
				}));
			return `export default ${JSON.stringify(backgrounds)};`;
		}
	};
}

export default defineConfig({
	server: {
		watch: {
			ignored: ['**/static/backgrounds/**']
		}
	},
	plugins: [
		discoverBackgrounds(),
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	]
});
