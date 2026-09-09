// Thermal receipt printing for shift and business-day closings.
// ===== Instant Thermal Receipt Print (80mm / 58mm) for Shift Closing =====
async function printDailyClosingThermal(data = null) {
  let reportData = data;
  const date = document.getElementById('closing-date')?.value || businessDate();
  const empSel = document.getElementById('closing-employee-filter');
  const empId = empSel?.value || '';
  const empText = empSel && empSel.selectedIndex > 0 ? empSel.options[empSel.selectedIndex].text : (currentLang === 'ar' ? 'كل الموظفين' : 'All Employees');

  if (!reportData) {
    let orderUrl = `/api/orders?date=${date}&not_deleted=0`;
    if (empId) orderUrl += `&employee_id=${empId}`;
    const todayOrders = await api(orderUrl);
    const completedToday = (todayOrders || []).filter(o => o.status === 'completed');

    let totalRevenue = 0;
    let paymentTotals = {};
    completedToday.forEach(o => {
      const tot = parseFloat(o.total) || 0;
      totalRevenue += tot;
      const pm = o.payment_method || 'cash';
      paymentTotals[pm] = (paymentTotals[pm] || 0) + tot;
    });
    
    const cashTotal = paymentTotals['cash'] || 0;

    reportData = {
      date: date,
      employee_name: empText,
      total_orders: completedToday.length,
      total_revenue: totalRevenue,
      cash_total: cashTotal,
      promptpay_total: promptpayTotal,
      card_total: cardTotal,
      truemoney_total: truemoneyTotal,
      closed_at: new Date().toISOString()
    };
  }

  let s = {};
  try { s = await api('/api/settings'); } catch(e) {}
  const currency = getCurrency();
  const restName = currentLang === 'ar' ? (s.restaurant_name || appRestaurantName || 'اسم المنشأة') : (s.restaurant_name_en || appRestaurantNameEn || s.restaurant_name || 'Your Business');
  const phone = s.restaurant_phone || '';
  const taxNo = s.tax_number || '';

  const totalSales = reportData.total_revenue || 0;
  const cashPct = totalSales > 0 ? (((reportData.cash_total || 0) / totalSales) * 100).toFixed(1) : '0';

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;

  const html = `<!DOCTYPE html>
<html lang="${currentLang}" dir="${currentLang === 'ar' ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <title>Shift Closing Receipt</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace, sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: #000;
      background: #fff;
      width: 78mm;
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
    <span>💵 ${currentLang === 'ar' ? 'إجمالي النقد المفترض بالدرج:' : 'Total Expected in Drawer:'}</span>
    <span>${((reportData.cash_total || 0) + (reportData.opening_cash || 0)).toFixed(2)} ${escapeHtml(currency)}</span>
  </div>
  <div class="d-flex" style="font-size:11.5px;">
    <span>✍️ ${currentLang === 'ar' ? 'النقد الفعلي بعد العد:' : 'Actual Counted:'}</span>
    <span>[ ____________ ]</span>
  </div>
  <div class="d-flex" style="font-size:11px;color:#555;">
    <span>⚖️ ${currentLang === 'ar' ? 'الفارق (عجز / زيادة):' : 'Difference:'}</span>
    <span>[ ____________ ]</span>
  </div>

  <div class="divider"></div>

  <div class="d-flex">
    <span>💳 ${currentLang === 'ar' ? 'بطاقات وأخرى:' : 'Other Payments:'}</span>
    <strong>${(totalSales - (reportData.cash_total || 0)).toFixed(2)} ${escapeHtml(currency)}</strong>
  </div>

  <div class="double-divider"></div>

  <div class="signature-area">
    <div style="display:flex;justify-content:space-between;text-align:center;">
      <div style="flex:1;">
        <div>${currentLang === 'ar' ? 'توقيع الكاشير (الجرد):' : 'Cashier Sign:'}</div>
        <div style="margin-top:18px;">.....................</div>
      </div>
      <div style="flex:1;">
        <div>${currentLang === 'ar' ? 'استلام المشرف / الإدارة:' : 'Manager Sign:'}</div>
        <div style="margin-top:18px;">.....................</div>
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
