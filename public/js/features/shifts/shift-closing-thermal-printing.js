// Thermal receipt printing for shift and business-day closings.
// ===== Instant Thermal Receipt Print (80mm / 58mm) for Shift Closing =====
async function printDailyClosingThermal(data = null) {
  let reportData = data;
  const date = data?.date || document.getElementById('closing-date')?.value || businessDate();
  const empSel = document.getElementById('closing-employee-filter');
  const empId = data?.employee_id || empSel?.value || '';
  const empText = empSel && empSel.selectedIndex > 0 ? empSel.options[empSel.selectedIndex].text : (currentLang === 'ar' ? 'كل الموظفين' : 'All Employees');

  const daily = await api(`/api/reports/daily?date=${encodeURIComponent(date)}${empId ? `&employee_id=${encodeURIComponent(empId)}` : ''}`);
  const paymentAmount = method => Number((daily.by_payment || []).find(p => p.payment_method === method)?.total || 0);
  reportData = { ...reportData, ...daily, date, employee_name: data?.employee_name || empText,
    cash_total: paymentAmount('cash'), card_total: paymentAmount('card'), promptpay_total: paymentAmount('promptpay'),
    truemoney_total: paymentAmount('truemoney'), platform_total: Number(daily.platform_receivable || 0) };

  let s = {};
  try { s = await api('/api/settings'); } catch(e) {}
  const currency = getCurrency();
  const restName = currentLang === 'ar' ? (s.restaurant_name || appRestaurantName || 'اسم المنشأة') : (s.restaurant_name_en || appRestaurantNameEn || s.restaurant_name || 'Your Business');
  const phone = s.restaurant_phone || '';
  const taxNo = s.tax_number || '';

  const totalSales = reportData.total_revenue || 0;
  const cashPct = totalSales > 0 ? (((reportData.cash_total || 0) / totalSales) * 100).toFixed(1) : '0';
  const networkMethods = (daily.by_payment || []).filter(p => p.payment_method !== 'cash' && p.payment_method !== 'platform');
  const networkSales = networkMethods.reduce((sum, p) => sum + Number(p.total || 0), 0);
  const appTotals = daily.by_delivery_app || [];

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.opacity = '0';
  iframe.style.border = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;

  const html = `<!DOCTYPE html>
<html lang="${currentLang}" dir="${currentLang === 'ar' ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <title>Shift Closing Receipt</title>
  <style>
    @page {
      margin: 0;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace, sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: #000;
      background: #fff;
      width: 100%;
      max-width: 80mm;
      padding: 6px 8px;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
    }
    .text-center { text-align: center; }
    .text-right { text-align: ${currentLang === 'ar' ? 'left' : 'right'}; }
    .d-flex { display: flex; justify-content: space-between; align-items: center; margin: 4px 0; }
    .title-header { font-size: 16px; font-weight: 800; margin-bottom: 2px; }
    .sub-title { font-size: 12px; margin-bottom: 6px; }
    .divider { border-top: 1.5px dashed #000; margin: 6px 0; }
    .double-divider { border-top: 2.5px double #000; margin: 8px 0; }
    .total-box { font-size: 16px; font-weight: 800; padding: 4px 0; }
    .highlight-cash { font-size: 15px; font-weight: 800; }
    .signature-area { margin-top: 16px; padding-top: 10px; border-top: 1px dotted #000; text-align: center; font-size: 11px; }
  </style>
</head>
<body>
  <div class="text-center">
    <div class="title-header">🍽️ ${escapeHtml(restName)}</div>
    <div class="sub-title">*** ${currentLang === 'ar' ? 'إغلاق الوردية / كشف الحساب' : 'SHIFT CLOSING REPORT'} ***</div>
    ${phone ? `<div>📞 ${escapeHtml(phone)}</div>` : ''}
    ${taxNo ? `<div>🏛️ الرقم الضريبي: ${escapeHtml(taxNo)}</div>` : ''}
  </div>

  <div class="divider"></div>

  <div class="d-flex">
    <span>${currentLang === 'ar' ? 'الموظف / الكاشير:' : 'Employee:'}</span>
    <strong>${escapeHtml(reportData.employee_name || 'System')}</strong>
  </div>
  <div class="d-flex">
    <span>${currentLang === 'ar' ? 'التاريخ:' : 'Date:'}</span>
    <span>${reportData.date}</span>
  </div>
  <div class="d-flex">
    <span>${currentLang === 'ar' ? 'الوقت:' : 'Time:'}</span>
    <span>${new Date().toLocaleTimeString(currentLang === 'ar' ? 'ar-SA' : 'en-US')}</span>
  </div>

  <div class="double-divider"></div>

  <div class="d-flex">
    <span>${currentLang === 'ar' ? 'عدد الفواتير المكتملة:' : 'Invoices Count:'}</span>
    <strong>${reportData.total_orders || 0}</strong>
  </div>

  <div class="d-flex total-box">
    <span>${currentLang === 'ar' ? 'إجمالي المبيعات:' : 'TOTAL REVENUE:'}</span>
    <span>${totalSales.toFixed(2)} ${escapeHtml(currency)}</span>
  </div>

  <div class="divider"></div>

  <div style="font-weight:700;margin-bottom:4px;">${currentLang === 'ar' ? 'تفصيل طرق الدفع ومطابقة الصندوق:' : 'PAYMENT & RECONCILIATION:'}</div>

  ${(reportData.opening_cash > 0) ? `
  <div class="d-flex" style="font-size:12px;color:#333;">
    <span>🪙 ${currentLang === 'ar' ? 'عُهدة الصندوق (رصيد الافتتاح):' : 'Opening Cash Float:'}</span>
    <strong>${(reportData.opening_cash || 0).toFixed(2)} ${escapeHtml(currency)}</strong>
  </div>
  <div class="d-flex" style="font-size:12px;color:#333;">
    <span>💵 ${currentLang === 'ar' ? '+ مبيعات الكاش اليومية:' : '+ Daily Cash Sales:'}</span>
    <span>${(reportData.cash_total || 0).toFixed(2)} ${escapeHtml(currency)}</span>
  </div>
  <div class="divider" style="border-top:1px dotted #888;"></div>
  ` : ''}

  <div class="d-flex highlight-cash">
    <span>💵 ${t('expected_cash_drawer')}:</span>
    <span>${Number(reportData.expected_cash || 0).toFixed(2)} ${escapeHtml(currency)}</span>
  </div>
  <div class="d-flex"><span>${t('expenses_total')} (${t('cash')})</span><span>${Number(reportData.cash_expenses || 0).toFixed(2)} ${escapeHtml(currency)}</span></div>
  <div class="d-flex"><span>${t('cash_discounts')}</span><span>${Number(reportData.cash_discount || 0).toFixed(2)} ${escapeHtml(currency)}</span></div>
  <div class="d-flex" style="font-size:11.5px;">
    <span>✍️ ${t('counted_cash')}:</span>
    <span>${reportData.counted_cash == null ? '[ ____________ ]' : `${Number(reportData.counted_cash).toFixed(2)} ${escapeHtml(currency)}`}</span>
  </div>
  <div class="d-flex" style="font-size:11px;color:#555;">
    <span>⚖️ ${t('cash_difference')}:</span>
    <span>${reportData.cash_count_complete ? `${Number(reportData.cash_difference || 0).toFixed(2)} ${escapeHtml(currency)}` : '[ ____________ ]'}</span>
  </div>

  <div class="divider"></div>

  <div style="font-weight:700;margin-bottom:4px;font-size:12px;">💳 ${currentLang === 'ar' ? 'تفصيل المدفوعات الأخرى:' : 'Other Payments Breakdown:'}</div>
  ${networkMethods.map(p => `<div class="d-flex"><span>${escapeHtml((typeof paymentMethodsList !== 'undefined' ? paymentMethodsList : []).find(m => m.id === p.payment_method)?.name || p.payment_method)}</span><span>${Number(p.total || 0).toFixed(2)} ${escapeHtml(currency)}</span></div>`).join('')}
  <div class="d-flex" style="font-size:13px; font-weight:800; border-top:1px solid #000; margin-top:4px; padding-top:4px;">
    <span>${currentLang === 'ar' ? 'إجمالي المدفوعات الإلكترونية:' : 'Total Electronic Payments:'}</span>
    <strong>${networkSales.toFixed(2)} ${escapeHtml(currency)}</strong>
  </div>
  <div class="divider"></div>
  <div class="d-flex"><span>${t('platform_receivable')}:</span><strong>${(reportData.platform_total || 0).toFixed(2)} ${escapeHtml(currency)}</strong></div>
  ${appTotals.map(app => `<div class="d-flex"><span>${escapeHtml(app.app_name || deliveryAppName(app.app_id))}</span><span>${Number(app.total || 0).toFixed(2)} ${escapeHtml(currency)}</span></div>`).join('')}
  <div class="d-flex"><strong>${t('delivery_apps_total')}</strong><strong>${appTotals.reduce((sum, app) => sum + Number(app.total || 0), 0).toFixed(2)} ${escapeHtml(currency)}</strong></div>
  <div class="divider"></div>
  ${(reportData.supplier_expenses || []).map(row => `<div class="d-flex"><span>${escapeHtml(row.supplier_name)}</span><span>${Number(row.amount || 0).toFixed(2)} ${escapeHtml(currency)}</span></div>`).join('')}
  <div class="d-flex"><strong>${t('supplier_expenses_total')}</strong><strong>${Number(reportData.supplier_expenses_total || 0).toFixed(2)} ${escapeHtml(currency)}</strong></div>
  ${(reportData.shop_expenses || []).map(row => `<div class="d-flex"><span>${escapeHtml(row.title)} · ${escapeHtml(row.cashier_name)}</span><span>${Number(row.amount || 0).toFixed(2)} ${escapeHtml(currency)}</span></div>`).join('')}
  <div class="d-flex"><strong>${t('expenses_total')}</strong><strong>${Number(reportData.expenses_total || 0).toFixed(2)} ${escapeHtml(currency)}</strong></div>
  <div class="d-flex"><strong>${t('net_after_expenses')}</strong><strong>${Number(reportData.net_after_expenses || 0).toFixed(2)} ${escapeHtml(currency)}</strong></div>
  ${(reportData.closing_notes || []).map(row => `<div>${escapeHtml(row.employee_name || '')}: ${escapeHtml(row.note || '')}</div>`).join('')}

  <div class="double-divider"></div>

  <div class="signature-area">
    <div style="display:flex;justify-content:space-between;text-align:center;">
      <div style="flex:1; padding: 0 4px;">
        <div>${currentLang === 'ar' ? 'توقيع الكاشير:' : 'Cashier Sign:'}</div>
        <div style="margin-top:18px;">..................</div>
      </div>
      <div style="flex:1; padding: 0 4px;">
        <div>${currentLang === 'ar' ? 'استلام المشرف:' : 'Manager Sign:'}</div>
        <div style="margin-top:18px;">..................</div>
      </div>
    </div>
  </div>

  <div style="text-align:center;font-size:10px;margin-top:10px;color:#666;">
    *** ${currentLang === 'ar' ? 'كشف مطابقة وجرد الصندوق - POS' : 'Drawer Audit Slip - POS'} ***
  </div>
</body>
</html>`;

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch(err) {
      console.error('Print thermal closing error:', err);
    }
    setTimeout(() => { document.body.removeChild(iframe); }, 4000);
  }, 350);
}
