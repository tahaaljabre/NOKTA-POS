const CACHE_NAME='nokta-static-v76';
const STATIC_ASSETS=['/','/index.html','/kds.html','/style.css','/i18n.js','/manifest.json','/nokta-pos-icon.png','/vendor/chart.umd.min.js','/socket.io/socket.io.js','/js/safety.js','/js/app.js','/js/orders.js','/js/menu.js','/js/tables.js','/js/admin.js','/js/inventory.js','/js/dashboard.js','/js/employees.js','/js/settings.js','/js/invoices.js','/js/daily-closing.js','/js/sales.js','/js/audit.js','/js/reports.js','/js/kds.js'];
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

