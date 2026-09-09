// HR attendance administration. This module is deliberately separate from POS employees.
let attendanceEmployees = [];
let attendanceRecords = [];

async function loadAttendanceAdmin() {
  const date = document.getElementById('attendance-date');
  if (date && !date.value) date.value = new Date().toISOString().slice(0, 10);
  try {
    const selectedDate = date?.value || new Date().toISOString().slice(0, 10);
    const [employees, result, devices] = await Promise.all([
      api('/api/attendance/employees'),
      api(`/api/attendance/records?date=${encodeURIComponent(selectedDate)}`),
      api('/api/attendance/devices')
    ]);
    attendanceEmployees = employees || [];
    attendanceRecords = result.records || [];
    renderAttendanceRows(selectedDate);
    renderBiometricDevices(devices || []);
    applyTranslations();
  } catch (error) {
    console.error('Attendance loading failed:', error);
    toast(t('attendance_load_failed'), 'error');
  }
}

function renderAttendanceRows(date) {
  const tbody = document.querySelector('#attendance-admin-table tbody');
  if (!tbody) return;
  const byEmployee = new Map(attendanceRecords.map(record => [record.hr_employee_id, record]));
  tbody.innerHTML = attendanceEmployees.filter(employee => employee.active).map(employee => {
    const record = byEmployee.get(employee.id) || {};
    const name = currentLang === 'ar' ? employee.name : (employee.name_en || employee.name);
    return `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(employee.employee_code)}</td>
      <td>${escapeHtml(record.check_in || '—')}</td><td>${escapeHtml(record.check_out || '—')}</td>
      <td>${escapeHtml(t(`attendance_${record.status || 'absent'}`))}</td>
      <td class="action-btns"><button class="btn-edit" onclick="editHrEmployee(${employee.id})">${escapeHtml(t('edit'))}</button><button class="btn-delete" onclick="deleteHrEmployee(${employee.id})">${escapeHtml(t('delete'))}</button><button class="btn-print" onclick="printHrEmployeeReport(${employee.id})">${escapeHtml(t('print'))}</button><button class="btn-edit" onclick="editAttendanceRecord(${employee.id}, '${date}')">${escapeHtml(t('attendance_edit'))}</button></td></tr>`;
  }).join('') || `<tr><td colspan="6">${escapeHtml(t('attendance_no_employees'))}</td></tr>`;
}

async function editAttendanceRecord(employeeId, date) {
  const existing = attendanceRecords.find(record => record.hr_employee_id === employeeId) || {};
  const checkIn = window.prompt(t('attendance_check_in_prompt'), existing.check_in || '09:00');
  if (checkIn === null) return;
  const checkOut = window.prompt(t('attendance_check_out_prompt'), existing.check_out || '17:00');
  if (checkOut === null) return;
  try {
    await api('/api/attendance/records', 'POST', { hr_employee_id: employeeId, attendance_date: date, check_in: checkIn, check_out: checkOut, status: 'present', source: 'manual' });
    await loadAttendanceAdmin();
    toast(t('attendance_saved'), 'success');
  } catch (error) { toast(error.message, 'error'); }
}

function renderBiometricDevices(devices) {
  const container = document.getElementById('biometric-device-list');
  if (!container) return;
  container.innerHTML = `<h3>${escapeHtml(t('biometric_devices'))}</h3>` + (devices.length ? devices.map(device => `<div class="attendance-device-card"><strong>${escapeHtml(device.name)}</strong><span>${escapeHtml(device.provider)}${device.host ? ` · ${escapeHtml(device.host)}` : ''}</span><small>${escapeHtml(device.last_sync_at || t('biometric_not_synced'))}</small></div>`).join('') : `<p>${escapeHtml(t('biometric_no_devices'))}</p>`);
}

async function addHrEmployee() {
  openModal(t('add_hr_employee'), `<div class="hr-form-grid">
    <label>${t('hr_name_ar')}<input id="hr-name" required></label>
    <label>${t('hr_name_en')}<input id="hr-name-en"></label>
    <label>${t('hr_code')}<input id="hr-code" required></label>
    <label>${t('hr_phone')}<input id="hr-phone" inputmode="tel"></label>
    <label>${t('hr_department')}<input id="hr-department"></label>
    <label>${t('hr_job_title')}<input id="hr-job-title"></label>
    <label>${t('hr_employment_type')}<select id="hr-employment-type"><option value="full_time">${t('hr_full_time')}</option><option value="part_time">${t('hr_part_time')}</option><option value="temporary">${t('hr_temporary')}</option></select></label>
    <label>${t('hr_hire_date')}<input id="hr-hire-date" type="date"></label>
  </div>`, async () => {
    const name = document.getElementById('hr-name').value.trim();
    const code = document.getElementById('hr-code').value.trim();
    if (!name || !code) { toast(t('hr_required'), 'error'); return false; }
    await api('/api/attendance/employees', 'POST', { name, employee_code: code, name_en: document.getElementById('hr-name-en').value.trim(), phone: document.getElementById('hr-phone').value.trim(), department: document.getElementById('hr-department').value.trim(), job_title: document.getElementById('hr-job-title').value.trim(), employment_type: document.getElementById('hr-employment-type').value, hire_date: document.getElementById('hr-hire-date').value || null });
    await loadAttendanceAdmin();
  });
}

