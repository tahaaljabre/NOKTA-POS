// Loads fixed application view templates before any screen initializes.
const PRIMARY_VIEW_TEMPLATES = [
  'views/pos-view.html',
  'views/tables-view.html',
  'views/active-orders-view.html',
  'views/invoices-view.html',
  'views/dashboard-view.html',
  'views/admin-view.html'
];

const ADMIN_PANEL_TEMPLATES = [
  ['menu-admin', 'views/admin/menu-panel.html'],
  ['inventory-admin', 'views/admin/inventory-panel.html'],
  ['modifiers-admin', 'views/admin/modifiers-panel.html'],
  ['employees-admin', 'views/admin/employees-panel.html'],
  ['attendance-admin', 'views/admin/attendance-panel.html'],
  ['tables-admin', 'views/admin/tables-panel.html'],
  ['daily-closing-admin', 'views/admin/daily-closing-panel.html'],
  ['audit-admin', 'views/admin/audit-panel.html'],
  ['settings-admin', 'views/admin/settings-panel.html'],
  ['reports-admin', 'views/admin/reports-panel.html'],
  ['backup-admin', 'views/admin/backup-panel.html'],
  ['help-admin', 'views/admin/help-panel.html']
];

async function loadAdminPanels() {
  const responses = await Promise.all(ADMIN_PANEL_TEMPLATES.map(([, path]) => fetch(path, { cache: 'no-store' })));
  const failed = responses.find(response => !response.ok);
  if (failed) throw new Error(`Unable to load admin panel (${failed.status})`);
  const templates = await Promise.all(responses.map(response => response.text()));
  ADMIN_PANEL_TEMPLATES.forEach(([panelId], index) => {
    const container = document.getElementById(`admin-fragment-${panelId}`);
    if (!container) throw new Error(`Admin panel container is missing: ${panelId}`);
    container.outerHTML = templates[index];
  });
}

async function loadPrimaryViews() {
  const container = document.getElementById('primary-view-fragments');
  if (!container) throw new Error('Primary view container is missing');
  const paths = [...PRIMARY_VIEW_TEMPLATES, 'views/shared-modals.html'];
  const responses = await Promise.all(paths.map(path => fetch(path, { cache: 'no-store' })));
  const failed = responses.find(response => !response.ok);
  if (failed) throw new Error(`Unable to load application view (${failed.status})`);
  const templates = await Promise.all(responses.map(response => response.text()));
  container.innerHTML = templates.slice(0, PRIMARY_VIEW_TEMPLATES.length).join('\n');
  const modalContainer = document.getElementById('shared-modal-fragments');
  if (!modalContainer) throw new Error('Shared modal container is missing');
  modalContainer.innerHTML = templates.at(-1);
  await loadAdminPanels();
}
