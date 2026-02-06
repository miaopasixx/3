const DB_NAME = 'ocr_cache_db';
const STORE_NAME = 'ocr_results';
const DB_VERSION = 1;

export interface CachedOCR {
    id: string; // content hash
    results: any[];
    updatedAt: number;
}

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event: any) => resolve(event.target.result);
        request.onerror = (event: any) => reject(event.target.error);
    });
};

export const getOcrCache = async (id: string): Promise<any[] | null> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => {
                if (request.result) {
                    resolve(request.result.results);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn('OCR Cache Error (get):', e);
        return null;
    }
};

export const setOcrCache = async (id: string, results: any[]): Promise<void> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const item: CachedOCR = {
                id,
                results,
                updatedAt: Date.now()
            };

            const request = store.put(item);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn('OCR Cache Error (set):', e);
    }
};

/**
 * Cleanup old cache entries (older than 7 days)
 */
export const cleanupOcrCache = async (): Promise<void> => {
    try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        request.onsuccess = (event: any) => {
            const cursor = event.target.result;
            if (cursor) {
                if (now - cursor.value.updatedAt > SEVEN_DAYS) {
                    cursor.delete();
                }
                cursor.continue();
            }
        };
    } catch (e) {
        console.warn('OCR Cache Cleanup Error:', e);
    }
};
