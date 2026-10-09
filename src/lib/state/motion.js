export function motionDuration(name, fallback) {
    if (typeof document === 'undefined') return fallback;

    const value = getComputedStyle(document.documentElement)
        .getPropertyValue(`--patter_motion_${name}`)
        .trim();
    const match = value.match(/^(-?(?:\d+\.?\d*|\.\d+))\s*(ms|s)?$/i);
    if (!match) return fallback;

    const amount = Number(match[1]);
    const milliseconds = match[2]?.toLowerCase() === 's' ? amount * 1000 : amount;
    return Number.isFinite(milliseconds) ? milliseconds : fallback;
}
