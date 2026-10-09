// Toggle ambient color sampling here. This module only changes the page's
// underlying color; it does not alter the image/video layers or tint control.
export const BACKGROUND_AMBIENT_COLOR_ENABLED = true;

export const DEFAULT_AMBIENT_BACKGROUND_COLOR = '#0b120f';
const CACHE_KEY = 'patter-background-ambient-colors-v3';
const SCRIM_CACHE_KEY = 'patter-background-scrim-v1';
const MAX_CACHED_COLORS = 32;

function readColorCache() {
    if (typeof localStorage === 'undefined') return {};
    try {
        const value = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
        return {};
    }
}

export function getCachedAmbientBackgroundColor(key) {
    const color = readColorCache()[key];
    return typeof color === 'string' && /^#[\da-f]{6}$/i.test(color) ? color : null;
}

export function getCachedBackgroundScrim(key) {
    if (typeof localStorage === 'undefined') return null;
    try {
        const values = JSON.parse(localStorage.getItem(SCRIM_CACHE_KEY) || '{}');
        const opacity = Number(values[key]);
        return Number.isFinite(opacity) ? Math.min(0.62, Math.max(0, opacity)) : null;
    } catch {
        return null;
    }
}

function saveCachedBackgroundScrim(key, opacity) {
    if (!key || typeof localStorage === 'undefined') return;
    try {
        const values = JSON.parse(localStorage.getItem(SCRIM_CACHE_KEY) || '{}');
        delete values[key];
        values[key] = opacity;
        while (Object.keys(values).length > MAX_CACHED_COLORS) {
            delete values[Object.keys(values)[0]];
        }
        localStorage.setItem(SCRIM_CACHE_KEY, JSON.stringify(values));
    } catch {
        // Brightness is a visual cache; storage limits must not block writing.
    }
}

export async function sampleBackgroundScrim(source, kind = 'image') {
    if (typeof document === 'undefined' || !source) return null;
    try {
        const media = kind === 'video' ? source : await decodeImage(source);
        const width = kind === 'video' ? media.videoWidth : media.naturalWidth;
        const height = kind === 'video' ? media.videoHeight : media.naturalHeight;
        if (!width || !height) return null;

        const scale = Math.min(1, 48 / width, 48 / height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return null;
        context.drawImage(media, 0, 0, canvas.width, canvas.height);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);

        let luminanceTotal = 0;
        let sampleCount = 0;
        for (let index = 0; index < data.length; index += 4) {
            if (data[index + 3] < 32) continue;
            const channels = [data[index], data[index + 1], data[index + 2]].map((value) => {
                const channel = value / 255;
                return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
            });
            luminanceTotal += channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
            sampleCount++;
        }
        if (!sampleCount) return null;

        const averageLuminance = luminanceTotal / sampleCount;
        const opacity = Math.min(0.62, Math.max(0, (averageLuminance - 0.12) * 0.8));
        return Math.round(opacity * 100) / 100;
    } catch {
        // Tainted or unreadable media keeps the current scrim value.
        return null;
    }
}

export function cacheBackgroundScrim(key, opacity) {
    saveCachedBackgroundScrim(key, opacity);
}

export function setAmbientBackgroundColor(color, key) {
    if (typeof document === 'undefined') return;
    const safeColor = typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)
        ? color
        : DEFAULT_AMBIENT_BACKGROUND_COLOR;
    document.documentElement.style.setProperty('--patter_background_base', safeColor);
    if (!key || !/^#[\da-f]{6}$/i.test(safeColor) || typeof localStorage === 'undefined') return;
    try {
        const colors = readColorCache();
        delete colors[key];
        colors[key] = safeColor;
        while (Object.keys(colors).length > MAX_CACHED_COLORS) {
            delete colors[Object.keys(colors)[0]];
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(colors));
    } catch {
        // The color is only a visual cache; storage limits must not affect writing.
    }
}

export function applyCachedAmbientBackgroundColor(key) {
    const color = BACKGROUND_AMBIENT_COLOR_ENABLED
        ? getCachedAmbientBackgroundColor(key)
        : null;
    setAmbientBackgroundColor(color ?? DEFAULT_AMBIENT_BACKGROUND_COLOR);
}

export async function sampleAmbientBackgroundColor(source, kind = 'image') {
    if (!BACKGROUND_AMBIENT_COLOR_ENABLED || typeof document === 'undefined' || !source) return null;
    try {
        const media = kind === 'video' ? source : await decodeImage(source);
        const width = kind === 'video' ? media.videoWidth : media.naturalWidth;
        const height = kind === 'video' ? media.videoHeight : media.naturalHeight;
        if (!width || !height) return null;

        const scale = Math.min(1, 48 / width, 48 / height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return null;
        context.drawImage(media, 0, 0, canvas.width, canvas.height);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);

        let red = 0;
        let green = 0;
        let blue = 0;
        let weightTotal = 0;
        for (let index = 0; index < data.length; index += 4) {
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            const brightness = (r + g + b) / 3;
            if (data[index + 3] < 32 || brightness < 12 || brightness > 248) continue;
            const saturation = Math.max(r, g, b) - Math.min(r, g, b);
            const weight = 1 + Math.min(saturation, 96) / 96;
            red += r * weight;
            green += g * weight;
            blue += b * weight;
            weightTotal += weight;
        }
        if (!weightTotal) return null;

        const channels = [red, green, blue].map((channel) => channel / weightTotal);
        const maximum = Math.max(...channels);
        // Keep the sampled hue, but cap its brightest channel near the old
        // near-black page background so the tint stays quiet behind the image.
        const darkening = Math.min(1, 14 / Math.max(maximum, 1));
        return `#${channels.map((channel) => Math.round(channel * darkening).toString(16).padStart(2, '0')).join('')}`;
    } catch {
        // Tainted or unreadable media keeps the last safe dark background color.
        return null;
    }
}

function decodeImage(source) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = source;
        if (image.complete && image.naturalWidth) resolve(image);
    });
}
