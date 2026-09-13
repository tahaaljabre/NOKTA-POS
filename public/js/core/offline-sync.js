/**
 * OfflineSync — manages syncing between server and local offline database.
 * Works with Capacitor SQLite on Android, IndexedDB in browser.
 */
const OfflineSync = (() => {
  let isOnline = navigator.onLine;
  let syncInProgress = false;
  let lastSyncTime = 0;
  let syncInterval = null;
  let auth_token = null;

  const SYNC_INTERVAL = 30000;

  async function init(token) {
    auth_token = token;
    await OfflineStorage.init();
    const settings = await OfflineStorage.getSettings();
    lastSyncTime = parseInt(settings._lastSyncTime || '0');

    window.addEventListener('online', () => { isOnline = true; onOnline(); });
    window.addEventListener('offline', () => { isOnline = false; onOffline(); });

    const isNative = await OfflineStorage.isNative();
    if (isNative) {
      updateStatusUI('mobile', isOnline);
    } else {
      updateStatusUI('browser', isOnline);
    }

    if (isOnline) {
      await fullSync();
    }
    startAutoSync();
    console.log('[OfflineSync] initialized, isNative:', isNative);
  }

  function startAutoSync() {
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(async () => {
      if (isOnline && !syncInProgress) {
        await syncChanges();
        await uploadOfflineOrders();
      }
    }, SYNC_INTERVAL);
  }

  async function fullSync() {
    if (syncInProgress || !isOnline || !auth_token) return;
    syncInProgress = true;
    try {
      const response = await fetch('/api/sync/full', {
        headers: { 'Authorization': 'Bearer ' + auth_token }
      });
      if (!response.ok) throw new Error('Sync failed');
      const data = await response.json();
      if (data.ok) {
        await OfflineStorage.syncFromServer(data);
        lastSyncTime = Date.now();
        await OfflineStorage.setSetting('_lastSyncTime', String(lastSyncTime));
        console.log('[OfflineSync] full sync completed');
        updateStatusUI(null, true, 'synced');
      }
    } catch (e) {
      console.error('[OfflineSync] full sync failed:', e);
      updateStatusUI(null, true, 'sync_error');
    } finally {
      syncInProgress = false;
    }
  }

  async function syncChanges() {
    if (syncInProgress || !isOnline || !auth_token || !lastSyncTime) return;
    syncInProgress = true;
    try {
      const response = await fetch('/api/sync/changes?since=' + lastSyncTime, {
        headers: { 'Authorization': 'Bearer ' + auth_token }
      });
      if (!response.ok) throw new Error('Changes sync failed');
      const data = await response.json();
      if (data.ok) {
        await OfflineStorage.syncFromServer(data);
        lastSyncTime = Date.now();
        await OfflineStorage.setSetting('_lastSyncTime', String(lastSyncTime));
        console.log('[OfflineSync] changes sync completed');
      }
    } catch (e) {
      console.error('[OfflineSync] changes sync failed:', e);
    } finally {
      syncInProgress = false;
    }
  }

  async function uploadOfflineOrders() {
    if (!isOnline || !auth_token) return;
    try {
      const orders = await OfflineStorage.getUnsyncedOrders();
      if (!orders.length) return;

      const response = await fetch('/api/sync/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + auth_token
        },
        body: JSON.stringify({
          orders: orders.map(o => ({
            offline_id: o.offline_id,
            employee_id: o.employee_id,
            table_id: o.table_id,
            order_type: o.order_type,
            items: JSON.parse(o.items || '[]'),
            subtotal: o.subtotal,
            tax: o.tax,
            discount: o.discount,
            total: o.total,
            status: o.status,
            payment_method: o.payment_method
          })),
          device_id: 'android_' + (localStorage.getItem('device_id') || 'unknown')
        })
      });

      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json();

      for (const synced of result.syncedOrders || []) {
        await OfflineStorage.markOrderSynced(synced.offline_id, synced.id);
      }
      console.log('[OfflineSync] uploaded', result.synced, 'orders');
      updateStatusUI(null, true, 'synced');
    } catch (e) {
      console.error('[OfflineSync] upload failed:', e);
    }
  }

  async function saveOrderOffline(order) {
    const offlineId = await OfflineStorage.saveOfflineOrder(order);
    if (isOnline) {
      await uploadOfflineOrders();
    }
    return offlineId;
  }

  async function forceSync() {
    await fullSync();
    await uploadOfflineOrders();
  }

  function onOnline() {
    console.log('[OfflineSync] back online');
    updateStatusUI(null, true, 'online');
    forceSync();
  }

  function onOffline() {
    console.log('[OfflineSync] went offline');
    updateStatusUI(null, false, 'offline');
  }

  function updateStatusUI(platform, online, state) {
    const el = document.getElementById('offline-status');
    if (!el) return;
    if (online) {
      el.className = 'online';
      el.textContent = state === 'synced' ? 'متصل — تم المزامنة' :
        state === 'sync_error' ? 'متصل — خطأ في المزامنة' : 'متصل';
    } else {
      el.className = 'offline';
      el.textContent = 'أوفلاين — يعمل محلياً';
    }
  }

  function getStatus() {
    return { isOnline, syncInProgress, lastSyncTime };
  }

  async function destroy() {
    if (syncInterval) clearInterval(syncInterval);
  }

  return {
    init, fullSync, syncChanges, uploadOfflineOrders,
    saveOrderOffline, forceSync, getStatus, destroy
  };
})();

if (typeof module !== 'undefined') module.exports = OfflineSync;
