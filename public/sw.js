const CACHE_NAME='nokta-static-v97';
const STATIC_ASSETS=['/','/index.html','/views/pos-view.html','/views/tables-view.html','/views/active-orders-view.html','/views/invoices-view.html','/views/dashboard-view.html','/views/admin-view.html','/views/admin/menu-panel.html','/views/admin/inventory-panel.html','/views/admin/modifiers-panel.html','/views/admin/employees-panel.html','/views/admin/tables-panel.html','/views/admin/daily-closing-panel.html','/views/admin/audit-panel.html','/views/admin/settings-panel.html','/views/admin/reports-panel.html','/views/admin/backup-panel.html','/views/admin/help-panel.html','/views/shared-modals.html','/kds.html','/style.css','/styles/base-and-audit.css','/styles/app-shell.css','/styles/pos.css','/styles/orders-and-tables.css','/styles/admin-and-components.css','/styles/responsive.css','/styles/feature-extensions.css','/i18n/ar.js','/i18n/en.js','/i18n.js','/manifest.json','/nokta-pos-icon.png','/vendor/chart.umd.min.js','/socket.io/socket.io.js','/js/safety.js','/js/core/app-state.js','/js/core/offline-order-queue.js','/js/core/offline-data-cache.js','/js/core/api-client.js','/js/core/view-loader.js','/js/core/app-bootstrap.js','/js/core/authentication.js','/js/core/navigation.js','/js/core/ui-feedback.js','/js/core/realtime-sync.js','/js/features/orders/order-production-printing.js','/js/features/orders/order-receipt-printing.js','/js/features/orders/order-active-list.js','/js/features/orders/order-payment.js','/js/features/orders/order-customer-picker.js','/js/features/orders/order-method-selection.js','/js/features/orders/order-screen.js','/js/features/orders/order-modifiers.js','/js/features/orders/order-cart.js','/js/features/orders/order-save.js','/js/features/catalog/catalog-categories.js','/js/features/catalog/catalog-browser.js','/js/features/catalog/catalog-admin-list.js','/js/features/catalog/catalog-modifiers-admin.js','/js/features/catalog/catalog-item-actions.js','/js/features/catalog/catalog-category-editor.js','/js/features/catalog/catalog-item-editor.js','/js/tables.js','/js/admin.js','/js/inventory.js','/js/dashboard.js','/js/employees.js','/js/features/settings/settings-general.js','/js/features/settings/settings-printers.js','/js/features/settings/settings-network.js','/js/features/settings/settings-methods.js','/js/features/settings/settings-backup.js','/js/features/attendance/attendance-admin.js','/js/invoices.js','/js/features/shifts/shift-closing-thermal-printing.js','/js/features/shifts/shift-closing-report-printing.js','/js/features/shifts/shift-closing-dashboard.js','/js/features/shifts/shift-opening.js','/js/features/shifts/shift-employee-closing.js','/js/features/reports/sales-report-view.js','/js/features/reports/sales-report-printing.js','/js/audit.js','/js/reports.js','/js/kds.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(STATIC_ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME&&(k.startsWith('pos-')||k.startsWith('nokta-static-'))).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(!STATIC_ASSETS.includes(url.pathname))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok)caches.open(CACHE_NAME).then(cache=>cache.put(url.pathname,response.clone()));
    return response;
  }).catch(()=>caches.match(url.pathname)));
});
function openQueue() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('pos-offline',2);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('offline-orders'))request.result.createObjectStore('offline-orders',{keyPath:'local_id',autoIncrement:true});};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
let syncing=false;
async function syncOfflineOrders() {
  if(syncing)return;syncing=true;let db;
  try{
    db=await openQueue();
    const orders=await new Promise((resolve,reject)=>{const r=db.transaction('offline-orders').objectStore('offline-orders').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const groups=new Map();
    for(const o of orders){if(o.auth_token){if(!groups.has(o.auth_token))groups.set(o.auth_token,[]);groups.get(o.auth_token).push(o);}}
    for(const [token,rows] of groups){
      const response=await fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({device_id:'background',orders:rows.slice(0,100)})});
      if(!response.ok)continue;
      const result=await response.json(),confirmed=new Set((result.syncedOrders||[]).map(o=>o.offline_id));
      const tx=db.transaction('offline-orders','readwrite'),store=tx.objectStore('offline-orders');
      for(const o of rows)if(confirmed.has(o.offline_id))store.delete(o.local_id);
      await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
      for(const client of await self.clients.matchAll())client.postMessage({type:'SYNC_COMPLETE',result});
    }
  }finally{db?.close();syncing=false;}
}
self.addEventListener('sync',event=>{if(event.tag==='sync-orders')event.waitUntil(syncOfflineOrders());});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();if(event.data?.type==='FORCE_SYNC')event.waitUntil(syncOfflineOrders());});
