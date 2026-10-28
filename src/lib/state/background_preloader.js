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
    const loaded = new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error(`Could not load background image: ${src}`));
        image.src = src;
        if (image.complete && image.naturalWidth > 0) resolve();
    });
    const promise = loaded.then(async () => {
        try { await image.decode?.(); }
        catch (error) { if (!image.naturalWidth) throw error; }
        return image;
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