function hrEmployeeForm(employee = null) {
  const value = key => escapeHtml(employee?.[key] || '');
  return `<div class="hr-form-grid"><label>${t('hr_name_ar')}<input id="hr-name" value="${value('name')}" required></label><label>${t('hr_name_en')}<input id="hr-name-en" value="${value('name_en')}"></label><label>${t('hr_code')}<input id="hr-code" value="${value('employee_code')}" required></label><label>${t('hr_phone')}<input id="hr-phone" value="${value('phone')}" inputmode="tel"></label><label>${t('hr_department')}<input id="hr-department" value="${value('department')}"></label><label>${t('hr_job_title')}<input id="hr-job-title" value="${value('job_title')}"></label><label>${t('hr_employment_type')}<select id="hr-employment-type"><option value="full_time" ${employee?.employment_type === 'full_time' ? 'selected' : ''}>${t('hr_full_time')}</option><option value="part_time" ${employee?.employment_type === 'part_time' ? 'selected' : ''}>${t('hr_part_time')}</option><option value="temporary" ${employee?.employment_type === 'temporary' ? 'selected' : ''}>${t('hr_temporary')}</option></select></label><label>${t('hr_hire_date')}<input id="hr-hire-date" type="date" value="${value('hire_date')}"></label></div>`;
}

async function editHrEmployee(id) {
  const employee = attendanceEmployees.find(item => item.id === id); if (!employee) return;
  openModal(t('edit_hr_employee'), hrEmployeeForm(employee), async () => {
    const payload = { employee_code: document.getElementById('hr-code').value.trim(), name: document.getElementById('hr-name').value.trim(), name_en: document.getElementById('hr-name-en').value.trim(), phone: document.getElementById('hr-phone').value.trim(), department: document.getElementById('hr-department').value.trim(), job_title: document.getElementById('hr-job-title').value.trim(), employment_type: document.getElementById('hr-employment-type').value, hire_date: document.getElementById('hr-hire-date').value || null };
    if (!payload.name || !payload.employee_code) { toast(t('hr_required'), 'error'); return false; }
    await api(`/api/attendance/employees/${id}`, 'PUT', payload); await loadAttendanceAdmin();
  });
}

async function deleteHrEmployee(id) {
  const employee = attendanceEmployees.find(item => item.id === id); if (!employee || !confirm(t('hr_delete_confirm'))) return;
  await api(`/api/attendance/employees/${id}`, 'DELETE'); await loadAttendanceAdmin(); toast(t('hr_deleted'), 'success');
}

function printHrReport(title, employees, records) {
  const rows = employees.map(employee => { const record = records.find(item => item.hr_employee_id === employee.id) || {}; return `<tr><td>${escapeHtml(employee.name)}</td><td>${escapeHtml(employee.employee_code)}</td><td>${escapeHtml(employee.department || '—')}</td><td>${escapeHtml(record.check_in || '—')}</td><td>${escapeHtml(record.check_out || '—')}</td><td>${escapeHtml(t(`attendance_${record.status || 'absent'}`))}</td></tr>`; }).join('');
  const win = window.open('', '_blank', 'noopener'); if (!win) return;
  win.document.write(`<!doctype html><html dir="${currentLang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Segoe UI,Tahoma,sans-serif;padding:24px;color:#321f22}h1{color:#6b1124}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #d9cbb9;padding:9px;text-align:start}th{background:#f3eadf}@media print{button{display:none}}</style></head><body><h1>${escapeHtml(title)}</h1><p>${new Date().toLocaleString()}</p><table><thead><tr><th>${t('hr_name_ar')}</th><th>${t('hr_code')}</th><th>${t('hr_department')}</th><th>${t('check_in')}</th><th>${t('check_out')}</th><th>${t('attendance_status')}</th></tr></thead><tbody>${rows}</tbody></table><button onclick="window.print()">${t('print')}</button><script>window.onload=()=>window.print()</script></body></html>`); win.document.close();
}

function printHrEmployeeReport(id) { const employee = attendanceEmployees.find(item => item.id === id); if (employee) printHrReport(`${t('hr_employee_report')} — ${employee.name}`, [employee], attendanceRecords); }
function printAllHrReport() { printHrReport(t('all_hr_report'), attendanceEmployees.filter(employee => employee.active), attendanceRecords); }

async function addBiometricDevice() {
  const name = window.prompt(t('biometric_device_name_prompt')); if (!name) return;
  const provider = window.prompt(t('biometric_provider_prompt'), 'generic'); if (!provider) return;
  try { await api('/api/attendance/devices', 'POST', { name, provider }); await loadAttendanceAdmin(); } catch (error) { toast(error.message, 'error'); }
}

function setupAttendanceAdmin() {
  document.getElementById('attendance-date')?.addEventListener('change', loadAttendanceAdmin);
  document.getElementById('btn-attendance-refresh')?.addEventListener('click', loadAttendanceAdmin);
  document.getElementById('btn-add-hr-employee')?.addEventListener('click', addHrEmployee);
  document.getElementById('btn-add-biometric-device')?.addEventListener('click', addBiometricDevice);
  document.getElementById('btn-print-all-hr')?.addEventListener('click', printAllHrReport);
}
