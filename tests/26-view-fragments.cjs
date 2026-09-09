const fs = require('node:fs');
const { start } = require('./support.cjs');

(async () => {
  const { api, assert, close } = await start();
  try {
    const loader = fs.readFileSync('public/js/core/view-loader.js', 'utf8');
    const expected = [
      ['pos-view.html', 'view-pos'],
      ['tables-view.html', 'view-tables'],
      ['active-orders-view.html', 'view-active-orders'],
      ['invoices-view.html', 'view-invoices'],
      ['dashboard-view.html', 'view-dashboard'],
      ['admin-view.html', 'view-admin'],
      ['shared-modals.html', 'modal-overlay']
    ];
    for (const [file, id] of expected) {
      const response = await api(`/views/${file}`, 'GET', undefined, null);
      assert.equal(response.status, 200);
      assert.match(response.data, new RegExp(`id=["']${id}["']`));
    }
    const adminPanels = [
      ['menu-panel.html', 'admin-menu-admin'],
      ['inventory-panel.html', 'admin-inventory-admin'],
      ['modifiers-panel.html', 'admin-modifiers-admin'],
      ['employees-panel.html', 'admin-employees-admin'],
      ['attendance-panel.html', 'admin-attendance-admin'],
      ['tables-panel.html', 'admin-tables-admin'],
      ['daily-closing-panel.html', 'admin-daily-closing-admin'],
      ['audit-panel.html', 'admin-audit-admin'],
      ['settings-panel.html', 'admin-settings-admin'],
      ['reports-panel.html', 'admin-reports-admin'],
      ['backup-panel.html', 'admin-backup-admin'],
      ['help-panel.html', 'admin-help-admin']
    ];
    for (const [file, id] of adminPanels) {
      const response = await api(`/views/admin/${file}`, 'GET', undefined, null);
      assert.equal(response.status, 200);
      assert.match(response.data, new RegExp(`id=["']${id}["']`));
      assert(loader.includes(`views/admin/${file}`));
    }
    const index = fs.readFileSync('public/index.html', 'utf8');
    const shellStyles = fs.readFileSync('public/styles/app-shell.css', 'utf8');
    assert(index.includes('id="primary-view-fragments"'));
    assert(index.includes('id="shared-modal-fragments"'));
    assert.match(shellStyles, /#primary-view-fragments\s*\{[^}]*display:\s*flex;[^}]*flex:\s*1;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s);
    assert.match(shellStyles, /#primary-view-fragments\s*>\s*\.view\s*\{[^}]*height:\s*100%;/s);
    for (const [file] of expected) assert(loader.includes(`views/${file}`));
    console.log('PASS 26: primary views and admin panels are served and registered before application startup');
  } finally {
    await close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
