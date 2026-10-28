import { loadBackgroundImage } from './background_preloader.js';
import {
    BACKGROUND_AMBIENT_COLOR_ENABLED,
    DEFAULT_AMBIENT_BACKGROUND_COLOR,
    cacheAmbientBackgroundColor,
    cacheBackgroundScrim,
    getCachedAmbientBackgroundColor,
    getCachedBackgroundScrim,
    sample_background_palette
} from './background_ambient_color.js';
import { createVideoPoster, ensureImagePoster, getBackgroundPoster, saveBackgroundPoster } from './background_posters.js';

const startup_timeout = 8000;
export async function prepare_background(source, key, kind = 'image', priority = 'high') {
    if (kind === 'image') await loadBackgroundImage(source, priority);
    const cached_color = getCachedAmbientBackgroundColor(key);
    const cached_scrim = getCachedBackgroundScrim(key);
    const sampled = (BACKGROUND_AMBIENT_COLOR_ENABLED && cached_color === null) || cached_scrim === null
        ? await sample_background_palette(source, kind)
        : null;
    const color = BACKGROUND_AMBIENT_COLOR_ENABLED ? cached_color ?? sampled?.color ?? null : DEFAULT_AMBIENT_BACKGROUND_COLOR;
    const scrim = cached_scrim ?? sampled?.scrim ?? null;
    if (cached_color === null && color) cacheAmbientBackgroundColor(key, color);
    if (cached_scrim === null && scrim !== null) cacheBackgroundScrim(key, scrim);
    return { color, scrim };
}

export async function prepare_uploaded_background(record, url) {
    const key = 'upload:' + record.id;
    if (record.kind === 'image') {
        await Promise.all([prepare_background(url, key), ensureImagePoster(key, record.blob)]);
        return;
    }
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    try {
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => finish(new Error('Video preparation timed out')), startup_timeout);
            const finish = (error = null) => {
                clearTimeout(timer);
                video.removeEventListener('loadeddata', ready);
                video.removeEventListener('error', failed);
                video.removeEventListener('abort', failed);
                if (error) reject(error);
                else resolve();
            };
            const ready = () => finish();
            const failed = () => finish(new Error('Could not prepare video'));
            video.addEventListener('loadeddata', ready, { once: true });
            video.addEventListener('error', failed, { once: true });
            video.addEventListener('abort', failed, { once: true });
            video.src = url;
            video.load();
        });
        await prepare_background(video, key, 'video');
        if (!getBackgroundPoster(key)) {
            const poster = createVideoPoster(video);
            if (poster) saveBackgroundPoster(key, poster);
        }
    } finally {
        video.pause();
        video.removeAttribute('src');
        video.load();
    }
}

export async function wait_for_background_preparation(tasks) {
    let timer;
    try {
        await Promise.race([
            Promise.allSettled(tasks),
            new Promise((resolve) => { timer = setTimeout(resolve, startup_timeout); })
        ]);
    } finally {
        clearTimeout(timer);
    }
}
