export function yield_to_browser() {
    if (globalThis.scheduler?.yield) return globalThis.scheduler.yield();
    return new Promise((resolve) => setTimeout(resolve, 0));
}
