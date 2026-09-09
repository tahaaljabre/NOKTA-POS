// IndexedDB queue for orders waiting to synchronize.
// ===== Offline IndexedDB =====
const OFFLINE_DB = 'pos-offline';
const OFFLINE_STORE = 'offline-orders';

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB, 2);
    request.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
        db.createObjectStore(OFFLINE_STORE, { keyPath: 'local_id', autoIncrement: true });
      }
    };
    request.onsuccess = e => resolve(e.target.result);
    request.onerror = e => reject(e.target.error);
  });
}

async function saveOfflineOrder(order) {
  const db = await openOfflineDB();
  const tx = db.transaction(OFFLINE_STORE, 'readwrite');
  const store=tx.objectStore(OFFLINE_STORE);
  const existing=store.getAll();existing.onsuccess=()=>{if(!existing.result.some(o=>o.offline_id===order.offline_id)) store.add(order);};
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getOfflineOrders() {
  const db = await openOfflineDB();
  const tx = db.transaction(OFFLINE_STORE, 'readonly');
  const req = tx.objectStore(OFFLINE_STORE).getAll();
    return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function clearOfflineOrders(confirmedIds = []) {
  const db = await openOfflineDB();
  const tx = db.transaction(OFFLINE_STORE, 'readwrite');
  const store = tx.objectStore(OFFLINE_STORE);
  for (const id of confirmedIds) store.delete(id);
  return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
}
