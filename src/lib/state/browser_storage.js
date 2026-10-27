// A short-lived connection per operation keeps upgrades and reset operations unblocked.
export function create_browser_store(database, store, options) {
    function open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(database, 1);
            let blocked = false;
            request.onupgradeneeded = () => request.result.createObjectStore(store, options);
            request.onsuccess = () => {
                const db = request.result;
                if (blocked) { db.close(); return; }
                db.onversionchange = () => db.close();
                resolve(db);
            };
            request.onerror = () => reject(request.error);
            request.onblocked = () => { blocked = true; reject(new Error('Browser storage is busy.')); };
        });
    }

    return async function transact(action, mode = 'readwrite') {
        const db = await open();
        try {
            return await new Promise((resolve, reject) => {
                const transaction = db.transaction(store, mode);
                let result;
                transaction.oncomplete = () => resolve(result);
                transaction.onerror = () => reject(transaction.error);
                transaction.onabort = () => reject(transaction.error ?? new Error('Browser storage is unavailable.'));
                try { action(transaction.objectStore(store), (value) => { result = value; }); }
                catch (error) { transaction.abort(); reject(error); }
            });
        } finally { db.close(); }
    };
}
