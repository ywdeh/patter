const preloadedImages = new Map();

/** Load and decode a built-in background once, retaining the image in memory. */
export function loadBackgroundImage(src) {
    if (typeof window === 'undefined' || !src) return Promise.resolve(null);

    const existing = preloadedImages.get(src);
    if (existing) return existing.promise;

    const image = new Image();
    image.decoding = 'async';
    const promise = new Promise((resolve, reject) => {
        image.onload = async () => {
            try {
                if (typeof image.decode === 'function') await image.decode();
                resolve(image);
            } catch (error) {
                // Some browsers can reject decode even when the image loaded.
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

    preloadedImages.set(src, { image, promise });
    // Failed requests can be retried later if the user selects that background.
    void promise.catch(() => preloadedImages.delete(src));
    return promise;
}

export function preloadBackgroundImages(backgrounds) {
    if (typeof window === 'undefined') return;
    for (const background of backgrounds) {
        if (background.kind === 'image') void loadBackgroundImage(background.src).catch(() => {});
    }
}
