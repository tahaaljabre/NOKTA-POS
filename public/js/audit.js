// ===== Audit - Redesigned =====

function auditActionMeta(action) {
  const ar = {
    login:         { icon: '🔑', label: 'دخول النظام',       color: '#2563eb', bg: '#eff6ff' },
    create:        { icon: '➕', label: 'إضافة',              color: '#059669', bg: '#ecfdf5' },
    update:        { icon: '✏️', label: 'تعديل',              color: '#d97706', bg: '#fffbeb' },
    delete:        { icon: '🗑️', label: 'حذف',               color: '#dc2626', bg: '#fef2f2' },
    create_order:  { icon: '🧾', label: 'فاتورة جديدة',      color: '#059669', bg: '#ecfdf5' },
    update_order:  { icon: '📝', label: 'تعديل فاتورة',      color: '#d97706', bg: '#fffbeb' },
    delete_order:  { icon: '🗑️', label: 'حذف فاتورة',      color: '#dc2626', bg: '#fef2f2' },
    cancel_order:  { icon: '❌', label: 'إلغاء فاتورة',     color: '#dc2626', bg: '#fef2f2' },
    complete_order:{ icon: '✅', label: 'إتمام فاتورة',     color: '#059669', bg: '#ecfdf5' },
    discount:      { icon: '🏷️', label: 'خصم',               color: '#7c3aed', bg: '#f5f3ff' },
    deactivate:    { icon: '⛔', label: 'تعطيل حساب',      color: '#dc2626', bg: '#fef2f2' },
  };
  const en = {
    login:         { icon: '🔑', label: 'Login',            color: '#2563eb', bg: '#eff6ff' },
    create:        { icon: '➕', label: 'Create',           color: '#059669', bg: '#ecfdf5' },
    update:        { icon: '✏️', label: 'Update',           color: '#d97706', bg: '#fffbeb' },
    delete:        { icon: '🗑️', label: 'Delete',           color: '#dc2626', bg: '#fef2f2' },
    create_order:  { icon: '🧾', label: 'New Invoice',      color: '#059669', bg: '#ecfdf5' },
    update_order:  { icon: '📝', label: 'Edit Invoice',      color: '#d97706', bg: '#fffbeb' },
    delete_order:  { icon: '🗑️', label: 'Delete Invoice',    color: '#dc2626', bg: '#fef2f2' },
    cancel_order:  { icon: '❌', label: 'Cancel Invoice',   color: '#dc2626', bg: '#fef2f2' },
    complete_order:{ icon: '✅', label: 'Complete Invoice',  color: '#059669', bg: '#ecfdf5' },
    discount:      { icon: '🏷️', label: 'Discount',         color: '#7c3aed', bg: '#f5f3ff' },
    deactivate:    { icon: '⛔', label: 'Deactivate',       color: '#dc2626', bg: '#fef2f2' },
  };
  const map = currentLang === 'ar' ? ar : en;
  return map[action] || { icon: '📌', label: action, color: '#6b7280', bg: '#f9fafb' };
}

function parseOrderSnapshot(raw) {
  if (!raw || raw === 'DELETED' || raw === '""') return null;
  try {
    const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (d && (d.invoice_number !== undefined || d.total !== undefined || d.items !== undefined)) return d;
    if (d && d.order) return d.order;
    return null;
  } catch { return null; }
}

