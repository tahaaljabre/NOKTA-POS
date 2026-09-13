async function loadCashiersAdmin() {
  const el = document.getElementById('cashiers-admin-list'); if (!el) return;
  const rows = await api('/api/cashiers');
  el.innerHTML = rows.length ? rows.map(c => `<div class="attendance-device-card"><strong>${escapeHtml(c.code)}</strong><span>${escapeHtml(c.name)}${c.name_en ? ` / ${escapeHtml(c.name_en)}` : ''}</span><small>${c.active ? 'نشط / Active' : 'متوقف / Inactive'}</small><button class="btn-edit" onclick="openCashierForm(${c.id})">✏️ تعديل</button></div>`).join('') : '<div class="admin-muted">لا توجد كاشيرات / No cashiers</div>';
}
async function openCashierForm(id = null) {
  const current = id ? (await api('/api/cashiers', 'GET')).find(c => c.id === id) : null;
  openModal(current ? 'تعديل كاشير / Edit cashier' : 'إضافة كاشير / Add cashier', `
    <div class="employee-form">
      <label>الرمز / Code</label><input id="cashier-code" maxlength="16" value="${escapeHtml(current?.code || '')}" placeholder="A">
      <label>الاسم بالعربي / Arabic name</label><input id="cashier-name" value="${escapeHtml(current?.name || '')}">
      <label>الاسم بالإنجليزي / English name</label><input id="cashier-name-en" value="${escapeHtml(current?.name_en || '')}">
      ${current ? '<label>الحالة / Status</label><select id="cashier-active"><option value="1">نشط / Active</option><option value="0">متوقف / Inactive</option></select>' : ''}
    </div>`, async () => {
      const payload = { code: document.getElementById('cashier-code').value.trim().toUpperCase(), name: document.getElementById('cashier-name').value.trim(), name_en: document.getElementById('cashier-name-en').value.trim() };
      if (current) { payload.active = Number(document.getElementById('cashier-active').value); await api(`/api/cashiers/${id}`, 'PUT', payload); }
      else await api('/api/cashiers', 'POST', payload);
      loadCashiersAdmin();
    });
}
function setupCashiersAdmin() { const b=document.getElementById('btn-add-cashier'); if(b) b.onclick=()=>openCashierForm(); }
