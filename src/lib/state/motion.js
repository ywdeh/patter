export function motionDuration(name, fallback) {
    if (typeof document === 'undefined') return fallback;

    const value = getComputedStyle(document.documentElement)
        .getPropertyValue(`--patter_motion_${name}`)
        .trim();
    const milliseconds = Number.parseFloat(value);
    return Number.isFinite(milliseconds) ? milliseconds : fallback;
}
