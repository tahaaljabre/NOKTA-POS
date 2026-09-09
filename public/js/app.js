
// ===== Force SW update =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.update());
  });
}

// ===== State =====
let categories = [];
let items = [];
let tables = [];
let currentOrder = { items: [], table_id: null, type: 'dine_in', discount: 0, note: '' };
let activeCategoryId = null;
let currentUser = null;
let pinBuffer = '';
// Prevent a delayed setup-status response from replacing an active login
// attempt. A wrong PIN must always remain a wrong-PIN message.
let loginInteractionStarted = false;
let isOnline = navigator.onLine;
let appCurrency = localStorage.getItem('pos_currency') || '฿';
let appRestaurantName = localStorage.getItem('pos_restaurant_name') || 'اسم المنشأة';
let appRestaurantNameEn = localStorage.getItem('pos_restaurant_name_en') || 'Your Business';
let appTaxRate = parseFloat(localStorage.getItem('pos_tax_rate')) || 0;

function getCurrency() {
  return appCurrency || '฿';
}

function getRestaurantName() {
  if (currentLang === 'ar') {
    return appRestaurantName || 'اسم المنشأة';
  }
  return appRestaurantNameEn || appRestaurantName || 'Your Business';
}

function updateHeaderRestaurantName() {
  const name = getRestaurantName();
  const titleEl = document.getElementById('restaurant-name');
  if (titleEl) titleEl.textContent = `🍽️ ${escapeHtml(name)}`;
  const loginTitleEl = document.getElementById('login-title');
  if (loginTitleEl) loginTitleEl.textContent = `🍽️ ${escapeHtml(name)}`;
  document.title = `NOKTA POS - ${escapeHtml(name)}`;
}

function updateHeaderUser() {
  const name = currentUser?.name || '';
  const main = document.getElementById('current-user');
  const menu = document.getElementById('header-tools-user');
  if (main) main.textContent = name;
  if (menu) menu.textContent = name ? `👤 ${escapeHtml(name)}` : '';
}

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

// ===== API =====
const API_BASE = (window.location.protocol === 'file:') ? 'http://localhost:3000' : '';

async function api(url, method = 'GET', body = null) {
  const fullUrl = url.startsWith('http') ? url : (API_BASE + url);
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Accept-Language':currentLang } };
  if (currentUser?.token) opts.headers.Authorization = `Bearer ${currentUser.token}`;
  if (body) opts.body = JSON.stringify(body);
  let res;
  const controller=new AbortController();opts.signal=controller.signal;
  const timeout=setTimeout(()=>controller.abort(),8000);
  try{res=await fetch(fullUrl,opts);}catch(cause){const e=new Error(currentLang === "ar" ? "تعذر الوصول للخادم" : "Server is unreachable");e.network=true;throw e;}finally{clearTimeout(timeout);}
  isOnline=true;
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let errMsg = `Error ${escapeHtml(res.status)}`;
    if (contentType.includes('application/json')) {
      const errJson = await res.json();
      errMsg = errJson.error || errJson.message || errMsg;
    } else {
      const text = await res.text();
      errMsg = text.replace(/<[^>]*>?/gm, '').trim().slice(0, 100) || errMsg;
    }
    const failure=new Error(errMsg);failure.status=res.status;throw failure;
  }
  if (contentType.includes('application/json')) {
    const data=await res.json();
    if(method==='GET' && /^\/api\/orders\?/.test(url) && !/[?&](offset|limit)=/.test(url) && Array.isArray(data) && data.length===200){let result=data;for(let offset=200;offset<50000;offset+=200){const page=await api(url+'&limit=200&offset='+offset);result=result.concat(page);if(page.length<200)break;}return result;}
    return data;
  }
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { return text; }
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  updateHeaderRestaurantName();
  applyTranslations();
  setupLogin();
  checkInitialSetup();
  setupNavigation();
  setupModals();
  setupTime();
  document.getElementById('lang-toggle-login').onclick = () => toggleLanguage();
  const topLangBtn = document.getElementById('lang-toggle-top');
  if (topLangBtn) topLangBtn.onclick = () => toggleLanguage();
  const kitchenLink = document.getElementById('nav-kds');
  if (kitchenLink) kitchenLink.onclick = event => {
    if (!currentUser?.token) return;
    event.preventDefault();
    // The URL fragment stays in the browser and is never sent in the HTTP request.
    // It lets a separate Android WebView/new tab receive the already authenticated session.
    window.open(`kds.html#session=${encodeURIComponent(currentUser.token)}`, '_blank', 'noopener');
  };
  setupHeaderToolsMenu();
  
  window.addEventListener('online', () => {isOnline=true;syncPendingOrders();});
  setInterval(syncPendingOrders,15000);
  window.addEventListener('offline', () => {
    isOnline = false;
    document.getElementById('offline-bar').classList.remove('hidden');
    document.getElementById('sync-status').className = 'sync-status offline';
    toast(currentLang === 'ar' ? '⚡ تم التحويل لوضع العمل بدون إنترنت (أوفلاين)' : '⚡ Switched to offline mode', 'info');
  });
});

