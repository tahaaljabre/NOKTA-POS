// IndexedDB cache for non-sensitive reference data.
// ===== Offline Cache =====
const CACHE_DB = 'pos-cache';
const CACHE_STORES = { employees: 'employees', categories: 'categories', items: 'items', tables: 'tables', settings: 'settings' };

async function openCacheDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB, 2);
    request.onupgradeneeded = e => {
      const db = e.target.result;
      Object.values(CACHE_STORES).forEach(store => {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
      });
    };
    request.onsuccess = e => resolve(e.target.result);
    request.onerror = e => reject(e.target.error);
  });
}

async function cacheData(storeName, data) {
  try {
    const db = await openCacheDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    data.forEach(item => store.put(storeName === "settings" ? {...item,id:"settings"} : item));
    await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
  } catch (e) { console.error('Cache error:', e); }
}

async function getCachedData(storeName) {
  try {
    const db = await openCacheDB();
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) { return []; }
}
