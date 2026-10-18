import { base, build, files, version } from '$service-worker';

const cache_prefix = 'patter-offline-';
const cache_name = `${cache_prefix}${version}`;
const pages = [`${base}/`, `${base}/editor`];
const static_files = files.filter((file) =>
    /\.(?:css|js|woff2?|webp|avif|png|jpe?g|svg|ico|mp3|webmanifest)$/i.test(file)
);
const cached_paths = new Set([...build, ...static_files, ...pages]);

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(cache_name);
        try {
            await cache.addAll([...cached_paths].map((path) => new Request(path, { cache: 'reload' })));
        } catch (error) {
            await caches.delete(cache_name);
            throw error;
        }
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names
            .filter((name) => name.startsWith(cache_prefix) && name !== cache_name)
            .map((name) => caches.delete(name)));
        await self.clients.claim();
    })());
});

async function cached_response(request, path) {
    const cache = await caches.open(cache_name);
    const response = await cache.match(path);
    if (!response) return fetch(request);

    const range = request.headers.get('range');
    if (!range) return response;
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return fetch(request);

    const buffer = await response.arrayBuffer();
    const size = buffer.byteLength;
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }
    const headers = new Headers(response.headers);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(buffer.slice(start, end + 1), { status: 206, headers });
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        const path = url.pathname === `${base}/editor/` ? `${base}/editor` : url.pathname;
        if (pages.includes(path)) event.respondWith(cached_response(request, path));
        return;
    }

    if (cached_paths.has(url.pathname)) event.respondWith(cached_response(request, url.pathname));
});
