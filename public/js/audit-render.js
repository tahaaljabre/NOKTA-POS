// Audit rendering, invoice cards, change summaries, and audit admin list.
// Extracted from audit.js.

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
  if (!container.dataset.localPrintBound) {
    container.dataset.localPrintBound = '1';
    container.addEventListener('click', event => {
      const button = event.target.closest('[data-audit-print]');
      if (button) printAuditInvoice(button.closest('.audit-card'));
    });
  }

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
    const isMeaningfulOrderChange = isOrderAction && hasMeaningfulOrderChange(oldSnap, newSnap, l.action);
    const hasSnapshots = isMeaningfulOrderChange && (oldSnap || (newSnap && Object.keys(newSnap).length > 0));
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
            <button class="audit-print-btn" type="button" data-audit-print title="${t('audit_print_title')}">
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
      })() : (l.details && (!isOrderAction || !oldSnap || !newSnap) ? `<div class="audit-card-detail">${escapeHtml(l.details)}</div>` : '')}
      ${isOrderAction && !isMeaningfulOrderChange ? `<div class="audit-compact-note">✅ ${t('audit_routine_invoice')}</div>` : ''}
    </div>`;
  }).join('');
}

function buildAuditPrintDocument(cardHtml) {
  const title = escapeHtml(t('audit_print_report_title'));
  const brand = escapeHtml(getRestaurantName());
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map(link => `<link rel="stylesheet" href="${escapeHtml(link.href)}">`).join('');
  return `<!doctype html><html lang="${currentLang}" dir="${currentLang === 'ar' ? 'rtl' : 'ltr'}"><head>
    <meta charset="utf-8"><title>${title}</title>${links}<style>
    @page{size:A4 landscape;margin:12mm}
    body{background:#fff;color:#2b2025;font-family:Arial,Tahoma,sans-serif;margin:0}
    .audit-print-heading{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #681e32;padding-bottom:10px;margin-bottom:15px}
    .audit-print-heading h1{font-size:18px;margin:0;color:#681e32}
    .audit-card{box-shadow:none!important;break-inside:avoid}
    .audit-print-btn{display:none!important}
    .audit-inv-items{max-height:none!important;overflow:visible!important}
    .audit-snapshots{grid-template-columns:1fr 24px 1fr!important}
    .audit-snap-divider{display:flex!important}
    </style></head><body><header class="audit-print-heading"><h1>${title}</h1><strong>${brand}</strong></header>${cardHtml}</body></html>`;
}

function printAuditInvoice(card) {
  if (!card) return;
  const copy = card.cloneNode(true);
  copy.querySelectorAll('.audit-print-btn').forEach(button => button.remove());
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;border:0;pointer-events:none';
  document.body.appendChild(iframe);
  const printWindow = iframe.contentWindow;
  printWindow.document.open();
  printWindow.document.write(buildAuditPrintDocument(copy.outerHTML));
  printWindow.document.close();
  setTimeout(() => {
    try { printWindow.focus(); printWindow.print(); }
    catch (error) { toast(`${t('error')}: ${error.message}`, 'error'); }
    finally { setTimeout(() => iframe.remove(), 4000); }
  }, 500);
}
