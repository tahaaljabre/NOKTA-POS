// ===== Audit - Redesigned =====
// القاعدة: كل نص ظاهر يُستخدم عبر t() من i18n.js - لا تكتب نصوصاً مباشرة هنا

function auditActionMeta(action) {
  const colors = {
    login:          { icon: '🔑', color: '#2563eb', bg: '#eff6ff', key: 'audit_action_login' },
    create:         { icon: '➕', color: '#059669', bg: '#ecfdf5', key: 'audit_action_create' },
    update:         { icon: '✏️', color: '#d97706', bg: '#fffbeb', key: 'audit_action_update' },
    delete:         { icon: '🗑️', color: '#dc2626', bg: '#fef2f2', key: 'audit_action_delete' },
    create_order:   { icon: '🧾', color: '#059669', bg: '#ecfdf5', key: 'audit_action_create_order' },
    update_order:   { icon: '📝', color: '#d97706', bg: '#fffbeb', key: 'audit_action_update_order' },
    delete_order:   { icon: '🗑️', color: '#dc2626', bg: '#fef2f2', key: 'audit_action_delete_order' },
    cancel_order:   { icon: '❌', color: '#dc2626', bg: '#fef2f2', key: 'audit_action_cancel_order' },
    complete_order: { icon: '✅', color: '#059669', bg: '#ecfdf5', key: 'audit_action_complete_order' },
    discount:       { icon: '🏷️', color: '#7c3aed', bg: '#f5f3ff', key: 'audit_action_discount' },
    deactivate:     { icon: '⛔', color: '#dc2626', bg: '#fef2f2', key: 'audit_action_deactivate' },
  };
  const m = colors[action];
  if (m) return { icon: m.icon, label: t(m.key), color: m.color, bg: m.bg };
  return { icon: '📌', label: t('audit_action_unknown') + ': ' + action, color: '#6b7280', bg: '#f9fafb' };
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
  if (!snap) return `<div class="audit-snap-empty">${t('inv_no_data')}</div>`;
  const curr = getCurrency();
  const statusMap = {
    active:    t('status_active'),
    completed: t('status_completed'),
    cancelled: t('status_cancelled')
  };
  const typeMap = {
    dine_in:  t('type_dine_in'),
    takeaway: t('type_takeaway'),
    delivery: t('type_delivery')
  };
  const items = Array.isArray(snap.items) ? snap.items : [];
  const isAr = currentLang === 'ar';
  const itemsHtml = items.length
    ? items.map(i => {
        const name = isAr
          ? (i.item_name || i.name || '-')
          : (i.item_name_en || i.name_en || i.item_name || i.name || '-');
        return `<div class="audit-inv-item"><span>${escapeHtml(name)} × ${i.quantity}</span><span>${((i.price||0)*(i.quantity||1)).toFixed(2)} ${curr}</span></div>`;
      }).join('')
    : `<div class="audit-inv-item-empty">${t('inv_no_items')}</div>`;

  return `
    <div class="audit-inv-card ${colorClass}">
      <div class="audit-inv-header">
        <span class="audit-inv-label">${escapeHtml(label)}</span>
        <span class="audit-inv-num">#${snap.invoice_number || snap.id || '-'}</span>
      </div>
      <div class="audit-inv-meta">
        <span>💳 ${escapeHtml(typeMap[snap.type] || snap.type || '-')}</span>
        <span>📊 ${escapeHtml(statusMap[snap.status] || snap.status || '-')}</span>
        ${snap.table_number ? `<span>🪑 ${t('inv_table')} ${snap.table_number}</span>` : ''}
        ${snap.customer_name ? `<span>👤 ${escapeHtml(snap.customer_name)}</span>` : ''}
      </div>
      <div class="audit-inv-items">${itemsHtml}</div>
      <div class="audit-inv-totals">
        <div class="audit-inv-row"><span>${t('inv_subtotal')}</span><span>${(snap.subtotal||0).toFixed(2)} ${curr}</span></div>
        ${(snap.discount_percent||snap.discount_amount)
          ? `<div class="audit-inv-row audit-inv-disc"><span>🏷️ ${t('inv_discount')} ${snap.discount_percent ? snap.discount_percent+'%' : ''}</span><span>-${(snap.discount_amount||0).toFixed(2)} ${curr}</span></div>`
          : ''}
        ${snap.tax_amount
          ? `<div class="audit-inv-row"><span>${t('inv_tax')} ${snap.tax_percent ? snap.tax_percent+'%' : ''}</span><span>${(snap.tax_amount||0).toFixed(2)} ${curr}</span></div>`
          : ''}
        <div class="audit-inv-row audit-inv-total"><span>${t('inv_total')}</span><span>${(snap.total||0).toFixed(2)} ${curr}</span></div>
        ${snap.payment_method
          ? `<div class="audit-inv-row"><span>${t('inv_payment')}</span><span>${escapeHtml(snap.payment_method)}</span></div>`
          : ''}
      </div>
    </div>
  `;
}