function getDeviceId() {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('device_id', id);
  }
  return id;
}

// ===== Login =====
function setupLogin() {
  document.querySelectorAll('.pin-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const num = btn.dataset.num;
      loginInteractionStarted = true;
      if (num === 'clear') {
        pinBuffer = '';
      } else if (num === 'ok') {
        attemptLogin();
        return;
      } else {
        if (pinBuffer.length < 6) pinBuffer += num;
      }
      updatePinDisplay();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (document.getElementById('login-screen').classList.contains('hidden')) return;
    if (e.key === 'Enter') {
      loginInteractionStarted = true;
      attemptLogin();
    } else if (e.key === 'Backspace') {
      pinBuffer = pinBuffer.slice(0, -1);
      updatePinDisplay();
    } else if (/^[0-9]$/.test(e.key)) {
      loginInteractionStarted = true;
      if (pinBuffer.length < 6) pinBuffer += e.key;
      updatePinDisplay();
    }
  });
  document.getElementById('show-admin-login').onclick = () => {
    const form = document.getElementById('admin-login-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  };
  const passwordToggle = document.getElementById('toggle-admin-password');
  const passwordInput = document.getElementById('admin-password');
  if (passwordToggle && passwordInput) {
    passwordToggle.onclick = () => {
      const visible = passwordInput.type === 'text';
      passwordInput.type = visible ? 'password' : 'text';
      passwordToggle.textContent = visible ? '👁' : '🙈';
      passwordToggle.setAttribute('data-i18n-title', visible ? 'show_password' : 'hide_password');
      passwordToggle.title = t(visible ? 'show_password' : 'hide_password');
      passwordToggle.setAttribute('aria-label', t(visible ? 'show_password' : 'hide_password'));
    };
  }
  document.getElementById('admin-login-form').onsubmit = async e => {
    e.preventDefault();
    await attemptPasswordLogin(document.getElementById('admin-username').value, document.getElementById('admin-password').value);
  };
  document.getElementById('initial-admin-form').onsubmit = async e => {
    e.preventDefault();
    const password = document.getElementById('setup-password').value;
    const confirm = document.getElementById('setup-password-confirm').value;
    const error = document.getElementById('login-error');
    if (password !== confirm) { error.textContent = t('passwords_mismatch'); return; }
    try {
      await api('/api/auth/setup-admin', 'POST', { name: document.getElementById('setup-name').value, username: document.getElementById('setup-username').value, password, current_pin: document.getElementById('setup-current-pin').value });
      error.textContent = t('admin_created');
      document.getElementById('initial-admin-form').style.display = 'none';
      document.getElementById('admin-login-form').style.display = 'block';
    } catch (err) { error.textContent = err.message; }
  };
}

function setupHeaderToolsMenu() {
  const toggle = document.getElementById('header-tools-toggle');
  const tools = document.getElementById('header-tools');
  const shiftButton = document.getElementById('btn-shift-close');
  if (shiftButton) shiftButton.onclick = () => {
    if (typeof openEmployeeClosingModal === 'function') openEmployeeClosingModal();
  };
  if (!toggle || !tools) return;
  toggle.onclick = event => {
    event.stopPropagation();
    if (!document.getElementById('header-tools-user')?.textContent.trim() && currentUser?.name) updateHeaderUser();
    const open = tools.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  };
  document.addEventListener('click', event => {
    if (!tools.contains(event.target) && !toggle.contains(event.target)) {
      tools.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

async function checkInitialSetup() {
  try {
    const status = await fetch((API_BASE || '') + '/api/auth/setup-status').then(r => r.json());
    // The initial-setup page is only for a truly new installation. Never let
    // it interrupt a PIN entry or a failed login on an existing system.
    if (loginInteractionStarted || pinBuffer.length > 0) return;
    if (!status.setup_required && !status.migration_required) return;
    document.getElementById('login-screen').dataset.setupMode = status.migration_required ? 'migration' : 'initial';
    document.getElementById('login-subtitle').textContent = status.migration_required ? t('migrate_admin_login') : t('setup_first_admin');
    document.querySelector('.pin-display').style.display = 'none';
    document.querySelector('.pin-pad').style.display = 'none';
    document.getElementById('show-admin-login').style.display = 'none';
    if (status.migration_required) document.getElementById('setup-current-pin').style.display = 'block';
    document.getElementById('initial-admin-form').style.display = 'block';
  } catch (e) { console.error('Setup status check failed:', e); }
}

function updatePinDisplay() {
  const display = document.getElementById('pin-display');
  if (!display) return;
  let text = '';
  for (let i = 0; i < 4; i++) {
    text += i < pinBuffer.length ? '● ' : '_ ';
  }
  display.textContent = text.trim();
}

async function attemptLogin() {
  if (pinBuffer.length === 0) return;
  loginInteractionStarted = true;
  const loginError = document.getElementById('login-error');
  loginError.textContent = '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch((API_BASE || '') + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language':currentLang },
      body: JSON.stringify({ pin: pinBuffer }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (res.ok && data.id) {
      currentUser = data;
      // The kitchen display opens in a separate tab and needs this session to
      // retrieve active orders from the protected API.
      localStorage.setItem('pos_kitchen_token', data.token || '');
      socket.auth = { token: data.token };
      socket.connect();
      await cacheData('employees', [data]);
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      
      // Auto-identify Employee Role, Floor, and Station
      const roleIcon = data.role === 'admin' ? '👑' : (data.role === 'waiter' ? '🤵' : '💵');
      const roleText = data.role === 'admin' ? t('emp_role_admin') : (data.role === 'waiter' ? t('emp_role_waiter') : t('emp_role_cashier'));
      const floorText = data.role === 'waiter' ? (currentLang === 'ar' ? 'نادل متنقل' : 'Mobile Waiter') : (currentLang === 'ar' ? `الدور ${data.default_floor || 1}` : `Floor ${data.default_floor || 1}`);

      const userBadgeEl = document.getElementById('current-user');
      if (userBadgeEl) {
        userBadgeEl.innerHTML = `${roleIcon} <strong>${escapeHtml(data.name)}</strong> <span class="header-floor-pill">(${roleText} - ${floorText})</span>`;
      }
      const menuUserEl = document.getElementById('header-tools-user');
      if (menuUserEl) {
        menuUserEl.innerHTML = `${roleIcon} <strong>${escapeHtml(data.name)}</strong><br><small>${roleText} — ${floorText}</small>`;
      }

      // Auto-set station selector in POS view to match employee's floor/station
      const autoStation = data.default_station || (data.role === 'waiter' ? 'waiter_mobile' : `cashier_floor${data.default_floor || 1}`);
      localStorage.setItem('pos_current_station', autoStation);
      const stationSel = document.getElementById('pos-station-select');
      if (stationSel) stationSel.value = autoStation;

      toast(currentLang === 'ar' ? `مرحباً ${escapeHtml(data.name)} (${roleText} - ${floorText})` : `Welcome ${escapeHtml(data.name)} (${roleText} - ${floorText})`, 'success');

      loginError.textContent = '';
      pinBuffer = '';
      updatePinDisplay();
      initApp();
      if (typeof checkShiftOnLogin === 'function') {
        setTimeout(checkShiftOnLogin, 600);
      }
      return;
    } else {
      loginError.textContent = t('login_error');
      pinBuffer = '';
      updatePinDisplay();
      return;
    }
  } catch (e) {
    loginError.textContent = currentLang === 'ar' ? 'تعذر الدخول؛ تحقق من اتصال الخادم' : 'Cannot sign in; check the server connection';
    pinBuffer = ''; updatePinDisplay();
  }
}

async function attemptPasswordLogin(username, password) {
  const loginError = document.getElementById('login-error');
  try {
    const res = await fetch((API_BASE || '') + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language':currentLang }, body: JSON.stringify({ username, password }) });
    const data = await res.json();
    if (!res.ok || !data.id) throw new Error(data.error || t('login_error'));
    currentUser = data;
    localStorage.setItem('pos_kitchen_token', data.token || '');
    socket.auth = { token: data.token }; socket.connect();
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    updateHeaderUser();
    initApp();
  } catch (err) { loginError.textContent = err.message; }
}

function initApp() {
  syncPendingOrders();
  loadCategories();
  loadItems();
  loadTables();
  loadSettings();
  setupPOS();
  setupAdmin();
  applyTranslations();
  checkPermissions();
  if (typeof switchMobilePosTab === 'function') {
    switchMobilePosTab('menu');
  }
}

function checkPermissions() {
  if (!currentUser) return;
  const p = typeof currentUser.permissions === 'string' ? JSON.parse(currentUser.permissions) : (currentUser.permissions || {});
  const isAdmin = currentUser.role === 'admin';
  
  // Top Nav Buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const view = btn.dataset.view;
    let show = true;
    if (view === 'admin' && !isAdmin && !p.settings && !p.menu && !p.audit && !p.employees && !p.inventory && !p.tables) show = false;
    if (view === 'invoices' && !isAdmin && !p.view_invoices && !p.reports) show = false;
    if (view === 'dashboard' && !isAdmin && !p.dashboard && !p.reports) show = false;
    btn.style.display = show ? '' : 'none';
  });
  const discountRows = document.querySelectorAll('.discount-row');
  discountRows.forEach(row => {
    row.style.display = (isAdmin || p.discount_orders) ? 'flex' : 'none';
  });

  // Admin Sidebar Tabs
  document.querySelectorAll('.admin-tab').forEach(tab => {
    const adminView = tab.dataset.admin;
    let show = true;
    if (adminView === 'menu-admin' && !isAdmin && !p.menu) show = false;
    if (adminView === 'modifiers-admin' && !isAdmin && !p.menu) show = false;
    if (adminView === 'inventory-admin' && !isAdmin && !p.inventory) show = false;
    if (adminView === 'employees-admin' && !isAdmin && !p.employees) show = false;
    if (adminView === 'tables-admin' && !isAdmin && !p.tables) show = false;
    if (adminView === 'daily-closing-admin' && !isAdmin && !p.daily_closing) show = false;
    if (adminView === 'audit-admin' && !isAdmin && !p.audit) show = false;
    if (adminView === 'settings-admin' && !isAdmin && !p.settings) show = false;
    if (adminView === 'reports-admin' && !isAdmin && !p.reports) show = false;
    tab.style.display = show ? '' : 'none';
  });
}

document.getElementById('btn-logout').onclick = () => {
  currentUser = null;
  localStorage.removeItem('pos_kitchen_token');
  socket.auth = {};
  socket.disconnect();
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  pinBuffer = '';
  updatePinDisplay();
  document.getElementById('login-error').textContent = '';
};

// ===== Navigation =====
function setupNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(`view-${btn.dataset.view}`).classList.add('active');
      if (btn.dataset.view === 'active-orders') loadActiveOrders();
      if (btn.dataset.view === 'tables') renderTablesView();
      if (btn.dataset.view === 'invoices') loadInvoices();
      if (btn.dataset.view === 'sales') loadSalesReport();
      if (btn.dataset.view === 'admin') {
        const activeTab = document.querySelector('.admin-tab.active');
        if (activeTab) {
          if (activeTab.dataset.admin === 'audit-admin') loadAuditAdmin();
          else if (activeTab.dataset.admin === 'menu-admin') loadMenuAdmin();
          else if (activeTab.dataset.admin === 'employees-admin') loadEmployeesAdmin();
          else if (activeTab.dataset.admin === 'daily-closing-admin') loadDailyClosing();
          else if (activeTab.dataset.admin === 'settings-admin') loadSettings();
        }
      }
    });
  });
}

