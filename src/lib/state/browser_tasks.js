export function yield_to_browser() {
    if (globalThis.scheduler?.yield) return globalThis.scheduler.yield();
    return new Promise((resolve) => setTimeout(resolve, 0));
}

export function schedule_idle_task(task) {
    if ('requestIdleCallback' in window) window.requestIdleCallback(task, { timeout: 2000 });
    else window.setTimeout(task, 200);
}
