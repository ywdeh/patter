import { schedule_idle_task } from './browser_tasks.js';

const preloadedImages = new Map();
const image_cache_limit = 8;

function trim_image_cache() {
    for (const [src, entry] of preloadedImages) {
        if (preloadedImages.size <= image_cache_limit) break;
        if (entry.settled) preloadedImages.delete(src);
    }
}
export function loadBackgroundImage(src, priority = 'high') {
    if (typeof window === 'undefined' || !src) return Promise.resolve(null);

    const existing = preloadedImages.get(src);
    if (existing) {
        preloadedImages.delete(src);
        preloadedImages.set(src, existing);
        if (priority === 'high') existing.image.fetchPriority = 'high';
        return existing.promise;
    }

    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = priority;
    const promise = new Promise((resolve, reject) => {
        image.onload = async () => {
            try {
                if (typeof image.decode === 'function') await image.decode();
                resolve(image);
            } catch (error) {
                if (image.naturalWidth > 0) resolve(image);
                else reject(error);
            }
        };
        image.onerror = () => reject(new Error(`Could not load background image: ${src}`));
        image.src = src;
        if (image.complete && image.naturalWidth > 0) {
            void image.decode?.().then(() => resolve(image), () => resolve(image));
        }
    });

    const entry = { image, promise, settled: false };
    preloadedImages.set(src, entry);
    void promise.then(() => {
        entry.settled = true;
        trim_image_cache();
    }, () => {
        if (preloadedImages.get(src) === entry) preloadedImages.delete(src);
    });
    return promise;
}

export function preloadBackgroundImages(backgrounds, selected_src) {
    if (typeof window === 'undefined') return;
    const selected = loadBackgroundImage(selected_src);
    const remaining = backgrounds.filter((item) => item.kind === 'image' && item.src !== selected_src);
    const warm_next = () => {
        const background = remaining.shift();
        if (!background) return;
        const warm = () => {
            void loadBackgroundImage(background.src, 'low').catch(() => {}).finally(warm_next);
        };
        schedule_idle_task(warm);
    };
    const start = () => {
        if (navigator.connection?.saveData || /^(slow-)?2g$/.test(navigator.connection?.effectiveType ?? '')) return;
        void selected.catch(() => {}).then(warm_next);
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
}
