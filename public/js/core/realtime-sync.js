// Socket.IO updates and offline-order synchronization.
// ===== Socket Real-Time Concurrency Broadcasts =====
const socket = io({ autoConnect: false });
socket.on('connect', () => {
  document.getElementById('sync-status').className = 'sync-status online';
});
socket.on('disconnect', () => {
});

// Real-time table occupation and release across cashiers & waiters
socket.on('table:updated', (data) => {
  if (typeof loadTables === 'function') loadTables();
});

// Real-time new order broadcast across floors
socket.on('order:created', (data) => {
  if (typeof loadActiveOrders === 'function') loadActiveOrders();
  if (typeof loadTables === 'function') loadTables();
});

socket.on('order:updated', (data) => {
  if (typeof loadActiveOrders === 'function') loadActiveOrders();
  if (typeof loadTables === 'function') loadTables();
});

let syncInProgress=false;
async function syncPendingOrders() {
  if(syncInProgress || !currentUser?.token) return;
  syncInProgress=true;
  try {
    const queued=await getOfflineOrders();
    const mine=queued.filter(o=>Number(o.employee_id)===currentUser.id).slice(0,100);
    if(!mine.length) return;
    const result=await api('/api/sync','POST',{device_id:getDeviceId(),orders:mine});
    const confirmed=new Set((result.syncedOrders||[]).map(o=>o.offline_id));
    await clearOfflineOrders(mine.filter(o=>confirmed.has(o.offline_id)).map(o=>o.local_id));
    for(const saved of result.syncedOrders||[]) {
      const original=mine.find(o=>o.offline_id===saved.offline_id);
      if(original?.print_pending) { try{await generateReceipt(saved);}catch(e){console.warn('Reprint from invoices',e);} }
    }
    const pending=queued.length-confirmed.size;
    document.getElementById('sync-status').className='sync-status '+(pending?'offline':'synced');
    document.getElementById('sync-status').textContent=pending?String(pending):'✓';
    toast((currentLang==='ar'?'تمت المزامنة: ':'Synced: ')+confirmed.size+'/'+mine.length+(pending?(currentLang==='ar'?' — توجد طلبات معلقة':' — orders remain pending'):''),pending?'info':'success');
    if(result.failedOrders?.length) toast(result.failedOrders[0].error,'error');
    if(confirmed.size){loadTables();loadActiveOrders();}
  }catch(e){document.getElementById('sync-status').className='sync-status offline';}
  finally{syncInProgress=false;}
}
