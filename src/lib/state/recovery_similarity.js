// Bounded insertion/deletion distance: quick for small edits, stops at the limit.
// Comparing raw Markdown also preserves meaningful formatting changes.
export function recovery_text_is_similar(left, right) {
    const limit = Math.min(40, Math.max(5, Math.round(Math.min(left.length, right.length) * 0.02)));
    if (Math.abs(left.length - right.length) > limit) return false;
    let start = 0;
    while (start < left.length && start < right.length && left[start] === right[start]) start++;
    let end_left = left.length;
    let end_right = right.length;
    while (end_left > start && end_right > start && left[end_left - 1] === right[end_right - 1]) { end_left--; end_right--; }
    const a = left.slice(start, end_left);
    const b = right.slice(start, end_right);
    if (a.length + b.length <= limit) return true;
    let furthest = new Map([[1, 0]]);
    for (let edits = 0; edits <= limit; edits++) {
        const next = new Map();
        for (let diagonal = -edits; diagonal <= edits; diagonal += 2) {
            let x;
            if (diagonal === -edits || (diagonal !== edits && (furthest.get(diagonal - 1) ?? -Infinity) < (furthest.get(diagonal + 1) ?? -Infinity))) {
                x = furthest.get(diagonal + 1) ?? 0;
            } else x = (furthest.get(diagonal - 1) ?? 0) + 1;
            let y = x - diagonal;
            while (x < a.length && y < b.length && a[x] === b[y]) { x++; y++; }
            if (x >= a.length && y >= b.length) return true;
            next.set(diagonal, x);
        }
        furthest = next;
    }
    return false;
}
