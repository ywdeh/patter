import { motionDuration } from './motion.js';

// Only these predefined fields can leave the app. Never pass editor or file content.
const fields = {
    writing_started: [],
    editor_time_milestone: ['minutes'],
    document_exported: ['format'], document_imported: ['format'],
    background_changed: ['background'], background_uploaded: ['type'],
    background_removed: [], background_position_changed: ['position'],
    audio_started: ['track'], setting_changed: ['setting', 'value'],
    options_tab_changed: ['tab'], settings_reset: ['scope']
};
const pending_settings = new Map();
let last_writing_activity = 0;
let saved_writing_activity = 0;
const writing_storage_key = 'patter-analytics-writing';
const writing_session_idle = 30 * 60 * 1000;

export function track_event(name, parameters = {}) {
    if (typeof window === 'undefined' || !window.patter_analytics_enabled || !fields[name]) return;
    try {
        const safe = Object.fromEntries(fields[name].filter((key) => parameters[key] !== undefined)
            .map((key) => [key, parameters[key]]));
        window.gtag?.('event', name, safe);
    } catch { /* Analytics must not interrupt an action. */ }
}

export function track_writing() {
    if (typeof window === 'undefined' || !window.patter_analytics_enabled) return;
    const now = Date.now();
    try {
        if (!last_writing_activity) last_writing_activity = Number(sessionStorage.getItem(writing_storage_key)) || 0;
    } catch { /* Session deduplication still works in memory. */ }
    if (now - last_writing_activity >= writing_session_idle) track_event('writing_started');
    last_writing_activity = now;
    if (now - saved_writing_activity >= 60000) {
        saved_writing_activity = now;
        try { sessionStorage.setItem(writing_storage_key, String(now)); } catch {}
    }
}

export function track_setting(setting, value) {
    const previous = pending_settings.get(setting);
    if (previous) clearTimeout(previous);
    pending_settings.set(setting, setTimeout(() => {
        pending_settings.delete(setting);
        track_event('setting_changed', { setting, value });
    }, motionDuration('slow', 400)));
}

// Visible editor time during this page visit, retained across internal navigation.
const editor_milestones = [1, 5, 15, 30, 60];
let editor_elapsed = 0;
let next_editor_milestone = 0;

export function mount_editor_time_tracking() {
    if (typeof window === 'undefined' || !window.patter_analytics_enabled) return () => {};
    let visible_since = document.visibilityState === 'visible' ? performance.now() : null;
    let timer;

    function update() {
        clearTimeout(timer);
        const now = performance.now();
        if (visible_since !== null) editor_elapsed += now - visible_since;
        visible_since = document.visibilityState === 'visible' ? now : null;
        while (next_editor_milestone < editor_milestones.length
            && editor_elapsed >= editor_milestones[next_editor_milestone] * 60000) {
            track_event('editor_time_milestone', { minutes: editor_milestones[next_editor_milestone++] });
        }
        if (visible_since !== null && next_editor_milestone < editor_milestones.length) {
            timer = setTimeout(update, editor_milestones[next_editor_milestone] * 60000 - editor_elapsed);
        }
    }

    document.addEventListener('visibilitychange', update);
    update();
    return () => {
        update();
        clearTimeout(timer);
        visible_since = null;
        document.removeEventListener('visibilitychange', update);
    };
}
