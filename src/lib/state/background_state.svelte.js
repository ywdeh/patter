import backgroundsFromFolder from 'virtual:patter-backgrounds';
import { getBackgroundPoster } from '$lib/state/background_posters.js';

const STORAGE_KEY = "background-values";
export const backgrounds = backgroundsFromFolder;
export const DEFAULT_BACKGROUND_SRC = '/backgrounds/lantern_in_the_forest.webp';
const defaultBackground = backgrounds.find((item) => item.src === DEFAULT_BACKGROUND_SRC)?.src
    ?? backgrounds[0]?.src
    ?? DEFAULT_BACKGROUND_SRC;

export const defaults = {
    focus: 10,
    tint: 50,
    grain: 2,
    textSize: 18,
    position: 'center',
    background: defaultBackground,
};

const validBackground = (value) => {
    return backgrounds.some((item) => item.src === value) || /^upload:[a-z0-9-]+$/i.test(value)
        ? value
        : defaults.background;
};

export const active_background = $state({ kind: 'image', url: defaults.background });

function builtInBackground(src) {
    return backgrounds.find((item) => item.src === src);
}

function applyToDocument(values) {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("--patter_focus", `${values.focus}px`);
    document.documentElement.style.setProperty("--patter_tint", `${values.tint / 100}`);
    document.documentElement.style.setProperty("--patter_grain", `${values.grain / 100}`);
    document.documentElement.style.setProperty('--patter_body_text_size', `${values.textSize}px`);
    document.documentElement.style.setProperty('--patter_background_position', values.position);
    if (!values.background.startsWith('upload:')) {
        const item = builtInBackground(values.background);
        const preview = item?.kind === 'video'
            ? getBackgroundPoster(values.background) ?? defaults.background
            : values.background;
        document.documentElement.style.setProperty("--patter_background", `url("${preview}")`);
    }
}

function load() {
    if (typeof window === "undefined") return { ...defaults };
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return { ...defaults };
        const values = { ...defaults, ...JSON.parse(saved) };
        const focus = Number(values.focus);
        values.focus = Math.min(15, Math.max(0, Number.isFinite(focus) ? focus : defaults.focus));
        const tint = Number(values.tint);
        values.tint = Math.min(80, Math.max(0, Number.isFinite(tint) ? tint : defaults.tint));
        values.grain = Math.min(4, Math.max(0, Number(values.grain) || 0));
        values.textSize = Math.min(24, Math.max(14, Number(values.textSize) || defaults.textSize));
        values.position = ['top', 'center', 'bottom'].includes(values.position) ? values.position : defaults.position;
        values.background = validBackground(values.background);
        return values;
    } catch {
        return { ...defaults };
    }
}

export const background_values = $state(load());

export function persistBackgroundValues(overrides = {}) {
    const values = { ...background_values, ...overrides };
    const customValues = Object.fromEntries(
        Object.entries(defaults)
            .filter(([key, defaultValue]) => !Object.is(values[key], defaultValue))
            .map(([key]) => [key, values[key]])
    );
    try {
        if (Object.keys(customValues).length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(customValues));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
        // Read back the stored values so the active background is always based
        // on the same data that will be used after a reload.
        return load();
    } catch {
        return null;
    }
}

if (!background_values.background.startsWith('upload:')) {
    const item = builtInBackground(background_values.background);
    active_background.kind = item?.kind ?? 'image';
    active_background.url = background_values.background;
}

export function selectBuiltInBackground(url, kind = builtInBackground(url)?.kind ?? 'image') {
    const requested = validBackground(url);
    const stored = persistBackgroundValues({ background: requested });
    const selected = stored?.background ?? requested;
    const item = builtInBackground(selected);
    background_values.background = selected;
    active_background.kind = item?.kind ?? kind;
    active_background.url = selected;
}

export function selectUploadedBackground(id, kind, url) {
    const requested = `upload:${id}`;
    const stored = persistBackgroundValues({ background: requested });
    const selected = stored?.background ?? requested;
    background_values.background = selected;
    active_background.kind = selected === requested ? kind : (builtInBackground(selected)?.kind ?? 'image');
    active_background.url = selected === requested ? url : selected;
}

export function resetBackgroundValues() {
    background_values.focus = defaults.focus;
    background_values.tint = defaults.tint;
    background_values.grain = defaults.grain;
    background_values.textSize = defaults.textSize;
    background_values.position = defaults.position;
    selectBuiltInBackground(defaults.background);
}

applyToDocument(background_values);

if (typeof window !== 'undefined') {
    $effect.root(() => {
        $effect(() => {
            applyToDocument(background_values);
            const posterKey = background_values.background;
            const poster = getBackgroundPoster(posterKey);
            const preview = poster ?? (active_background.kind === 'image' && !posterKey.startsWith('upload:')
                ? active_background.url
                : defaults.background);
            document.documentElement.style.setProperty('--patter_background', `url("${preview}")`);
        });
    });
}