function setupTime() {
  const update = () => {
    document.getElementById('current-time').textContent = new Date().toLocaleTimeString(currentLang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  };
  update();
  setInterval(update, 10000);
}

// ===== Modal =====
function setupModals() {
  document.getElementById('modal-close').onclick = closeModal;
  document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
}

function openModal(title, bodyHtml, onConfirm = null, confirmText = null) {
  document.getElementById('modal-title').textContent = title;
  const btnLabel = confirmText || t('save');
  
  if (typeof onConfirm === 'function') {
    document.getElementById('modal-body').innerHTML = bodyHtml + `<div class="modal-actions"><button class="btn-confirm" id="modal-confirm-btn">${btnLabel}</button><button class="btn-cancel" id="modal-cancel-btn">${currentLang === 'ar' ? 'إلغاء' : 'Cancel'}</button></div>`;
    const confirmBtn = document.getElementById('modal-confirm-btn');
    confirmBtn.onclick = async () => {
      try {
        confirmBtn.disabled = true;
        confirmBtn.textContent = currentLang === 'ar' ? 'جاري المعالجة...' : 'Processing...';
        const result = await onConfirm();
        // A form can explicitly keep the dialog open (for validation failures).
        if (result !== false) closeModal();
      } catch (e) {
        console.error('Modal confirm error:', e);
        toast(t('error') + ': ' + e.message, 'error');
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = btnLabel;
      }
    };
    document.getElementById('modal-cancel-btn').onclick = closeModal;
  } else {
    document.getElementById('modal-body').innerHTML = bodyHtml;
  }

  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }

// ===== Toast =====
function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ===== Socket Real-Time Concurrency Broadcasts =====
const socket = io({ autoConnect: false });
socket.on('connect', () => {
  console.log('Real-time POS connection established');
  document.getElementById('sync-status').className = 'sync-status online';
});
socket.on('disconnect', () => {
  console.log('Real-time POS connection disconnected');
});

// Real-time table occupation and release across cashiers & waiters
socket.on('table:updated', (data) => {
  console.log('Table state updated remotely:', data);
  if (typeof loadTables === 'function') loadTables();
});

// Real-time new order broadcast across floors
socket.on('order:created', (data) => {
  console.log('New order created remotely:', data);
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

