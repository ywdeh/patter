// Safety saving is independent of pauses and recent-history slots.
export function create_editor_autosave(save) {
    const interval = 30000;
    let timer;
    let pending = null;
    function cancel() {
        clearTimeout(timer);
        timer = null;
        pending = null;
    }
    function flush() {
        clearTimeout(timer);
        timer = null;
        if (pending === null) return;
        const text = pending;
        if (save(text) !== false) {
            if (pending === text) pending = null;
        }
        // A failed write stays pending and retries without requiring more typing.
        if (pending !== null) timer = setTimeout(flush, interval);
    }
    function schedule(text) {
        pending = text;
        if (!timer) timer = setTimeout(flush, interval);
    }
    return { schedule, flush, cancel };
}
