function read_motion_value(variable, fallback) {
    if (typeof document === 'undefined') return fallback;

    const value = getComputedStyle(document.documentElement)
        .getPropertyValue(variable)
        .trim();
    const match = value.match(/^(-?(?:\d+\.?\d*|\.\d+))\s*(ms|s)?$/i);
    if (!match) return fallback;

    const amount = Number(match[1]);
    const milliseconds = match[2]?.toLowerCase() === 's' ? amount * 1000 : amount;
    return Number.isFinite(milliseconds) ? milliseconds : fallback;
}

export function motionDuration(name, fallback) {
    return read_motion_value(`--patter_motion_${name}`, fallback);
}

export function motionDelay(name, fallback) {
    return read_motion_value(`--patter_delay_${name}`, fallback);
}
