const STORAGE_KEY = 'patter-video-posters';
const MAX_POSTERS = 16;
const upgradedImagePosters = new Set();

export function getBackgroundPoster(key) {
    if (typeof window === 'undefined') return null;
    try {
        const posters = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        return typeof posters[key] === 'string' ? posters[key] : null;
    } catch {
        return null;
    }
}

export function saveBackgroundPoster(key, dataUrl) {
    if (typeof window === 'undefined') return;
    try {
        const posters = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        delete posters[key];
        posters[key] = dataUrl;
        while (Object.keys(posters).length > MAX_POSTERS) {
            delete posters[Object.keys(posters)[0]];
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(posters));
    } catch {
        // A poster is a cache. Storage limits should never block video playback.
    }
}

export function removeBackgroundPoster(key) {
    if (typeof window === 'undefined') return;
    try {
        const posters = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        delete posters[key];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(posters));
    } catch {
        // Ignore unavailable storage; poster data can be regenerated.
    }
}

export function createVideoPoster(video) {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return null;
    return encodePoster(video, video.videoWidth, video.videoHeight);
}

export async function createImagePoster(blob) {
    const imageUrl = URL.createObjectURL(blob);
    try {
        const image = new Image();
        image.src = imageUrl;
        await image.decode();
        // Image previews paint before IndexedDB restores the full upload.
        // Keep enough detail to make the transition to the original subtle,
        // including for portrait photos. Video posters stay smaller below.
        return encodePoster(image, image.naturalWidth, image.naturalHeight, 1280, 1280, 0.76);
    } finally {
        URL.revokeObjectURL(imageUrl);
    }
}

export async function upgradeImagePoster(key, blob) {
    if (upgradedImagePosters.has(key)) return;
    upgradedImagePosters.add(key);

    const existing = getBackgroundPoster(key);
    if (existing) {
        const image = new Image();
        image.src = existing;
        try {
            await image.decode();
            if (image.naturalWidth >= 1280 || image.naturalHeight >= 1280) return;
        } catch {
            // Replace unreadable or older low-resolution previews below.
        }
    }

    const poster = await createImagePoster(blob);
    if (poster) saveBackgroundPoster(key, poster);
}

function encodePoster(source, sourceWidth, sourceHeight, maxWidth = 640, maxHeight = 360, quality = 0.68) {
    if (!sourceWidth || !sourceHeight) return null;
    const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', quality);
}
