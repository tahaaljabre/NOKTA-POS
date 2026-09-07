// ===== Admin =====
function activateAdminTab(tab) {
  if (!tab) return;
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`admin-${tab.dataset.admin}`);
  if (!panel) return;
  panel.classList.add('active');
  const loaders = {
    'menu-admin': 'loadMenuAdmin',
    'modifiers-admin': 'loadModifiersAdmin',
    'inventory-admin': 'loadInventory',
    'employees-admin': 'loadEmployeesAdmin',
    'tables-admin': 'loadTablesAdmin',
    'daily-closing-admin': 'loadDailyClosing',
    'audit-admin': 'loadAuditAdmin',
    'settings-admin': 'loadSettings',
    'reports-admin': 'loadAdminReport'
  };
  const loader = loaders[tab.dataset.admin];
  if (loader && typeof window[loader] === 'function') window[loader]();
}

function setupAdmin() {
  const bind = (id, action) => { const el = document.getElementById(id); if (el) el.onclick = action; };
  bind('btn-add-category', openCategoryModal);
  bind('btn-add-item', openItemModal);
  bind('btn-add-modifier', openModifierAdminModal);
  bind('btn-add-employee', openEmployeeModal);
  bind('btn-add-table-admin', openTableAdminModal);
  bind('btn-save-settings', saveSettings);
  const loadRepBtn = document.getElementById('btn-load-report');
  if (loadRepBtn) loadRepBtn.onclick = loadAdminReport;
  const loadAuditBtn = document.getElementById('btn-load-audit');
  if (loadAuditBtn) loadAuditBtn.onclick = loadAuditAdmin;

  // Hide admin tabs based on permissions
  applyAdminPermissions();
}

// Delegation remains available even if another page component fails during initialization.
document.addEventListener('click', event => {
  const tab = event.target.closest('.admin-tab');
  if (tab) activateAdminTab(tab);
});

function applyAdminPermissions() {
  if (!currentUser) return;
  const p = currentUser.permissions;
  const isAdmin = currentUser.role === 'admin';
  
  document.querySelectorAll('.admin-tab').forEach(tab => {
    const admin = tab.dataset.admin;
    let show = true;
    if (admin === 'menu-admin' && !isAdmin && !p.menu) show = false;
    if (admin === 'modifiers-admin' && !isAdmin && !p.menu) show = false;
    if (admin === 'employees-admin' && !isAdmin && !p.employees) show = false;
    if (admin === 'tables-admin' && !isAdmin && !p.menu) show = false;
    if (admin === 'daily-closing-admin' && !isAdmin && !p.daily_closing) show = false;
    if (admin === 'audit-admin' && !isAdmin && !p.audit) show = false;
    if (admin === 'settings-admin' && !isAdmin && !p.settings) show = false;
    if (admin === 'reports-admin' && !isAdmin && !p.reports) show = false;
    
    tab.style.display = show ? '' : 'none';
  });

  // Hide nav buttons based on permissions
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const view = btn.dataset.view;
    let show = true;
    if (view === 'admin' && !isAdmin && !p.settings && !p.menu && !p.audit && !p.employees) show = false;
    if (view === 'invoices' && !isAdmin && !p.view_invoices && !p.reports) show = false;
    if (view === 'sales' && !isAdmin && !p.reports) show = false;
    btn.style.display = show ? '' : 'none';
  });
}