function renderInvoiceCard(snap, label, colorClass) {
  if (!snap) return `<div class="audit-snap-empty">${currentLang === 'ar' ? 'لا توجد بيانات' : 'No data'}</div>`;
  const curr = getCurrency();
  const isAr = currentLang === 'ar';
  const statusMap = { active: isAr ? 'نشط' : 'Active', completed: isAr ? 'مكتمل' : 'Completed', cancelled: isAr ? 'ملغي' : 'Cancelled' };
  const typeMap = { dine_in: isAr ? 'داخلي' : 'Dine In', takeaway: isAr ? 'سفري' : 'Takeaway', delivery: isAr ? 'توصيل' : 'Delivery' };
  const items = Array.isArray(snap.items) ? snap.items : [];
  const itemsHtml = items.length ? items.map(i => {
    const name = isAr ? (i.item_name || i.name || '-') : (i.item_name_en || i.name_en || i.item_name || i.name || '-');
    return `<div class="audit-inv-item"><span>${escapeHtml(name)} × ${i.quantity}</span><span>${((i.price||0)*(i.quantity||1)).toFixed(2)} ${curr}</span></div>`;
  }).join('') : `<div class="audit-inv-item-empty">${isAr ? 'لا توجد أصناف' : 'No items'}</div>`;

  return `
    <div class="audit-inv-card ${colorClass}">
      <div class="audit-inv-header">
        <span class="audit-inv-label">${escapeHtml(label)}</span>
        <span class="audit-inv-num">#${snap.invoice_number || snap.id || '-'}</span>
      </div>
      <div class="audit-inv-meta">
        <span>💳 ${escapeHtml(typeMap[snap.type] || snap.type || '-')}</span>
        <span>📊 ${escapeHtml(statusMap[snap.status] || snap.status || '-')}</span>
        ${snap.table_number ? `<span>🪑 ${isAr ? 'طاولة' : 'Table'} ${snap.table_number}</span>` : ''}
        ${snap.customer_name ? `<span>👤 ${escapeHtml(snap.customer_name)}</span>` : ''}
      </div>
      <div class="audit-inv-items">${itemsHtml}</div>
      <div class="audit-inv-totals">
        <div class="audit-inv-row"><span>${isAr ? 'المجموع' : 'Subtotal'}</span><span>${(snap.subtotal||0).toFixed(2)} ${curr}</span></div>
        ${(snap.discount_percent||snap.discount_amount) ? `<div class="audit-inv-row audit-inv-disc"><span>🏷️ ${isAr ? 'خصم' : 'Discount'} ${snap.discount_percent ? snap.discount_percent+'%' : ''}</span><span>-${(snap.discount_amount||0).toFixed(2)} ${curr}</span></div>` : ''}
        ${snap.tax_amount ? `<div class="audit-inv-row"><span>${isAr ? 'ضريبة' : 'Tax'} ${snap.tax_percent ? snap.tax_percent+'%' : ''}</span><span>${(snap.tax_amount||0).toFixed(2)} ${curr}</span></div>` : ''}
        <div class="audit-inv-row audit-inv-total"><span>${isAr ? 'الإجمالي' : 'Total'}</span><span>${(snap.total||0).toFixed(2)} ${curr}</span></div>
        ${snap.payment_method ? `<div class="audit-inv-row"><span>${isAr ? 'طريقة الدفع' : 'Payment'}</span><span>${escapeHtml(snap.payment_method)}</span></div>` : ''}
      </div>
    </div>
  `;
}

