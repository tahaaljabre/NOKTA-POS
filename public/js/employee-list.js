// Employee list rendering and deletion.
// Extracted from employees.js.

async function loadEmployeesAdmin() {
  const emps = await api('/api/employees');
  document.querySelector('#employees-admin-table tbody').innerHTML = emps.map(e => {
    const perms = typeof e.permissions === 'string' ? JSON.parse(e.permissions) : e.permissions;
    const permList = Object.entries(perms).filter(([k, v]) => v).map(([k]) => {
      const map = {
        pos: t('perm_pos'), menu: t('perm_menu'), reports: t('perm_reports'),
        settings: t('perm_settings'), audit: t('perm_audit'), employees: t('perm_employees'),
        attendance: t('perm_attendance'), inventory: t('perm_inventory'), tables: t('perm_tables'),
        dashboard: t('perm_dashboard'), customers: t('perm_customers'),
        kitchen: t('perm_kitchen'), discount_orders: t('perm_discount_orders'),
        cancel_orders: t('perm_cancel_orders'), daily_closing: t('perm_daily_closing'),
        manage_expenses: t('perm_manage_expenses'), manage_suppliers: t('perm_manage_suppliers'),
        manage_payments: t('perm_manage_payments'), manage_purchases: t('perm_manage_purchases'),
        edit_orders: t('perm_edit_orders'), delete_orders: t('perm_delete_orders'),
        view_invoices: t('perm_view_invoices'), cashiers: t('perm_cashiers'),
        backup: t('perm_backup'), admin: t('perm_admin')
      };
      return map[k] || k;
    }).join(', ');
    const roleTitle = e.role === 'admin' ? `👑 ${t('emp_role_admin')}` : e.role === 'waiter' ? `🤵 ${t('emp_role_waiter')}` : `💵 ${t('emp_role_cashier')}`;
    const floorBadge = e.role === 'waiter' ? (currentLang === 'ar' ? '📱 نادل متنقل' : '📱 Mobile Waiter') : (currentLang === 'ar' ? `🏢 الدور ${e.default_floor || 1}` : `🏢 Floor ${e.default_floor || 1}`);

    const isCurrentLoggedIn = currentUser && currentUser.id === e.id;

    return `<tr id="emp-row-${e.id}">
      <td>
        <strong>${escapeHtml(currentLang === 'ar' ? e.name : (e.name_en || e.name))}</strong>
        <div style="font-size:11px;color:var(--text-light);">${floorBadge}</div>
      </td>
      <td><span class="user-role-badge role-${e.role || 'cashier'}">${roleTitle}</span></td>
      <td style="font-size:11px;">${permList || '-'}</td>
      <td>
        <span class="${e.active ? 'status-active' : 'status-inactive'}" style="display:inline-block;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;">
          ${e.active ? '✅ ' + t('active') : '⛔ ' + t('inactive')}
        </span>
      </td>
      <td class="action-btns">
        <button class="btn-edit" onclick="openEmployeeModal(${e.id})">${currentLang === 'ar' ? '✏️ تعديل' : '✏️ Edit'}</button>
        ${!isCurrentLoggedIn ? `
          <button class="btn-delete" onclick="deleteEmployee(${e.id}, '', true)" style="background:#dc3545;color:#fff;border-color:#dc3545;" title="حذف نهائي">
            🗑️ ${currentLang === 'ar' ? 'حذف نهائي' : 'Delete'}
          </button>
        ` : ''}
      </td>
    </tr>`;
  }).join('');
}

async function deleteEmployee(empId, empName, permanent = true) {
  const confirmMsg = currentLang === 'ar' 
    ? `هل أنت متأكد من حذف الموظف: "${escapeHtml(empName)}" نهائياً من النظام؟`
    : `Are you sure you want to permanently delete employee: "${escapeHtml(empName)}"?`;
  
  if (!confirm(confirmMsg)) return;

  try {
    await api(`/api/employees/${empId}?permanent=${permanent}`, 'DELETE');
    toast(currentLang === 'ar' ? `✅ تم حذف الموظف "${escapeHtml(empName)}" نهائياً بنجاح` : `Employee "${escapeHtml(empName)}" deleted`, 'success');
    await loadEmployeesAdmin();
  } catch (err) {
    toast(currentLang === 'ar' ? `خطأ: ${escapeHtml(err.message)}` : `Error: ${escapeHtml(err.message)}`, 'error');
  }
}
