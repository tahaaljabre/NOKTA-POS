// ===== Audit =====
async function loadAuditAdmin() {
  const emps = await api('/api/employees');
  const empSel = document.getElementById('audit-employee-filter');
  const currentSelectedEmp = empSel.value;
  empSel.innerHTML = `<option value="">${t('all_employees')}</option>` + emps.map(e => `<option value="${e.id}">${escapeHtml(e.name)} (${e.role})</option>`).join('');
  empSel.value = currentSelectedEmp;

  const empId = document.getElementById('audit-employee-filter').value;
  const action = document.getElementById('audit-action-filter').value;
  const date = document.getElementById('audit-date-filter').value;

  let url = '/api/audit?';
  if (empId) url += `employee_id=${empId}&`;
  if (action) url += `action=${action}&`;
  if (date) url += `date=${date}`;

  const logs = await api(url);
  const tbody = document.querySelector('#audit-table tbody');
  if (!tbody) return;

  tbody.innerHTML = logs.map(l => {
    const actionLabels = {
      login: '🔑 ' + t('action_login'),
      create: '➕ ' + t('action_create'),
      update: '✏️ ' + t('action_update'),
      delete: '🗑️ ' + t('action_delete'),
      delete_item: '🗑️ ' + (currentLang === 'ar' ? 'حذف صنف' : 'Delete item'),
      discount: '🏷️ ' + t('action_discount'),
      create_order: '🧾 ' + t('action_create_order'),
      complete_order: '✅ ' + t('action_complete'),
      cancel_order: '❌ ' + t('action_cancel'),
      update_order: '📝 ' + (currentLang === 'ar' ? 'تعديل فاتورة' : 'Update invoice'),
      delete_order: '🗑️ ' + (currentLang === 'ar' ? 'حذف فاتورة' : 'Delete invoice'),
    };

    const actionText = actionLabels[l.action] || l.action;
    const isOrderEntity = l.entity === 'orders' || l.entity === 'order';
    const orderId = l.entity_id;

    const beforeDisplay = formatAuditValue(l.old_value);
    const afterDisplay = formatAuditValue(l.new_value);

    return `<tr>
      <td style="font-size:11px;white-space:nowrap;font-weight:600;">${parsePOSDate(l.created_at).toLocaleString(currentLang === 'ar' ? 'ar-SA' : 'en-US')}</td>
      <td><strong>${escapeHtml(l.employee_name || '-')}</strong></td>
      <td><span class="audit-action-pill action-${escapeHtml(l.action)}">${escapeHtml(actionText)}</span></td>
      <td style="font-size:11.5px;max-width:220px;font-weight:500;">${escapeHtml(l.details || '')}</td>
      <td class="audit-diff-cell audit-diff-old">${beforeDisplay}</td>
      <td class="audit-diff-cell audit-diff-new">${afterDisplay}</td>
      <td class="action-btns" style="white-space:nowrap;">
        ${(isOrderEntity && orderId) ? `
          <button class="btn-edit" onclick="viewAuditInvoice(${orderId})" title="معاينة الفاتورة">👁️ ${currentLang === 'ar' ? 'معاينة' : 'View'}</button>
          <button class="btn-save" style="padding:4px 8px;font-size:11px;" onclick="printAuditInvoice(${orderId})" title="طباعة الفاتورة">🖨️ ${currentLang === 'ar' ? 'طباعة' : 'Print'}</button>
        ` : `<span style="color:var(--text-light);font-size:11px;">-</span>`}
      </td>
    </tr>`;
  }).join('');
}

function formatAuditValue(raw) {
  if (!raw || raw === '""' || raw === "''" || raw === '{}') return '<span class="audit-empty">-</span>';
  try {
    const data = JSON.parse(raw);
    if (data.summary) return `<div class="audit-summary-tag">${escapeHtml(data.summary)}</div>`;
    if (data.order) {
      const o = data.order;
      return `
        <div class="audit-order-brief">
          <div><strong>المجموع:</strong> ${o.total || 0} ${getCurrency()}</div>
          <div><strong>الخصم:</strong> ${o.discount_percent || 0}% (${o.discount_amount || 0})</div>
          <div><strong>الحالة:</strong> ${escapeHtml(o.status || '-')}</div>
          ${Array.isArray(data.items) ? `<div style="font-size:10px;color:var(--text-light);">${data.items.length} أصناف</div>` : ''}
        </div>
      `;
    }
    const labels = { name: 'الاسم', name_en: 'الاسم EN', price: 'السعر', price2: 'السعر 2', active: 'الحالة', sort_order: 'الترتيب', role: 'الدور', username: 'المستخدم', status: 'الحالة', total: 'الإجمالي', discount_percent: 'الخصم', payment_method: 'الدفع', category_id: 'القسم' };
    const fields = Object.entries(data).filter(([key, value]) => value !== null && value !== undefined && key !== 'permissions' && key !== 'attributes').slice(0, 10);
    return `<div class="audit-json-brief">${fields.map(([key, value]) => `<div><strong>${escapeHtml(labels[key] || key)}:</strong> ${escapeHtml(String(value))}</div>`).join('') || escapeHtml(JSON.stringify(data).slice(0, 160))}</div>`;
  } catch (e) {
    return `<span class="audit-text-val">${escapeHtml(raw)}</span>`;
  }
}

async function viewAuditInvoice(orderId) {
  try {
    const order = await api(`/api/orders/${orderId}`);
    if (!order) return toast(t('error'), 'error');
    
    const curr = getCurrency();
    const itemsHtml = (order.items || []).map(i => `
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0;">
        <span>${escapeHtml(currentLang === 'ar' ? (i.item_name || i.name) : (i.item_name_en || i.name_en || i.item_name || i.name))} × ${i.quantity}</span>
        <strong>${(i.price * i.quantity).toFixed(2)} ${curr}</strong>
      </div>
    `).join('');

    openModal(`فاتورة رقم #${order.invoice_number || order.id} (من التدقيق)`, `
      <div style="font-size:13px;line-height:1.6;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span><strong>الكاشير:</strong> ${escapeHtml(order.employee_name || '-')}</span>
          <span><strong>الحالة:</strong> ${escapeHtml(order.status)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span><strong>الدور / المحطة:</strong> ${order.station_id || 'الدور 1'}</span>
          <span><strong>التاريخ:</strong> ${parsePOSDate(order.created_at).toLocaleString()}</span>
        </div>
        <div style="background:#fcfaf7;border:1px solid #eee;border-radius:8px;padding:10px;margin:10px 0;">
          ${itemsHtml}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold;margin-top:10px;">
          <span>الإجمالي النهائي:</span>
          <span style="color:var(--primary);">${order.total} ${curr}</span>
        </div>
      </div>
    `, async () => {
      // Re-print directly
      generateReceipt(order);
    });
    
    // Change button text to print
    const saveBtn = document.getElementById('modal-confirm-btn');
    if (saveBtn) saveBtn.textContent = '🖨️ طباعة الفاتورة';
  } catch (e) {
    toast(t('error') + ': ' + e.message, 'error');
  }
}

async function printAuditInvoice(orderId) {
  try {
    const order = await api(`/api/orders/${orderId}`);
    if (!order) return toast(t('error'), 'error');
    generateReceipt(order);
    toast('جاري طباعة الفاتورة من التدقيق...', 'success');
  } catch (e) {
    toast(t('error') + ': ' + e.message, 'error');
  }
}
