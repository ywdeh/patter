export function read_storage_record(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) ?? 'null');
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
        return {};
    }
}
