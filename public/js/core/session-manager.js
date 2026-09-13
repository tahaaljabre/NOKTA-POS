// Session management, app initialization, and permission visibility.
// Extracted from authentication.js.

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
  applyDiscountPermissions();
  if (typeof OfflineSync !== 'undefined' && currentUser && currentUser.token) {
    OfflineSync.init(currentUser.token).catch(e => console.warn('OfflineSync init failed:', e));
  }
  if (typeof switchMobilePosTab === 'function') {
    switchMobilePosTab('menu');
  }
}

function checkPermissions() {
  if (!currentUser) return;
  const p = typeof currentUser.permissions === 'string' ? JSON.parse(currentUser.permissions) : (currentUser.permissions || {});
  const isAdmin = currentUser.role === 'admin';
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const view = btn.dataset.view;
    let show = true;
    if (view === 'admin' && !isAdmin && !p.admin) show = false;
    if (view === 'invoices' && !isAdmin && !p.view_invoices && !p.reports) show = false;
    if (view === 'dashboard' && !isAdmin && !p.dashboard && !p.reports) show = false;
    btn.style.display = show ? '' : 'none';
  });
  const discountRows = document.querySelectorAll('.discount-row');
  discountRows.forEach(row => {
    const maxDisc = currentUser && currentUser.max_discount !== null && currentUser.max_discount !== undefined ? Number(currentUser.max_discount) : 100;
    row.style.display = ((isAdmin || p.discount_orders) && maxDisc > 0) ? 'flex' : 'none';
  });
  document.querySelectorAll('.admin-tab').forEach(tab => {
    const adminView = tab.dataset.admin;
    let show = true;
    if (adminView === 'menu-admin' && !isAdmin && !p.menu) show = false;
    if (adminView === 'modifiers-admin' && !isAdmin && !p.menu) show = false;
    if (adminView === 'inventory-admin' && !isAdmin && !p.inventory) show = false;
    if (adminView === 'employees-admin' && !isAdmin && !p.employees) show = false;
    if (adminView === 'cashiers-admin' && !isAdmin && !p.cashiers) show = false;
    if (adminView === 'suppliers-admin' && !isAdmin && !p.manage_suppliers && !p.manage_payments) show = false;
    if (adminView === 'tables-admin' && !isAdmin && !p.tables) show = false;
    if (adminView === 'daily-closing-admin' && !isAdmin && !p.daily_closing) show = false;
    if (adminView === 'expenses-admin' && !isAdmin && !p.manage_expenses) show = false;
    if (adminView === 'attendance-admin' && !isAdmin && !p.attendance) show = false;
    if (adminView === 'audit-admin' && !isAdmin && !p.audit) show = false;
    if (adminView === 'settings-admin' && !isAdmin && !p.settings) show = false;
    if (adminView === 'backup-admin' && !isAdmin && !p.backup) show = false;
    if (adminView === 'reports-admin' && !isAdmin && !p.reports) show = false;
    tab.style.display = show ? '' : 'none';
  });
}

document.getElementById('btn-logout').onclick = () => {
  currentUser = null;
  sessionStorage.removeItem('pos_kitchen_token');
  socket.auth = {};
  socket.disconnect();
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  pinBuffer = '';
  updatePinDisplay();
  document.getElementById('login-error').textContent = '';
};
