import { editor_fonts } from './editor_fonts.js';
import backgroundsFromFolder from 'virtual:patter-backgrounds';
import { getBackgroundPoster } from '$lib/state/background_posters.js';
import { listBackgroundUploads } from './background_media.js';
import { prepare_background, prepare_uploaded_background, wait_for_background_preparation } from './background_preparation.js';

const STORAGE_KEY = "background-values";
export const backgrounds = backgroundsFromFolder;
export const DEFAULT_BACKGROUND_SRC = '/backgrounds/book.webp';
const defaultBackground = backgrounds.find((item) => item.src === DEFAULT_BACKGROUND_SRC)?.src
    ?? backgrounds[0]?.src
    ?? DEFAULT_BACKGROUND_SRC;

export const defaults = {
    focus: 10,
    tint: 50,
    tintShade: 0,
    grain: 2,
    textSize: 18,
    editorFont: 0,
    markdown: true,
    cornerControls: true,
    position: 'center',
    background: defaultBackground,
};

const validBackground = (value) => {
    return typeof value === 'string' && (backgrounds.some((item) => item.src === value) || /^upload:[a-z0-9-]+$/i.test(value))
        ? value
        : defaults.background;
};

export const active_background = $state({ kind: 'image', url: defaults.background });
let uploaded_background = $state(null);

export function get_background_upload() { return uploaded_background; }
let upload_version = 0;
const retired_uploads = new Set();

function builtInBackground(src) {
    return backgrounds.find((item) => item.src === src);
}

function set_style(property, value) {
    const style = document.documentElement.style;
    if (style.getPropertyValue(property) !== value) style.setProperty(property, value);
}

function applyToDocument(values) {
    if (typeof document === "undefined") return;
    document.documentElement.toggleAttribute('data-corner-controls', values.cornerControls);
    set_style("--patter_focus", `${values.focus}px`);
    set_style("--patter_tint", `${values.tint / 100}`);
    set_style('--patter_tint_color', values.tintShade === 2 ? 'oklch(15.3% 0.025 135)' : values.tintShade === 1 ? 'oklch(14.7% 0.004 49.3)' : 'oklch(12.9% 0.042 264.695)');
    set_style("--patter_grain", `${values.grain / 100}`);
    set_style('--patter_editor_font', editor_fonts[values.editorFont]);
    set_style('--patter_body_text_size', `${values.textSize}px`);
    set_style('--patter_background_position', values.position);
}

function sync_background() {
    if (typeof document === 'undefined') return;
    const key = background_values.background;
    const preview = active_background.kind === 'image' && !key.startsWith('upload:')
        ? active_background.url
        : uploaded_background?.poster ?? getBackgroundPoster(key) ?? defaults.background;
    set_style('--patter_background', `url("${preview}")`);
}

function load() {
    if (typeof window === "undefined") return { ...defaults };
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return { ...defaults };
        const parsed = JSON.parse(saved);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...defaults };
        const values = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, parsed[key] ?? fallback]));
        for (const [key, min, max] of [['editorFont', 0, 3], ['tintShade', 0, 2], ['focus', 0, 15], ['tint', 0, 80], ['grain', 0, 4], ['textSize', 14, 24]]) {
            const value = values[key];
            values[key] = typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
                ? value : defaults[key];
        }
        values.markdown = typeof values.markdown === 'boolean' ? values.markdown : defaults.markdown;
        values.cornerControls = typeof values.cornerControls === 'boolean' ? values.cornerControls : defaults.cornerControls;
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

export function set_background_upload(record) {
    upload_version++;
    const previous = uploaded_background;
    uploaded_background = record ? { ...record, url: record.url ?? URL.createObjectURL(record.blob) } : null;
    if (previous?.url && previous.url !== uploaded_background?.url) retired_uploads.add(previous.url);
    return uploaded_background;
}

export function release_unused_background_uploads(urls) {
    const used = new Set([uploaded_background?.url, ...urls]);
    for (const url of retired_uploads) {
        if (!used.has(url)) { URL.revokeObjectURL(url); retired_uploads.delete(url); }
    }
}

async function restore_background_upload() {
    const version = upload_version;
    const selection = background_values.background;
    const selected_id = selection.startsWith('upload:') ? selection.slice(7) : null;
    const records = await listBackgroundUploads();
    if (version !== upload_version) return;
    const record = selected_id ? records.find((item) => item.id === selected_id) : records[0];
    if (!record) {
        if (selected_id && background_values.background === selection) selectBuiltInBackground(defaults.background);
        return;
    }
    const upload = set_background_upload({ ...record, poster: getBackgroundPoster('upload:' + record.id) });
    if (selected_id && background_values.background === selection) selectUploadedBackground(upload.id, upload.kind, upload.url);
    await prepare_uploaded_background(upload, upload.url);
    if (uploaded_background?.id === upload.id) {
        set_background_upload({ ...upload, poster: getBackgroundPoster('upload:' + upload.id) });
    }
}

export const background_startup = typeof window === 'undefined' ? Promise.resolve() : wait_for_background_preparation([
    ...backgrounds.filter((item) => item.kind === 'image').map((item) =>
        prepare_background(item.src, item.src, 'image', item.src === background_values.background ? 'high' : 'auto')),
    restore_background_upload()
]);

export function resetBackgroundValues() {
    background_values.focus = defaults.focus;
    background_values.tint = defaults.tint;
    background_values.tintShade = defaults.tintShade;
    background_values.grain = defaults.grain;
    background_values.textSize = defaults.textSize;
    background_values.editorFont = defaults.editorFont;
    background_values.markdown = defaults.markdown;
    background_values.cornerControls = defaults.cornerControls;
    background_values.position = defaults.position;
    selectBuiltInBackground(defaults.background);
}

applyToDocument(background_values);
sync_background();

if (typeof window !== 'undefined') {
    $effect.root(() => {
        $effect(() => applyToDocument(background_values));
        $effect(sync_background);
    });
}
