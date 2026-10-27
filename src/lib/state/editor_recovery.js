import { create_browser_store } from './browser_storage.js';
import { recovery_text_is_similar } from './recovery_similarity.js';

const snapshot_limit = 6;
const snapshot_interval = 3 * 60 * 1000;
const first_snapshot_words = 10;
const snapshot_pause = 3000;
const transact = create_browser_store('patter-recovery', 'snapshots', { keyPath: 'id', autoIncrement: true });
let queue = Promise.resolve();
let timer;
let document_version = 0;
let source = '';
let visible = '';
let saved_visible = '';
let checked_source = null;
let first_snapshot = true;
let stopped = true;
let last_edit_at = 0;
const word_count = (text) => text.match(/\S+/gu)?.length ?? 0;

function enqueue(action) {
    const result = queue.then(action);
    queue = result.catch(() => {});
    return result;
}

function save_recovery_snapshot(text, version) {
    return enqueue(() => transact((store, done) => {
        const request = store.getAll();
        request.onsuccess = () => {
            if (version !== document_version) { done(null); return; }
            const records = request.result.sort((a, b) => a.created - b.created || a.id - b.id);
            const duplicate = records.some((record) => record.text === text || recovery_text_is_similar(record.text, text));
            if (duplicate) { done({ saved: false, has_snapshots: records.length > 0 }); return; }
            for (const record of records.slice(0, Math.max(0, records.length + 1 - snapshot_limit))) store.delete(record.id);
            store.add({ text, created: Date.now() });
            done({ saved: true, has_snapshots: true });
        };
    }));
}

function schedule_check(delay) {
    clearTimeout(timer);
    timer = setTimeout(check_snapshot, delay);
}

async function check_snapshot() {
    timer = null;
    if (stopped || document.visibilityState !== 'visible') return;
    const pause_remaining = snapshot_pause - (Date.now() - last_edit_at);
    if (pause_remaining > 0) {
        schedule_check(pause_remaining);
        return;
    }
    const version = document_version;
    const text = source;
    const visible_at_check = visible;
    try {
        // No slots for untouched writing, deletion-only edits, or an already checked version.
        const added_content = visible_at_check.length > saved_visible.length;
        if (text !== checked_source && text.trim() && added_content
            && (!first_snapshot || word_count(visible_at_check) >= first_snapshot_words)) {
            const result = await save_recovery_snapshot(text, version);
            if (version !== document_version) return;
            if (result) {
                checked_source = text;
                if (result.saved) saved_visible = visible_at_check;
                if (result.has_snapshots) first_snapshot = false;
            }
        }
    } catch { /* Retry on the next check; draft safety saving remains independent. */ }
    if (version === document_version && !stopped) {
        if (!first_snapshot) schedule_check(snapshot_interval);
        else if (text !== source) schedule_check(snapshot_pause);
    }
}

export function reset_recovery_buffer(text, visible_text = text) {
    clearTimeout(timer);
    document_version++;
    source = String(text ?? '');
    visible = saved_visible = String(visible_text ?? '');
    checked_source = source;
    first_snapshot = true;
    stopped = false;
}

export function schedule_recovery_snapshot(text, visible_text = text) {
    last_edit_at = Date.now();
    source = String(text ?? '');
    visible = String(visible_text ?? '');
    stopped = false;
    if (first_snapshot) {
        clearTimeout(timer);
        timer = null;
        if (word_count(visible) >= first_snapshot_words) schedule_check(snapshot_pause);
    } else if (!timer) schedule_check(snapshot_interval);
}

// Hiding or leaving the editor never forces a history slot.
export function cancel_pending_recovery() {
    clearTimeout(timer);
    timer = null;
    stopped = true;
}

export function resume_recovery_snapshots() {
    if (!stopped) return;
    stopped = false;
    if (!first_snapshot) schedule_check(snapshot_interval);
    else if (source !== checked_source && word_count(visible) >= first_snapshot_words) schedule_check(snapshot_pause);
}

export function list_recovery_snapshots() {
    return enqueue(() => transact((store, done) => {
        const request = store.getAll();
        request.onsuccess = () => done(request.result.sort((a, b) => b.created - a.created || b.id - a.id).slice(0, snapshot_limit));
    }, 'readonly'));
}

export function clear_recovery_snapshots() {
    reset_recovery_buffer('');
    return enqueue(() => transact((store) => { store.clear(); }));
}

// Removing one history slot never changes the active draft or its safety save.
export function dismiss_recovery_snapshot(id) {
    return enqueue(() => transact((store) => { store.delete(id); }));
}
