function shopExpenseNumber(id) { return `EXP-${String(id).padStart(6, '0')}`; }

function shopExpensePrint(html) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;border:0;pointer-events:none';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    try { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
    finally { setTimeout(() => iframe.remove(), 4000); }
  }, 350);
}

function shopExpensePage(title, body) {
  const currency = escapeHtml(getCurrency());
  const restaurant = escapeHtml(currentLang === 'ar' ? (typeof appRestaurantName !== 'undefined' ? appRestaurantName : '') : (typeof appRestaurantNameEn !== 'undefined' ? appRestaurantNameEn : ''));
  return `<!doctype html><html lang="${currentLang}" dir="${currentLang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:A4;margin:15mm}body{font:13px Arial,Tahoma,sans-serif;color:#2e2026;margin:0}header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #751f36;padding-bottom:14px;margin-bottom:22px}h1{font-size:20px;color:#751f36;margin:0}small{color:#74666d}.brand{font-weight:800;font-size:17px}.meta{display:flex;justify-content:space-between;gap:16px;margin-bottom:18px;padding:12px;border:1px solid #eadce1;border-radius:9px;background:#fff8fa}.meta div{min-width:0}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{padding:9px 8px;border-bottom:1px solid #eadfe3;text-align:start}th{color:#681e32;background:#fff5f8}.total{font-weight:800;color:#681e32;background:#fff5f8}.notes{margin-top:18px;padding:12px;border:1px solid #eadce1;border-radius:8px}.sign{display:flex;gap:18px;margin-top:45px}.sign div{flex:1;border-top:1px dotted #9a8e92;padding-top:8px;text-align:center}footer{margin-top:30px;border-top:1px solid #eee;padding-top:10px;color:#83767c;font-size:10px}
    </style></head><body><header><div><h1>${escapeHtml(title)}</h1><small>${restaurant}</small></div><div class="brand">${restaurant}</div></header>${body}<footer>${t('expenses_system_currency')}: ${currency}</footer></body></html>`;
}

function printShopExpenseReceipt(row) {
  const currency = escapeHtml(getCurrency());
  const body = `<div class="meta"><div>${t('expenses_receipt_no')}: <strong>${shopExpenseNumber(row.id)}</strong></div><div>${t('expenses_date')}: <strong>${escapeHtml(row.expense_date)}</strong></div></div>
    <table><tbody>
    <tr><th>${t('expenses_title')}</th><td>${escapeHtml(row.title)}</td></tr>
    <tr><th>${t('expenses_category')}</th><td>${t(`expenses_category_${row.category}`)}</td></tr>
    <tr><th>${t('expenses_cashier_short')}</th><td>${escapeHtml(row.cashier_name)} (${escapeHtml(row.cashier_code)})</td></tr>
    <tr><th>${t('expenses_payment')}</th><td>${t(`expenses_payment_${row.payment_method}`)}</td></tr>
    <tr><th>${t('expenses_payee')}</th><td>${escapeHtml(row.payee || '-')}</td></tr>
    <tr><th>${t('expenses_reference')}</th><td>${escapeHtml(row.reference_number || '-')}</td></tr>
    <tr class="total"><th>${t('expenses_amount')}</th><td>${Number(row.amount).toFixed(2)} ${currency}</td></tr></tbody></table>
    ${row.notes ? `<div class="notes">${t('notes')}: ${escapeHtml(row.notes)}</div>` : ''}
    <div class="sign"><div>${t('expenses_paid_by')}</div><div>${t('expenses_received_by')}</div></div>`;
  shopExpensePrint(shopExpensePage(t('expenses_receipt_title'), body));
}

function printShopExpensesReportPage(result) {
  const currency = escapeHtml(getCurrency());
  const rows = result.items.map(row => `<tr><td>${shopExpenseNumber(row.id)}</td><td>${escapeHtml(row.expense_date)}</td><td>${escapeHtml(row.title)}</td><td>${t(`expenses_category_${row.category}`)}</td><td>${escapeHtml(row.cashier_name)}</td><td>${t(`expenses_payment_${row.payment_method}`)}</td><td>${escapeHtml(row.payee || '')}</td><td>${Number(row.amount).toFixed(2)} ${currency}</td></tr>`).join('');
  const body = `<div class="meta"><div>${t('expenses_from')}: <strong>${escapeHtml(result.from)}</strong></div><div>${t('expenses_to')}: <strong>${escapeHtml(result.to)}</strong></div><div>${t('invoices_label')}: <strong>${result.count}</strong></div></div>
    <table><thead><tr><th>${t('expenses_receipt_no')}</th><th>${t('expenses_date')}</th><th>${t('expenses_title')}</th><th>${t('expenses_category')}</th><th>${t('expenses_cashier_short')}</th><th>${t('expenses_payment')}</th><th>${t('expenses_payee')}</th><th>${t('expenses_amount')}</th></tr></thead><tbody>${rows}<tr class="total"><td colspan="7">${t('expenses_total')}</td><td>${Number(result.total).toFixed(2)} ${currency}</td></tr></tbody></table>`;
  shopExpensePrint(shopExpensePage(t('expenses_report_title'), body));
}
