let has_interacted = false;

export function can_use_wheel_controls(event) {
    if (typeof navigator === 'undefined') return false;
    if (event?.currentTarget?.closest('[data-wheel-controls="disabled"]')) return false;
    return navigator.userActivation?.hasBeenActive ?? has_interacted;
}

export function mount_user_interaction() {
    if (typeof window === 'undefined' || navigator.userActivation) return () => {};
    const events = ['click', 'pointerdown', 'pointerup', 'keydown'];
    function cleanup() {
        for (const name of events) window.removeEventListener(name, activate, true);
    }
    function activate(event) {
        if (!event.isTrusted) return;
        if (event.type === 'pointerdown' && event.pointerType !== 'mouse') return;
        if (event.type === 'keydown' && (event.ctrlKey || event.metaKey || event.altKey || ['Escape', 'Shift', 'Control', 'Alt', 'Meta'].includes(event.key))) return;
        has_interacted = true;
        cleanup();
    }
    for (const name of events) window.addEventListener(name, activate, true);
    return cleanup;
}
