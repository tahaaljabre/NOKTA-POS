// Main navigation and view activation.
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
          else if (activeTab.dataset.admin === 'attendance-admin') loadAttendanceAdmin();
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
