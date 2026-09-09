async function loadEmployeesAdmin() {
  const emps = await api('/api/employees');
  document.querySelector('#employees-admin-table tbody').innerHTML = emps.map(e => {
    const perms = typeof e.permissions === 'string' ? JSON.parse(e.permissions) : e.permissions;
    const permList = Object.entries(perms).filter(([k, v]) => v).map(([k]) => {
      const map = { pos: t('perm_pos'), menu: t('perm_menu'), reports: t('perm_reports'), settings: t('perm_settings'), audit: t('perm_audit'), employees: t('perm_employees'), inventory: 'المخزون', tables: 'الطاولات', dashboard: 'لوحة القيادة', customers: 'العملاء' };
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

async function openEmployeeModal(empId = null) {
  let emp = null;
  if (empId) { const all = await api('/api/employees'); emp = all.find(e => e.id === empId); }
  const perms = emp ? (typeof emp.permissions === 'string' ? JSON.parse(emp.permissions) : emp.permissions) : { pos: true };
  openModal(emp ? (currentLang === 'ar' ? 'تعديل موظف' : 'Edit Employee') : t('add_employee'), `
    <label>${t('emp_name_ar')}</label><input type="text" id="modal-emp-name" value="${escapeHtml(emp ? emp.name : '')}">
    <label>${t('emp_name_en')}</label><input type="text" id="modal-emp-name-en" value="${escapeHtml(emp ? emp.name_en : '')}">
    <label>${t('emp_username')}</label><input type="text" id="modal-emp-username" value="${escapeHtml(emp && emp.username ? emp.username : '')}" autocomplete="username" placeholder="${t('emp_username_hint')}">
    <label>${t('emp_password')}${emp ? ' (' + t('emp_password_keep') + ')' : ''}</label><input type="password" id="modal-emp-password" autocomplete="new-password" placeholder="${t('emp_password_hint')}">
    <label>${t('emp_pin')}${emp ? ' (' + (currentLang === 'ar' ? 'اترك فارغ للاحتفاظ بالقديم' : 'leave empty to keep') + ')' : ''}</label><input type="password" id="modal-emp-pin" maxlength="6" placeholder="${t('emp_pin_hint')}">
    <label>${currentLang === 'ar' ? 'أقصى نسبة خصم (%)' : 'Max Discount (%)'}</label>
    <input type="number" id="modal-emp-max-discount" min="0" max="100" value="${emp && emp.max_discount !== undefined ? emp.max_discount : 100}">
    <label>${t('emp_role')}</label>
    <select id="modal-emp-role" onchange="toggleEmployeeFloorFields(this.value)">
      <option value="admin" ${emp && emp.role === 'admin' ? 'selected' : ''}>${t('emp_role_admin')}</option>
      <option value="cashier" ${emp && emp.role === 'cashier' ? 'selected' : ''}>${t('emp_role_cashier')}</option>
      <option value="kitchen" ${emp && emp.role === "kitchen" ? "selected" : ""}>${t("emp_role_kitchen")}</option>
      <option value="waiter" ${emp && emp.role === 'waiter' ? 'selected' : ''}>${t('emp_role_waiter')}</option>
    </select>
    <label>${currentLang === 'ar' ? 'الدور المخصص / الطابق' : 'Assigned Floor'}</label>
    <select id="modal-emp-floor">
      <option value="1" ${emp && emp.default_floor === 1 ? 'selected' : ''}>${currentLang === 'ar' ? '🏢 الدور الأول (Floor 1)' : '🏢 Floor 1'}</option>
      <option value="2" ${emp && emp.default_floor === 2 ? 'selected' : ''}>${currentLang === 'ar' ? '🏢 الدور الثاني (Floor 2)' : '🏢 Floor 2'}</option>
      <option value="3" ${emp && emp.default_floor === 3 ? 'selected' : ''}>${currentLang === 'ar' ? '🏢 الدور الثالث (Floor 3)' : '🏢 Floor 3'}</option>
    </select>
    <label>${currentLang === 'ar' ? 'محطة العمل الافتراضية' : 'Default Station / Terminal'}</label>
    <select id="modal-emp-station">
      <option value="cashier_floor1" ${emp && emp.default_station === 'cashier_floor1' ? 'selected' : ''}>📍 كاشير الدور 1</option>
      <option value="cashier_floor2" ${emp && emp.default_station === 'cashier_floor2' ? 'selected' : ''}>📍 كاشير الدور 2</option>
      <option value="waiter_mobile" ${emp && emp.default_station === 'waiter_mobile' ? 'selected' : ''}>📱 جهاز نادل متنقل / Mobile Waiter</option>
    </select>
    <label>${t('emp_permissions')}</label>
    <div class="perm-checkboxes">
      <label><input type="checkbox" id="perm-kitchen" ${perms.kitchen ? "checked" : ""}> ${t("perm_kitchen")}</label>
      <label><input type="checkbox" id="perm-discount-orders" ${perms.discount_orders ? "checked" : ""}> ${t("perm_discount_orders")}</label>
      <label><input type="checkbox" id="perm-cancel-orders" ${perms.cancel_orders ? "checked" : ""}> ${t("perm_cancel_orders")}</label>
      <label><input type="checkbox" id="perm-pos" ${perms.pos ? 'checked' : ''}> ${t('perm_pos')}</label>
      <label><input type="checkbox" id="perm-menu" ${perms.menu ? 'checked' : ''}> ${t('perm_menu')}</label>
      <label><input type="checkbox" id="perm-reports" ${perms.reports ? 'checked' : ''}> ${t('perm_reports')}</label>
      <label><input type="checkbox" id="perm-dashboard" ${perms.dashboard ? 'checked' : ''}> لوحة القيادة (Dashboard)</label>
      <label><input type="checkbox" id="perm-settings" ${perms.settings ? 'checked' : ''}> ${t('perm_settings')}</label>
      <label><input type="checkbox" id="perm-audit" ${perms.audit ? 'checked' : ''}> ${t('perm_audit')}</label>
      <label><input type="checkbox" id="perm-employees" ${perms.employees ? 'checked' : ''}> ${t('perm_employees')}</label>
      <label><input type="checkbox" id="perm-customers" ${perms.customers ? 'checked' : ''}> إدارة العملاء (Customers)</label>
      <label><input type="checkbox" id="perm-inventory" ${perms.inventory ? 'checked' : ''}> إدارة المخزون (Inventory)</label>
      <label><input type="checkbox" id="perm-tables" ${perms.tables ? 'checked' : ''}> إدارة الطاولات (Tables)</label>
      <label><input type="checkbox" id="perm-daily-closing" ${perms.daily_closing ? 'checked' : ''}> ${t('perm_daily_closing')}</label>
      <label><input type="checkbox" id="perm-edit-orders" ${perms.edit_orders ? 'checked' : ''}> ${t('perm_edit_orders')}</label>
      <label><input type="checkbox" id="perm-delete-orders" ${perms.delete_orders ? 'checked' : ''}> ${t('perm_delete_orders')}</label>
      <label><input type="checkbox" id="perm-view-invoices" ${perms.view_invoices ? 'checked' : ''}> ${t('perm_view_invoices')}</label>
    </div>
    ${emp ? `
    <div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--border);">
      <label><input type="checkbox" id="modal-emp-active" ${emp.active !== 0 ? 'checked' : ''}> ${currentLang === 'ar' ? 'الحساب نشط ويستطيع الدخول' : 'Account is active'}</label>
    </div>` : ''}
  `, async () => {
    const data = {
      name: document.getElementById('modal-emp-name').value,
      name_en: document.getElementById('modal-emp-name-en').value,
      username: document.getElementById('modal-emp-username').value.trim().toLowerCase(),
      role: document.getElementById('modal-emp-role').value,
      default_floor: parseInt(document.getElementById('modal-emp-floor').value) || 1,
      default_station: document.getElementById('modal-emp-station').value,
      max_discount: document.getElementById('modal-emp-max-discount').value !== '' ? parseFloat(document.getElementById('modal-emp-max-discount').value) : 100,
        permissions: {
          kitchen: document.getElementById("perm-kitchen").checked,
          discount_orders: document.getElementById("perm-discount-orders").checked,
          cancel_orders: document.getElementById("perm-cancel-orders").checked,
          pos: document.getElementById('perm-pos').checked,
          menu: document.getElementById('perm-menu').checked,
          reports: document.getElementById('perm-reports').checked,
          dashboard: document.getElementById('perm-dashboard').checked,
          settings: document.getElementById('perm-settings').checked,
          audit: document.getElementById('perm-audit').checked,
          employees: document.getElementById('perm-employees').checked,
          customers: document.getElementById('perm-customers').checked,
          inventory: document.getElementById('perm-inventory').checked,
          tables: document.getElementById('perm-tables').checked,
          daily_closing: document.getElementById('perm-daily-closing').checked,
          edit_orders: document.getElementById('perm-edit-orders').checked,
          delete_orders: document.getElementById('perm-delete-orders').checked,
          view_invoices: document.getElementById('perm-view-invoices').checked,
        }
    };
    if (document.getElementById('modal-emp-active')) {
      data.active = document.getElementById('modal-emp-active').checked ? 1 : 0;
    }
    const pin = document.getElementById('modal-emp-pin').value;
    const password = document.getElementById('modal-emp-password').value;
    if (!data.name) return toast(t('name_required'), 'error');
    if (!emp && !pin) return toast(t('pin_required'), 'error');
    if (pin) data.pin = pin;
    if (password) data.password = password;
    if (emp) await api(`/api/employees/${emp.id}`, 'PUT', data);
    else await api('/api/employees', 'POST', data);
    toast(t('saved'), 'success');
    loadEmployeesAdmin();
  });
}
