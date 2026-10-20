const STORAGE_KEY = 'patter-video-posters';
const MAX_POSTERS = 16;

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
    }
}

export function removeBackgroundPoster(key) {
    if (typeof window === 'undefined') return;
    try {
        const posters = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        delete posters[key];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(posters));
    } catch {
    }
}

export function createVideoPoster(video) {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return null;
    return encodePoster(video, video.videoWidth, video.videoHeight, 1920, 1080, 0.82);
}

export async function createImagePoster(blob) {
    const imageUrl = URL.createObjectURL(blob);
    try {
        const image = new Image();
        image.src = imageUrl;
        await image.decode();
        return encodePoster(image, image.naturalWidth, image.naturalHeight, 1280, 1280, 0.76);
    } finally {
        URL.revokeObjectURL(imageUrl);
    }
}

export async function ensureImagePoster(key, blob) {

    const existing = getBackgroundPoster(key);
    if (existing) {
        const image = new Image();
        image.src = existing;
        try {
            await image.decode();
            return;
        } catch {
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