function renderAuditChangeSummary(oldSnap, newSnap, action) {
  const isAr = currentLang === 'ar';
  const curr = getCurrency();
  const changes = [];

  // حالة الحذف
  if (action === 'delete_order') {
    if (oldSnap) {
      changes.push(`<span class="audit-change-chip audit-chip-delete">🗑️ ${isAr ? 'تم حذف الفاتورة #' : 'Invoice #'}${oldSnap.invoice_number||''} &mdash; ${isAr ? 'إجمالي' : 'Total'}: <strong>${(oldSnap.total||0).toFixed(2)} ${curr}</strong></span>`);
    }
    return `<div class="audit-changes-summary">${changes.join('')}</div>`;
  }

  // حالة الإلغاء
  if (action === 'cancel_order') {
    changes.push(`<span class="audit-change-chip audit-chip-delete">❌ ${isAr ? 'تم إلغاء الفاتورة' : 'Invoice cancelled'}</span>`);
    return `<div class="audit-changes-summary">${changes.join('')}</div>`;
  }

  if (!oldSnap || !newSnap) return '';

  // تغيير الحالة
  if (oldSnap.status !== newSnap.status) {
    const statusMap = { active: isAr ? 'نشط' : 'Active', completed: isAr ? 'مكتمل' : 'Completed', cancelled: isAr ? 'ملغي' : 'Cancelled' };
    changes.push(`${isAr ? 'الحالة' : 'Status'}: <del>${escapeHtml(statusMap[oldSnap.status]||oldSnap.status)}</del> → <strong>${escapeHtml(statusMap[newSnap.status]||newSnap.status)}</strong>`);
  }

  // تغيير الخصم
  const oldDisc = oldSnap.discount_percent || 0;
  const newDisc = newSnap.discount_percent || 0;
  if (oldDisc !== newDisc) {
    changes.push(`🏷️ ${isAr ? 'خصم' : 'Discount'}: <del>${oldDisc}%</del> → <strong style="color:#7c3aed">${newDisc}%</strong>`);
  }

  // تغيير الإجمالي
  const oldTotal = oldSnap.total || 0;
  const newTotal = newSnap.total || 0;
  if (Math.abs(oldTotal - newTotal) > 0.001) {
    const diff = newTotal - oldTotal;
    const sign = diff > 0 ? '+' : '';
    const color = diff > 0 ? '#dc2626' : '#059669';
    changes.push(`💰 ${isAr ? 'الإجمالي' : 'Total'}: <del>${oldTotal.toFixed(2)}</del> → <strong style="color:${color}">${newTotal.toFixed(2)} ${curr}</strong> <em style="color:${color};font-size:11px;">(${sign}${diff.toFixed(2)})</em>`);
  }

  // تغيير الأصناف
  const oldItems = Array.isArray(oldSnap.items) ? oldSnap.items : [];
  const newItems = Array.isArray(newSnap.items) ? newSnap.items : [];
  if (oldItems.length !== newItems.length) {
    changes.push(`🍽️ ${isAr ? 'عدد الأصناف' : 'Items'}: <del>${oldItems.length}</del> → <strong>${newItems.length}</strong>`);
  } else {
    // فحص تغيير الكميات
    const qtyChanges = [];
    newItems.forEach(ni => {
      const oi = oldItems.find(o => o.item_id === ni.item_id);
      if (oi && oi.quantity !== ni.quantity) {
        const name = currentLang === 'ar' ? (ni.item_name || ni.name || '') : (ni.item_name_en || ni.name_en || ni.item_name || '');
        qtyChanges.push(`${escapeHtml(name)}: <del>${oi.quantity}</del>→<strong>${ni.quantity}</strong>`);
      }
    });
    if (qtyChanges.length) changes.push(`📊 ${isAr ? 'كميات' : 'Qty'}: ${qtyChanges.join(' | ')}`);
  }

  // تغيير طريقة الدفع
  if (oldSnap.payment_method && newSnap.payment_method && oldSnap.payment_method !== newSnap.payment_method) {
    changes.push(`💳 ${isAr ? 'طريقة الدفع' : 'Payment'}: <del>${escapeHtml(oldSnap.payment_method)}</del> → <strong>${escapeHtml(newSnap.payment_method)}</strong>`);
  }

  if (!changes.length) {
    return `<div class="audit-changes-summary"><span class="audit-change-chip" style="color:var(--text-muted);">${isAr ? 'لا تغييرات ظاهرة' : 'No visible changes'}</span></div>`;
  }
  return `<div class="audit-changes-summary">${changes.map(c=>`<span class="audit-change-chip">${c}</span>`).join('')}</div>`;
}

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
  const container = document.getElementById('audit-cards-container');
  if (!container) return;

  if (!logs.length) {
    container.innerHTML = `<div class="audit-empty-state">
      <div style="font-size:3rem;margin-bottom:12px;">📋</div>
      <div style="font-size:1.1rem;font-weight:600;color:var(--text-light);">${currentLang === 'ar' ? 'لا توجد سجلات للفترة المختارة' : 'No audit records for the selected period'}</div>
    </div>`;
    return;
  }

  container.innerHTML = logs.map(l => {
    const meta = auditActionMeta(l.action);
    const isAr = currentLang === 'ar';
    const isOrderAction = ['create_order','update_order','delete_order','cancel_order','complete_order'].includes(l.action);
    const oldSnap = parseOrderSnapshot(l.old_value);
    const newSnap = parseOrderSnapshot(l.new_value);
    // عرض اللقطات: للحذف نعرض فقط القديمة، للتعديل نعرض الاثنتين
    const hasSnapshots = isOrderAction && (oldSnap || (newSnap && Object.keys(newSnap).length > 0));
    const changeSummary = isOrderAction ? renderAuditChangeSummary(oldSnap, newSnap, l.action) : '';
    const dateStr = parsePOSDate(l.created_at).toLocaleString(isAr ? 'ar-SA' : 'en-US', { dateStyle:'short', timeStyle:'short' });

    // Build what changed label
    let actionDesc = '';
    if (l.action === 'delete_order') actionDesc = isAr ? 'قام بحذف الفاتورة' : 'Deleted the invoice';
    else if (l.action === 'update_order') actionDesc = isAr ? 'قام بتعديل الفاتورة' : 'Edited the invoice';
    else if (l.action === 'cancel_order') actionDesc = isAr ? 'قام بإلغاء الفاتورة' : 'Cancelled the invoice';
    else if (l.action === 'complete_order') actionDesc = isAr ? 'أتم الفاتورة' : 'Completed the invoice';
    else if (l.action === 'create_order') actionDesc = isAr ? 'أنشأ فاتورة جديدة' : 'Created a new invoice';
    else actionDesc = escapeHtml(l.details || meta.label);

    const invoiceNum = (oldSnap || newSnap)?.invoice_number || l.entity_id || '';
    const invoiceRef = invoiceNum ? ` #${invoiceNum}` : '';

    return `
    <div class="audit-card" style="--action-color:${meta.color};--action-bg:${meta.bg};">
      <div class="audit-card-header">
        <div class="audit-card-left">
          <span class="audit-action-badge" style="background:${meta.bg};color:${meta.color};border-color:${meta.color}22;">
            ${meta.icon} ${escapeHtml(meta.label)}
          </span>
          <span class="audit-card-desc">${actionDesc}${invoiceRef ? `<strong>${escapeHtml(invoiceRef)}</strong>` : ''}</span>
        </div>
        <div class="audit-card-right">
          <span class="audit-emp-badge">👤 ${escapeHtml(l.employee_name || '-')}</span>
          <span class="audit-time-badge">🕒 ${dateStr}</span>
          ${isOrderAction && l.entity_id ? `
            <button class="audit-print-btn" onclick="printAuditInvoice(${l.entity_id})" title="${isAr ? 'طباعة الفاتورة الحالية' : 'Print current invoice'}">
              🖨️ ${isAr ? 'طباعة' : 'Print'}
            </button>
          ` : ''}
        </div>
      </div>
      ${changeSummary}
      ${hasSnapshots ? (() => {
        const isDelete = l.action === 'delete_order';
        if (isDelete) {
          // للحذف: نعرض فقط الفاتورة القديمة في عرض كامل العرض
          return `<div class="audit-snapshots audit-snapshots-single">
            <div class="audit-snap-col" style="grid-column:1/-1;">
              <div class="audit-snap-title audit-snap-before">${isAr ? '⬅️ الفاتورة المحذوفة' : '⬅️ Deleted Invoice'}</div>
              ${renderInvoiceCard(oldSnap, isAr ? 'قبل الحذف' : 'Before Deletion', 'audit-inv-old')}
            </div>
          </div>`;
        }
        return `<div class="audit-snapshots">
          <div class="audit-snap-col">
            <div class="audit-snap-title audit-snap-before">${isAr ? '⬅️ قبل التعديل' : '⬅️ Before'}</div>
            ${renderInvoiceCard(oldSnap, isAr ? 'الفاتورة القديمة' : 'Old Invoice', 'audit-inv-old')}
          </div>
          <div class="audit-snap-divider">⇄</div>
          <div class="audit-snap-col">
            <div class="audit-snap-title audit-snap-after">${isAr ? '✅ بعد التعديل' : '✅ After'}</div>
            ${renderInvoiceCard(newSnap, isAr ? 'الفاتورة الجديدة' : 'New Invoice', 'audit-inv-new')}
          </div>
        </div>`;
      })() : (l.details && !isOrderAction ? `<div class="audit-card-detail">${escapeHtml(l.details)}</div>` : '')}
    </div>`;
  }).join('');
}