function renderAuditChangeSummary(oldSnap, newSnap, action) {
  const curr = getCurrency();
  const changes = [];

  if (action === 'delete_order') {
    if (oldSnap) {
      changes.push(`<span class="audit-change-chip audit-chip-delete">🗑️ ${t('audit_deleted_chip')}${oldSnap.invoice_number||''} &mdash; ${t('audit_change_total_label')}: <strong>${(oldSnap.total||0).toFixed(2)} ${curr}</strong></span>`);
    }
    return `<div class="audit-changes-summary">${changes.join('')}</div>`;
  }

  if (action === 'cancel_order') {
    changes.push(`<span class="audit-change-chip audit-chip-delete">❌ ${t('audit_cancelled_chip')}</span>`);
    return `<div class="audit-changes-summary">${changes.join('')}</div>`;
  }

  if (!oldSnap || !newSnap) return '';

  if (oldSnap.status !== newSnap.status) {
    const statusMap = { active: t('status_active'), completed: t('status_completed'), cancelled: t('status_cancelled') };
    changes.push(`${t('audit_change_status')}: <del>${escapeHtml(statusMap[oldSnap.status]||oldSnap.status)}</del> → <strong>${escapeHtml(statusMap[newSnap.status]||newSnap.status)}</strong>`);
  }

  const oldDisc = oldSnap.discount_percent || 0;
  const newDisc = newSnap.discount_percent || 0;
  if (oldDisc !== newDisc) {
    changes.push(`🏷️ ${t('audit_change_discount')}: <del>${oldDisc}%</del> → <strong style="color:#7c3aed">${newDisc}%</strong>`);
  }

  const oldTotal = oldSnap.total || 0;
  const newTotal = newSnap.total || 0;
  if (Math.abs(oldTotal - newTotal) > 0.001) {
    const diff = newTotal - oldTotal;
    const sign = diff > 0 ? '+' : '';
    const color = diff > 0 ? '#dc2626' : '#059669';
    changes.push(`💰 ${t('audit_change_total')}: <del>${oldTotal.toFixed(2)}</del> → <strong style="color:${color}">${newTotal.toFixed(2)} ${curr}</strong> <em style="color:${color};font-size:11px;">(${sign}${diff.toFixed(2)})</em>`);
  }

  const oldItems = Array.isArray(oldSnap.items) ? oldSnap.items : [];
  const newItems = Array.isArray(newSnap.items) ? newSnap.items : [];
  const isAr = currentLang === 'ar';
  if (oldItems.length !== newItems.length) {
    changes.push(`🍽️ ${t('audit_change_items')}: <del>${oldItems.length}</del> → <strong>${newItems.length}</strong>`);
  } else {
    const qtyChanges = [];
    newItems.forEach(ni => {
      const oi = oldItems.find(o => o.item_id === ni.item_id);
      if (oi && oi.quantity !== ni.quantity) {
        const name = isAr ? (ni.item_name || ni.name || '') : (ni.item_name_en || ni.name_en || ni.item_name || '');
        qtyChanges.push(`${escapeHtml(name)}: <del>${oi.quantity}</del>→<strong>${ni.quantity}</strong>`);
      }
    });
    if (qtyChanges.length) changes.push(`📊 ${t('audit_change_qty')}: ${qtyChanges.join(' | ')}`);
  }

  if (oldSnap.payment_method && newSnap.payment_method && oldSnap.payment_method !== newSnap.payment_method) {
    changes.push(`💳 ${t('audit_change_payment')}: <del>${escapeHtml(oldSnap.payment_method)}</del> → <strong>${escapeHtml(newSnap.payment_method)}</strong>`);
  }

  if (!changes.length) {
    return `<div class="audit-changes-summary"><span class="audit-change-chip" style="color:var(--text-muted);">${t('audit_no_change')}</span></div>`;
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
      <div style="font-size:1.1rem;font-weight:600;color:var(--text-light);">${t('audit_no_records')}</div>
    </div>`;
    return;
  }

  container.innerHTML = logs.map(l => {
    const meta = auditActionMeta(l.action);
    const isAr = currentLang === 'ar';
    const isOrderAction = ['create_order','update_order','delete_order','cancel_order','complete_order'].includes(l.action);
    const oldSnap = parseOrderSnapshot(l.old_value);
    const newSnap = parseOrderSnapshot(l.new_value);
    const hasSnapshots = isOrderAction && (oldSnap || (newSnap && Object.keys(newSnap).length > 0));
    const changeSummary = isOrderAction ? renderAuditChangeSummary(oldSnap, newSnap, l.action) : '';
    const dateStr = parsePOSDate(l.created_at).toLocaleString(isAr ? 'ar-SA' : 'en-US', { dateStyle:'short', timeStyle:'short' });

    const descKeys = {
      delete_order:   'audit_desc_delete_order',
      update_order:   'audit_desc_update_order',
      cancel_order:   'audit_desc_cancel_order',
      complete_order: 'audit_desc_complete_order',
      create_order:   'audit_desc_create_order',
    };
    const actionDesc = descKeys[l.action] ? t(descKeys[l.action]) : escapeHtml(l.details || meta.label);
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
            <button class="audit-print-btn" onclick="printAuditInvoice(${l.entity_id})" title="${t('audit_print_title')}">
              🖨️ ${t('audit_print')}
            </button>
          ` : ''}
        </div>
      </div>
      ${changeSummary}
      ${hasSnapshots ? (() => {
        const isDelete = l.action === 'delete_order';
        if (isDelete) {
          return `<div class="audit-snapshots audit-snapshots-single">
            <div class="audit-snap-col" style="grid-column:1/-1;">
              <div class="audit-snap-title audit-snap-before">⬅️ ${t('audit_deleted_invoice')}</div>
              ${renderInvoiceCard(oldSnap, t('inv_before_delete'), 'audit-inv-old')}
            </div>
          </div>`;
        }
        return `<div class="audit-snapshots">
          <div class="audit-snap-col">
            <div class="audit-snap-title audit-snap-before">⬅️ ${t('audit_before')}</div>
            ${renderInvoiceCard(oldSnap, t('inv_old'), 'audit-inv-old')}
          </div>
          <div class="audit-snap-divider">⇄</div>
          <div class="audit-snap-col">
            <div class="audit-snap-title audit-snap-after">✅ ${t('audit_after')}</div>
            ${renderInvoiceCard(newSnap, t('inv_new'), 'audit-inv-new')}
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
    toast(t('audit_print_toast'), 'success');
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
    openModal(`${t('audit_view_invoice')}${order.invoice_number || order.id}`, `
      <div style="font-size:13px;line-height:1.6;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span><strong>${t('modal_cashier')}:</strong> ${escapeHtml(order.employee_name || '-')}</span>
          <span><strong>${t('modal_status')}:</strong> ${escapeHtml(order.status)}</span>
        </div>
        <div style="background:#fcfaf7;border:1px solid #eee;border-radius:8px;padding:10px;margin:10px 0;">${itemsHtml}</div>
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold;margin-top:10px;">
          <span>${t('modal_total')}:</span>
          <span style="color:var(--primary);">${order.total} ${curr}</span>
        </div>
      </div>
    `, async () => { generateReceipt(order); });
    const saveBtn = document.getElementById('modal-confirm-btn');
    if (saveBtn) saveBtn.textContent = `🖨️ ${t('audit_print_invoice_btn')}`;
  } catch (e) { toast(t('error') + ': ' + e.message, 'error'); }
}
