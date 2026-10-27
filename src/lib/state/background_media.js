import { create_browser_store } from './browser_storage.js';

const transact = create_browser_store('patter-backgrounds', 'uploads', { keyPath: 'id' });

export function replaceBackgroundUpload(record) {
    return transact((store) => {
        store.clear();
        store.put(record);
    });
}

export function clearBackgroundUploads() {
    return transact((store) => { store.clear(); });
}

export function getBackgroundUpload(id) {
    return transact((store, done) => {
        const request = store.get(id);
        request.onsuccess = () => done(request.result);
    }, 'readonly');
}

export function listBackgroundUploads() {
    return transact((store, done) => {
        const request = store.getAll();
        request.onsuccess = () => done(request.result);
    }, 'readonly');
}