async function printAuditInvoice(orderId) {
  try {
    const order = await api(`/api/orders/${orderId}`);
    if (!order) return toast(t('error'), 'error');
    generateReceipt(order);
    toast(currentLang === 'ar' ? 'جاري طباعة الفاتورة...' : 'Printing invoice...', 'success');
  } catch (e) {
    toast(t('error') + ': ' + e.message, 'error');
  }
}

async function viewAuditInvoice(orderId) {
  try {
    const order = await api(`/api/orders/${orderId}`);
    if (!order) return toast(t('error'), 'error');
    const curr = getCurrency();
    const isAr = currentLang === 'ar';
    const itemsHtml = (order.items || []).map(i => `
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0;">
        <span>${escapeHtml(isAr ? (i.item_name || i.name) : (i.item_name_en || i.name_en || i.item_name || i.name))} × ${i.quantity}</span>
        <strong>${(i.price * i.quantity).toFixed(2)} ${curr}</strong>
      </div>
    `).join('');
    openModal(`${isAr ? 'فاتورة رقم' : 'Invoice #'}${order.invoice_number || order.id}`, `
      <div style="font-size:13px;line-height:1.6;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span><strong>${isAr ? 'الكاشير' : 'Cashier'}:</strong> ${escapeHtml(order.employee_name || '-')}</span>
          <span><strong>${isAr ? 'الحالة' : 'Status'}:</strong> ${escapeHtml(order.status)}</span>
        </div>
        <div style="background:#fcfaf7;border:1px solid #eee;border-radius:8px;padding:10px;margin:10px 0;">${itemsHtml}</div>
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold;margin-top:10px;">
          <span>${isAr ? 'الإجمالي' : 'Total'}:</span>
          <span style="color:var(--primary);">${order.total} ${curr}</span>
        </div>
      </div>
    `, async () => { generateReceipt(order); });
    const saveBtn = document.getElementById('modal-confirm-btn');
    if (saveBtn) saveBtn.textContent = `🖨️ ${isAr ? 'طباعة الفاتورة' : 'Print Invoice'}`;
  } catch (e) { toast(t('error') + ': ' + e.message, 'error'); }
}
