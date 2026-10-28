import { after_wallpaper_spread } from './background_spread.js';
import { loadBackgroundImage } from './background_preloader.js';

export const BACKGROUND_AMBIENT_COLOR_ENABLED = true;

export const DEFAULT_AMBIENT_BACKGROUND_COLOR = '#0b120f';
const CACHE_KEY = 'patter-background-ambient-colors-v3';
const SCRIM_CACHE_KEY = 'patter-background-scrim-v1';
const MAX_CACHED_COLORS = 32;
const hex_color = /^#[\da-f]{6}$/i;
const palette_transition = /^(?:color|background-color|outline-color|border-(?:top|right|bottom|left)-color|box-shadow|text-shadow|fill|stroke)$/;

function read_cache(storage_key) {
    if (typeof localStorage === 'undefined') return {};
    try {
        const value = JSON.parse(localStorage.getItem(storage_key) || '{}');
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { return {}; }
}

function cache_value(storage_key, key, value) {
    if (!key || typeof localStorage === 'undefined') return;
    try {
        const values = read_cache(storage_key);
        delete values[key];
        values[key] = value;
        while (Object.keys(values).length > MAX_CACHED_COLORS) delete values[Object.keys(values)[0]];
        localStorage.setItem(storage_key, JSON.stringify(values));
    } catch {}
}

export function getCachedAmbientBackgroundColor(key) {
    const color = read_cache(CACHE_KEY)[key];
    return typeof color === 'string' && hex_color.test(color) ? color : null;
}

export function cacheAmbientBackgroundColor(key, color) {
    if (typeof color === 'string' && hex_color.test(color)) cache_value(CACHE_KEY, key, color);
}

export function getCachedBackgroundScrim(key) {
    const opacity = Number(read_cache(SCRIM_CACHE_KEY)[key]);
    return Number.isFinite(opacity) ? Math.min(0.62, Math.max(0, opacity)) : null;
}

export function cacheBackgroundScrim(key, opacity) {
    cache_value(SCRIM_CACHE_KEY, key, opacity);
}

export function setAmbientBackgroundColor(color, key) {
    if (typeof document === 'undefined') return;
    const safeColor = typeof color === 'string' && hex_color.test(color)
        ? color
        : DEFAULT_AMBIENT_BACKGROUND_COLOR;
    after_wallpaper_spread(() => applyAmbientBackgroundColor(safeColor, key));
}

function applyAmbientBackgroundColor(safeColor, key) {
    const root = document.documentElement;
    if (root.style.getPropertyValue('--patter_background_base') !== safeColor) {
        const existing_animations = new Set(document.getAnimations());
        root.style.setProperty('--patter_background_base', safeColor);
        for (const animation of document.getAnimations()) {
            if (existing_animations.has(animation) || !('transitionProperty' in animation)) continue;
            if (!palette_transition.test(animation.transitionProperty)) continue;
            if (animation.effect?.target?.matches?.('.patter_ambient_background')) continue;
            animation.finish();
        }
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', safeColor);
    cacheAmbientBackgroundColor(key, safeColor);
}

const linear_channels = Float64Array.from({ length: 256 }, (_, value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
});

export async function sample_background_palette(source, kind = 'image') {
    const empty = { color: null, scrim: null };
    if (typeof document === 'undefined' || !source) return empty;
    try {
        const data = await readBackgroundPixels(source, kind);
        if (!data) return empty;
        let red = 0, green = 0, blue = 0, weight_total = 0;
        let luminance = 0, count = 0;
        for (let index = 0; index < data.length; index += 4) {
            if (data[index + 3] < 32) continue;
            const r = data[index], g = data[index + 1], b = data[index + 2];
            luminance += linear_channels[r] * 0.2126 + linear_channels[g] * 0.7152 + linear_channels[b] * 0.0722;
            count++;
            const brightness = (r + g + b) / 3;
            if (brightness < 12 || brightness > 248) continue;
            const weight = 1 + Math.min(Math.max(r, g, b) - Math.min(r, g, b), 96) / 96;
            red += r * weight;
            green += g * weight;
            blue += b * weight;
            weight_total += weight;
        }
        let color = null;
        if (weight_total) {
            const channels = [red, green, blue].map((channel) => channel / weight_total);
            const darkening = Math.min(1, 14 / Math.max(Math.max(...channels), 1));
            color = '#' + channels.map((channel) => Math.round(channel * darkening).toString(16).padStart(2, '0')).join('');
        }
        const scrim = count ? Math.round(Math.min(0.62, Math.max(0, (luminance / count - 0.12) * 0.8)) * 100) / 100 : null;
        return { color, scrim };
    } catch { return empty; }
}

let pixel_worker;
let pixel_request = 0;
const pending_pixels = new Map();

async function readPixelsInWorker(media, width, height) {
    if (!pixel_worker) {
        pixel_worker = new Worker(new URL('./background_pixel_worker.js', import.meta.url), { type: 'module' });
        pixel_worker.onmessage = ({ data }) => {
            const request = pending_pixels.get(data.id);
            pending_pixels.delete(data.id);
            if (data.error) request?.reject(new Error('Pixel sampling failed'));
            else request?.resolve(data.pixels);
        };
        pixel_worker.onerror = () => {
            for (const request of pending_pixels.values()) request.reject(new Error('Pixel worker failed'));
            pending_pixels.clear();
            pixel_worker.terminate();
            pixel_worker = null;
        };
    }
    const bitmap = await createImageBitmap(media);
    const worker = pixel_worker;
    if (!worker) { bitmap.close(); throw new Error('Pixel worker unavailable'); }
    const id = ++pixel_request;
    return new Promise((resolve, reject) => {
        pending_pixels.set(id, { resolve, reject });
        try { worker.postMessage({ id, bitmap, width, height }, [bitmap]); }
        catch (error) { bitmap.close(); pending_pixels.delete(id); reject(error); }
    });
}

const image_pixels = new Map();
const video_pixels = new WeakMap();

function readBackgroundPixels(source, kind) {
    const cache = kind === 'video' ? video_pixels : image_pixels;
    const existing = cache.get(source);
    if (existing) return existing;
    const sample = (async () => {
        const media = kind === 'video' ? source : await loadBackgroundImage(source);
        const width = kind === 'video' ? media.videoWidth : media.naturalWidth;
        const height = kind === 'video' ? media.videoHeight : media.naturalHeight;
        if (!width || !height) return null;
        const scale = Math.min(1, 48 / width, 48 / height);
        const sample_width = Math.max(1, Math.round(width * scale));
        const sample_height = Math.max(1, Math.round(height * scale));
        if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap === 'function') {
            try { return await readPixelsInWorker(media, sample_width, sample_height); }
            catch {  }
        }
        const canvas = document.createElement('canvas');
        canvas.width = sample_width;
        canvas.height = sample_height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return null;
        context.drawImage(media, 0, 0, canvas.width, canvas.height);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        canvas.width = canvas.height = 0;
        return data;
    })();
    cache.set(source, sample);
    if (kind !== 'video' && image_pixels.size > MAX_CACHED_COLORS) {
        image_pixels.delete(image_pixels.keys().next().value);
    }
    void sample.then((data) => { if (!data) cache.delete(source); }, () => cache.delete(source));
    return sample;
}
