const preloadedImages = new Map();
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
    void promise.catch(() => preloadedImages.delete(src));
    return promise;
}

export function preloadBackgroundImages(backgrounds) {
    if (typeof window === 'undefined') return;
    for (const background of backgrounds) {
        if (background.kind === 'image') void loadBackgroundImage(background.src).catch(() => {});
    }
}
