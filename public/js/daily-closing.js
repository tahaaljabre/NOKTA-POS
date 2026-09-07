// ===== Daily Closing & Shift Reporting =====

async function loadDailyClosing() {
  const dateInput = document.getElementById('closing-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = businessDate();
  }
  const date = dateInput?.value || businessDate();
  const empSel = document.getElementById('closing-employee-filter');
  
  // Populate employee dropdown if empty
  if (empSel && empSel.options.length <= 1) {
    try {
      const emps = await api('/api/employees');
      empSel.innerHTML = `<option value="">${currentLang === 'ar' ? 'كل الموظفين' : 'All Employees'}</option>` +
        emps.filter(e => e.active).map(e => `<option value="${e.id}">${escapeHtml(currentLang === 'ar' ? e.name : (e.name_en || e.name))}</option>`).join('');
    } catch(e) {}
  }

  const empId = empSel?.value || '';
  let url = `/api/daily-closings?date=${date}`;
  if (empId) url += `&employee_id=${empId}`;

  const closings = await api(url);
  const currency = getCurrency();

  // Live order stats for the selected date & employee
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

  const container = document.getElementById('closing-content');
  if (!container) return;

  container.innerHTML = `
    <div class="closing-stats">
      <div class="report-stat">
        <span>${currentLang === 'ar' ? 'الطلبات المكتملة' : 'Completed Orders'}</span>
        <span class="stat-value">${completedToday.length}</span>
      </div>
      <div class="report-stat">
        <span>${currentLang === 'ar' ? 'إجمالي المبيعات' : 'Total Revenue'}</span>
        <span class="stat-value">${totalRevenue.toFixed(2)} ${escapeHtml(currency)}</span>
      </div>
      <div class="report-stat">
        <span>💵 ${currentLang === 'ar' ? 'نقداً (كاش)' : 'Cash'}</span>
        <span class="stat-value">${(paymentTotals['cash'] || 0).toFixed(2)} ${escapeHtml(currency)}</span>
      </div>
      <div class="report-stat">
        <span>💳 ${currentLang === 'ar' ? 'طرق أخرى' : 'Other Payments'}</span>
        <span class="stat-value">${(totalRevenue - (paymentTotals['cash'] || 0)).toFixed(2)} ${escapeHtml(currency)}</span>
      </div>
    </div>
    
    ${closings.length > 0 ? `
      <h3 style="margin-top:18px; margin-bottom:10px; color:var(--primary); font-size:15px;">
        ${currentLang === 'ar' ? 'سجل الإغلاقات المسجلة' : 'Recorded Daily Closings'}
      </h3>
      <div class="invoices-table-wrapper">
        <table class="admin-table">
          <thead><tr>
            <th>${currentLang === 'ar' ? 'الموظف' : 'Employee'}</th>
            <th>${currentLang === 'ar' ? 'الطلبات' : 'Orders'}</th>
            <th>${currentLang === 'ar' ? 'الإجمالي' : 'Total'}</th>
            <th>💵 ${currentLang === 'ar' ? 'نقد' : 'Cash'}</th>
            <th>💳 ${currentLang === 'ar' ? 'أخرى' : 'Other'}</th>
            <th>${currentLang === 'ar' ? 'الحالة' : 'Status'}</th>
            <th>${currentLang === 'ar' ? 'إجراءات' : 'Actions'}</th>
          </tr></thead>
          <tbody>${closings.map(c => `
            <tr>
              <td><strong>${escapeHtml(c.employee_name)}</strong></td>
              <td>${c.total_orders}</td>
              <td><strong style="color:var(--gold-hover);">${(c.total_revenue || 0).toFixed(2)} ${escapeHtml(currency)}</strong></td>
              <td>${(c.cash_total || 0).toFixed(2)}</td>
              <td>${((c.total_revenue || 0) - (c.cash_total || 0)).toFixed(2)}</td>
              <td class="${c.is_closed ? 'status-active' : 'status-inactive'}">
                ${c.is_closed ? (currentLang === 'ar' ? '✓ مغلق' : '✓ Closed') : (currentLang === 'ar' ? 'مفتوح' : 'Open')}
              </td>
              <td>
                <div class="action-btns">
                  <button class="btn-edit" onclick="printDailyClosingReportFromRecord(${escapeHtml(JSON.stringify(c))}, 'thermal')" title="طباعة إيصال حراري">
                    🧾 ${currentLang === 'ar' ? 'حراري' : 'Thermal'}
                  </button>
                  <button class="btn" onclick="printDailyClosingReportFromRecord(${escapeHtml(JSON.stringify(c))}, 'pdf')" title="طباعة تقرير A4">
                    📄 ${currentLang === 'ar' ? 'A4' : 'PDF'}
                  </button>
                  ${!c.is_closed ? `<button class="btn-save" onclick="closeDay(${c.id})">${currentLang === 'ar' ? 'إغلاق' : 'Close'}</button>` : ''}
                </div>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    ` : `
      <div style="text-align:center; padding: 25px; color: var(--text-light); font-size:13px;">
        ${currentLang === 'ar' ? 'لا توجد إغلاقات مسجلة لهذا التاريخ بعد.' : 'No recorded closings for this date yet.'}
      </div>
    `}
  `;
}

async function closeDay(closingId) {
  if (!confirm(currentLang === 'ar' ? 'هل تريد تأكيد إغلاق اليوم؟' : 'Confirm closing the day?')) return;
  const empId = (currentUser && currentUser.id) ? currentUser.id : 1;
  const date = document.getElementById('closing-date')?.value || businessDate();
  const res = await api('/api/daily-closings/close', 'POST', { employee_id: empId, date });
  if (res.error) return toast(res.error, 'error');
  toast(currentLang === 'ar' ? 'تم الإغلاق اليومي بنجاح' : 'Day closed successfully', 'success');
  loadDailyClosing();
  printDailyClosingReport({
    date: date,
    employee_name: (currentUser && currentUser.name) ? currentUser.name : 'المدير',
    total_orders: res.total_orders,
    total_revenue: res.total_revenue,
    cash_total: res.cash_total,
    promptpay_total: res.promptpay_total,
    card_total: res.card_total,
    truemoney_total: res.truemoney_total,
    closed_at: new Date().toISOString()
  });
}

async function closeMyDay() {
  const date = document.getElementById('closing-date')?.value || businessDate();
  const empName = (currentUser && currentUser.name) ? currentUser.name : 'الكاشير';
  if (!confirm(currentLang === 'ar' ? `هل أنت متأكد من إغلاق اليوم لـ (${escapeHtml(empName)})؟` : `Close day for (${escapeHtml(empName)})?`)) return;
  
  const empId = (currentUser && currentUser.id) ? currentUser.id : 1;
  const result = await api('/api/daily-closings/close', 'POST', { employee_id: empId, date });
  if (result.error) return toast(result.error, 'error');

  toast(`${currentLang === 'ar' ? 'تم الإغلاق' : 'Closed'}: ${result.total_orders} ${currentLang === 'ar' ? 'طلبات' : 'orders'} - ${result.total_revenue?.toFixed(2)} ${getCurrency()}`, 'success');
  loadDailyClosing();

  printDailyClosingReport({
    date: date,
    employee_name: empName,
    total_orders: result.total_orders,
    total_revenue: result.total_revenue,
    cash_total: result.cash_total,
    promptpay_total: result.promptpay_total,
    card_total: result.card_total,
    truemoney_total: result.truemoney_total,
    closed_at: new Date().toISOString()
  });
}

function printDailyClosingReportFromRecord(closingRecord, format = 'thermal') {
  if (format === 'thermal') {
    printDailyClosingThermal(closingRecord);
  } else {
    printDailyClosingReport(closingRecord);
  }
}

async function closeGrandRestaurantDay() {
  const date = document.getElementById('closing-date')?.value || businessDate();
  const confirmMsg = currentLang === 'ar'
    ? `⚠️ تحذير: هل أنت متأكد من إجراء الإغلاق الكلي للمطعم لتاريخ (${date})؟\nسيتم إغلاق ومطابقة حسابات كافة الكاشيرات والنوادل لهذا اليوم.`
    : `Confirm Grand Daily Closing for all restaurant employees on (${date})?`;

  if (!confirm(confirmMsg)) return;

  try {
    const res = await api('/api/daily-closings/close', 'POST', {
      date: date,
      close_all: true,
      notes: 'إغلاق كلي للمطعم معتمد من الإدارة'
    });

    if (res.error) {
      toast(res.error, 'error');
      return;
    }

    toast(currentLang === 'ar' ? `✅ تم الإغلاق الكلي للمطعم بنجاح! الإجمالي: ${res.total_revenue?.toFixed(2)} ${getCurrency()} (${res.total_orders} فواتير)` : `Grand Closing completed!`, 'success');
    loadDailyClosing();

    // Print thermal & PDF summary
    printDailyClosingThermal({
      date: date,
      employee_name: currentLang === 'ar' ? 'الإغلاق الكلي (كل الموظفين)' : 'Grand Restaurant Total',
      total_orders: res.total_orders,
      total_revenue: res.total_revenue,
      cash_total: res.cash_total,
      promptpay_total: res.promptpay_total,
      card_total: res.card_total,
      truemoney_total: res.truemoney_total,
      closed_at: new Date().toISOString()
    });
  } catch(e) {
    toast(currentLang === 'ar' ? `خطأ: ${escapeHtml(e.message)}` : `Error: ${escapeHtml(e.message)}`, 'error');
  }
}

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

async function printDailyClosingReport(data = null) {
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
  const addr = s.restaurant_address || '';
  const phone = s.restaurant_phone || '';
  const taxNo = s.tax_number || '';

  const totalSales = reportData.total_revenue || 0;
  const cashPct = totalSales > 0 ? (((reportData.cash_total || 0) / totalSales) * 100).toFixed(1) : '0';
  const elecSales = totalSales - (reportData.cash_total || 0);
  const elecPct = totalSales > 0 ? ((elecSales / totalSales) * 100).toFixed(1) : '0';
  const avgOrder = reportData.total_orders > 0 ? (totalSales / reportData.total_orders).toFixed(2) : '0.00';

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
  <title>Daily Closing Report - ${reportData.date}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Readex Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif;
      font-size: 13px;
      color: #2b2b2b;
      background: #fff;
      line-height: 1.4;
      padding: 10px 14px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #721c24;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .brand-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      font-size: 38px;
      line-height: 1;
    }
    .brand-name {
      font-size: 22px;
      font-weight: 800;
      color: #721c24;
      letter-spacing: -0.5px;
    }
    .brand-info {
      font-size: 11px;
      color: #666;
      margin-top: 3px;
    }
    .report-meta {
      text-align: ${currentLang === 'ar' ? 'left' : 'right'};
    }
    .report-title {
      font-size: 17px;
      font-weight: 800;
      color: #721c24;
      background: #fdf5f5;
      padding: 4px 12px;
      border-radius: 6px;
      border: 1px solid #f3d4d6;
      display: inline-block;
      margin-bottom: 6px;
    }
    .meta-line {
      font-size: 11px;
      color: #555;
      margin-top: 2px;
    }
    
    /* KPI Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .kpi-card {
      background: #fcf9f5;
      border: 1.5px solid #ebd9c8;
      border-radius: 8px;
      padding: 10px 12px;
      text-align: center;
    }
    .kpi-card.highlight {
      background: #721c24;
      border-color: #531118;
      color: #fff;
    }
    .kpi-card.highlight .kpi-label { color: #f8d7da; }
    .kpi-card.highlight .kpi-value { color: #fff; }
    .kpi-label {
      font-size: 11px;
      font-weight: 600;
      color: #777;
      margin-bottom: 4px;
    }
    .kpi-value {
      font-size: 18px;
      font-weight: 800;
      color: #721c24;
    }
    .kpi-sub {
      font-size: 10px;
      color: #888;
      margin-top: 2px;
    }
    .kpi-card.highlight .kpi-sub { color: #eed5d7; }

    /* Tables */
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #721c24;
      margin: 14px 0 8px;
      padding-bottom: 4px;
      border-bottom: 1.5px solid #ebd9c8;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 12px;
    }
    table.data-table th {
      background: #f7f1ea;
      color: #531118;
      font-weight: 700;
      padding: 8px 10px;
      border: 1px solid #e2d5c5;
      text-align: ${currentLang === 'ar' ? 'right' : 'left'};
    }
    table.data-table td {
      padding: 8px 10px;
      border: 1px solid #ebd9c8;
      text-align: ${currentLang === 'ar' ? 'right' : 'left'};
    }
    table.data-table tr:nth-child(even) {
      background: #fdfbf9;
    }
    table.data-table tr.total-row {
      background: #f7ede2;
      font-weight: 800;
      font-size: 13px;
    }

    /* Cash Reconciliation */
    .drawer-box {
      background: #fdfaf6;
      border: 1.5px dashed #b38e2e;
      border-radius: 8px;
      padding: 12px 14px;
      margin: 12px 0 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .drawer-title { font-size: 13px; font-weight: 700; color: #721c24; }
    .drawer-amount { font-size: 20px; font-weight: 800; color: #197a56; }

    /* Signatures */
    .signatures-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 26px;
      padding-top: 12px;
      border-top: 1px solid #ddd;
    }
    .sig-box {
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 10px;
      text-align: center;
      background: #fafafa;
    }
    .sig-title {
      font-size: 11px;
      font-weight: 700;
      color: #555;
      margin-bottom: 28px;
    }
    .sig-line {
      border-top: 1px dotted #888;
      margin-top: 6px;
      padding-top: 4px;
      font-size: 10px;
      color: #888;
    }

    /* Footer */
    .report-footer {
      margin-top: 16px;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #888;
      border-top: 1px solid #eee;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <!-- Header Banner -->
  <div class="header-banner">
    <div class="brand-section">
      <div class="brand-logo">🍽️</div>
      <div>
        <div class="brand-name">${escapeHtml(restName)}</div>
        ${addr ? `<div class="brand-info">📍 ${escapeHtml(addr)}</div>` : ''}
        ${phone ? `<div class="brand-info">📞 ${escapeHtml(phone)}</div>` : ''}
        ${taxNo ? `<div class="brand-info">🏛️ ${currentLang === 'ar' ? 'الرقم الضريبي' : 'Tax / VAT ID'}: <strong>${escapeHtml(taxNo)}</strong></div>` : ''}
      </div>
    </div>
    <div class="report-meta">
      <div class="report-title">${t('closing_report_title')} (A4 / PDF)</div>
      <div class="meta-line">📅 ${currentLang === 'ar' ? 'تاريخ الإغلاق' : 'Closing Date'}: <strong>${reportData.date}</strong></div>
      <div class="meta-line">👤 ${currentLang === 'ar' ? 'المسؤول' : 'Cashier'}: <strong>${escapeHtml(reportData.employee_name || 'System')}</strong></div>
      <div class="meta-line">⏰ ${currentLang === 'ar' ? 'وقت الطباعة' : 'Printed at'}: ${new Date().toLocaleTimeString(currentLang === 'ar' ? 'ar-SA' : 'en-US')}</div>
    </div>
  </div>

  <!-- KPI Summary Cards -->
  <div class="kpi-grid">
    <div class="kpi-card highlight">
      <div class="kpi-label">${currentLang === 'ar' ? 'إجمالي المبيعات' : 'Total Revenue'}</div>
      <div class="kpi-value">${totalSales.toFixed(2)} ${escapeHtml(currency)}</div>
      <div class="kpi-sub">${currentLang === 'ar' ? 'المبلغ الكلي المحصل' : 'Total Net Sales'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">${currentLang === 'ar' ? 'الطلبات المكتملة' : 'Completed Orders'}</div>
      <div class="kpi-value">${reportData.total_orders || 0}</div>
      <div class="kpi-sub">${currentLang === 'ar' ? 'عدد الفواتير' : 'Invoices Count'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">${currentLang === 'ar' ? 'المبيعات النقدية (كاش)' : 'Cash Collected'}</div>
      <div class="kpi-value">${(reportData.cash_total || 0).toFixed(2)} ${escapeHtml(currency)}</div>
      <div class="kpi-sub">${cashPct}% ${currentLang === 'ar' ? 'من الإجمالي' : 'of Total'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">${currentLang === 'ar' ? 'المدفوعات الإلكترونية' : 'Digital Payments'}</div>
      <div class="kpi-value">${elecSales.toFixed(2)} ${escapeHtml(currency)}</div>
      <div class="kpi-sub">${elecPct}% ${currentLang === 'ar' ? 'بطاقات و QR' : 'Cards & QR'}</div>
    </div>
  </div>

  <!-- Detailed Payment Methods Table -->
  <div class="section-title">
    <span>${currentLang === 'ar' ? '📊 بيان تفصيلي للمدفوعات وحركة الصندوق' : '📊 Payment Methods Breakdown'}</span>
    <span style="font-size:11px; color:#777;">${currentLang === 'ar' ? 'مطابقة الحسابات' : 'Payment Reconciliation'}</span>
  </div>

  <table class="data-table">
    <thead>
      <tr>
        <th>${currentLang === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</th>
        <th>${currentLang === 'ar' ? 'النوع والتفصيل' : 'Type / Channel'}</th>
        <th>${currentLang === 'ar' ? 'النسبة من الإجمالي' : 'Share %'}</th>
        <th style="text-align:${currentLang === 'ar' ? 'left' : 'right'};">${currentLang === 'ar' ? 'المبلغ المحصل' : 'Collected Amount'}</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>💵 ${currentLang === 'ar' ? 'نقداً (كاش)' : 'Cash'}</strong></td>
        <td>${currentLang === 'ar' ? 'نقد بالدرج (فيزيكال)' : 'Physical Cash in Drawer'}</td>
        <td>${cashPct}%</td>
        <td style="text-align:${currentLang === 'ar' ? 'left' : 'right'}; font-weight:700;">${(reportData.cash_total || 0).toFixed(2)} ${escapeHtml(currency)}</td>
      </tr>
      <tr>
        <td><strong>💳 ${currentLang === 'ar' ? 'بطاقات ومدفوعات أخرى' : 'Other Payments'}</strong></td>
        <td>${currentLang === 'ar' ? 'مدفوعات إلكترونية أخرى' : 'Other Electronic Payments'}</td>
        <td>${elecPct}%</td>
        <td style="text-align:${currentLang === 'ar' ? 'left' : 'right'}; font-weight:700;">${elecSales.toFixed(2)} ${escapeHtml(currency)}</td>
      </tr>
      <tr class="total-row">
        <td colspan="3">${currentLang === 'ar' ? 'المجموع الكلي للإيرادات المحصلة' : 'GRAND TOTAL REVENUE'}</td>
        <td style="text-align:${currentLang === 'ar' ? 'left' : 'right'}; color:#721c24; font-size:14px;">${totalSales.toFixed(2)} ${escapeHtml(currency)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Cash in Drawer Box -->
  <div class="drawer-box">
    <div>
      <div class="drawer-title">💵 ${currentLang === 'ar' ? 'النقد الفعلي الواجب توفره بالصندوق (Cash In Drawer)' : 'Expected Cash in Drawer'}</div>
      <div style="font-size:11px; color:#666; margin-top:2px;">${currentLang === 'ar' ? 'يجب مطابقة هذا المبلغ مع النقد الفعلي قبل الإيداع' : 'Must match physical cash before deposit'}</div>
    </div>
    <div class="drawer-amount">${(reportData.cash_total || 0).toFixed(2)} ${escapeHtml(currency)}</div>
  </div>

  <!-- Formal Signatures -->
  <div class="signatures-grid">
    <div class="sig-box">
      <div class="sig-title">${currentLang === 'ar' ? 'إعداد الكاشير / المسؤول' : 'Prepared By (Cashier)'}</div>
      <div class="sig-line">${escapeHtml(reportData.employee_name || 'Cashier')}</div>
    </div>
    <div class="sig-box">
      <div class="sig-title">${currentLang === 'ar' ? 'مراجعة المشرف / التدقيق' : 'Verified By (Supervisor)'}</div>
      <div class="sig-line">${currentLang === 'ar' ? 'التوقيع والاعتماد' : 'Signature & Review'}</div>
    </div>
    <div class="sig-box">
      <div class="sig-title">${currentLang === 'ar' ? 'اعتماد الإدارة والمحاسبة' : 'Approved By (Manager/Accounting)'}</div>
      <div class="sig-line">${currentLang === 'ar' ? 'الختم والتوقيع' : 'Stamp & Signature'}</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="report-footer">
    <div>🍽️ ${escapeHtml(restName)} - POS Enterprise System</div>
    <div>${currentLang === 'ar' ? 'تم إنشاء التقرير آلياً بصيغة A4 / PDF' : 'Generated automatically in A4 / PDF format'}</div>
    <div>${reportData.date}</div>
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
      console.error('Print error:', err);
    }
    setTimeout(() => { document.body.removeChild(iframe); }, 4000);
  }, 400);
}

// ===== Open Shift & Opening Cash Management =====
async function checkShiftOnLogin() {
  if (!currentUser || currentUser.role === 'waiter') return; // Waiters don't carry cashier drawer
  const today = businessDate();

  // If already opened in this browser session today, don't prompt again
  if (localStorage.getItem(`shift_opened_${currentUser.id}_${today}`)) {
    return;
  }

  try {
    const shiftInfo = await api(`/api/daily-closings/current-shift?date=${today}`);
    if (shiftInfo && !shiftInfo.has_shift) {
      openShiftOpeningModal();
    } else if (shiftInfo && shiftInfo.has_shift) {
      // Record that shift is already active so prompt doesn't appear on subsequent logins today
      localStorage.setItem(`shift_opened_${currentUser.id}_${today}`, '1');
    }
  } catch(e) {
    console.warn('Check shift error:', e.message);
  }
}

function openShiftOpeningModal() {
  if (!currentUser) return;
  const currency = getCurrency();
  const today = businessDate();

  const modalTitle = currentLang === 'ar' ? `☀️ استلام الكاشير وفتح الوردية اليومية` : `☀️ Open Daily Shift & Cash Drawer`;
  const modalBody = `
    <div style="text-align:center;padding:10px 0;">
      <div style="font-size:42px;margin-bottom:10px;">🪙</div>
      <h3 style="color:var(--primary);margin-bottom:6px;font-size:17px;">
        ${currentLang === 'ar' ? `مرحباً بك يا ${escapeHtml(currentUser.name)}` : `Welcome ${escapeHtml(currentUser.name)}`}
      </h3>
      <p style="font-size:13px;color:var(--text-light);margin-bottom:18px;line-height:1.5;">
        ${currentLang === 'ar' ? 'لبدء اليوم واستلام الكاشير، يرجى إدخال مبلغ العُهدة النقدية (الفكة الافتتاحية) الموجودة بالدرج:' : 'Please enter the opening cash float in the drawer to start your shift:'}
      </p>

      <div style="background:#fdfdfd;border:2px dashed var(--gold);border-radius:12px;padding:16px;max-width:320px;margin:0 auto 16px;">
        <label style="font-size:12px;font-weight:700;color:#333;display:block;margin-bottom:8px;">
          ${currentLang === 'ar' ? 'مبلغ العُهدة الافتتاحية (فكة الصندوق):' : 'Opening Cash Float:'}
        </label>
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;">
          <input type="number" id="shift-opening-cash-input" value="0.00" min="0" step="1" 
                 style="font-size:24px;font-weight:800;text-align:center;width:150px;padding:8px;border-radius:8px;border:1.5px solid var(--border);color:var(--primary);"
                 onfocus="this.select()">
          <span style="font-size:16px;font-weight:700;color:var(--gold);">${escapeHtml(currency)}</span>
        </div>
      </div>

      <div style="margin-bottom:16px;max-width:320px;margin:0 auto 16px;">
        <input type="text" id="shift-opening-notes" placeholder="${currentLang === 'ar' ? 'ملاحظات الاستلام (اختياري)...' : 'Notes (optional)...'}" style="width:100%;padding:8px 12px;border-radius:6px;border:1px solid #ddd;font-size:12px;">
      </div>
    </div>
  `;

  openModal(
    modalTitle, 
    modalBody, 
    async () => {
      await submitShiftOpening();
    },
    currentLang === 'ar' ? '🚀 فتح الوردية واستلام الصندوق' : '🚀 Open Shift'
  );
}

async function submitShiftOpening() {
  const floatInput = document.getElementById('shift-opening-cash-input');
  const floatAmt = parseFloat(floatInput?.value) || 0;
  const notes = document.getElementById('shift-opening-notes')?.value || '';
  const today = businessDate();

  const res = await api('/api/daily-closings/open', 'POST', {
    opening_cash: floatAmt,
    notes: notes,
    date: today
  });

  if (res.error) {
    throw new Error(res.error);
  }

  // Cache locally that this employee has opened their shift today
  if (currentUser) {
    localStorage.setItem(`shift_opened_${currentUser.id}_${today}`, '1');
  }

  toast(currentLang === 'ar' ? `✅ تم فتح الوردية بنجاح! رصيد العُهدة الافتتاحي: ${floatAmt.toFixed(2)} ${getCurrency()}` : `✅ Shift opened with float: ${floatAmt.toFixed(2)}`, 'success');
}

// ===== Dedicated Employee Shift Closing Modal =====
async function openEmployeeClosingModal() {
  if (!currentUser) {
    toast(currentLang === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Please login first', 'error');
    return;
  }

  const today = businessDate();
  const currency = getCurrency();

  try {
    // Fetch current shift info (opening float)
    let openingCash = 0;
    try {
      const shiftInfo = await api(`/api/daily-closings/current-shift?date=${today}`);
      if (shiftInfo && shiftInfo.opening_cash) {
        openingCash = parseFloat(shiftInfo.opening_cash) || 0;
      }
    } catch(e) {}

    // Fetch live orders for current employee only
    const orders = await api(`/api/orders?date=${today}&employee_id=${currentUser.id}&not_deleted=0`);
    const completedOrders = (orders || []).filter(o => o.status === 'completed');

    let totalRevenue = 0, cashTotal = 0, promptpayTotal = 0, cardTotal = 0, truemoneyTotal = 0;
    completedOrders.forEach(o => {
      const tot = parseFloat(o.total) || 0;
      totalRevenue += tot;
      if (o.payment_method === 'cash') cashTotal += tot;
      else if (o.payment_method === 'promptpay') promptpayTotal += tot;
      else if (o.payment_method === 'card') cardTotal += tot;
      else if (o.payment_method === 'truemoney') truemoneyTotal += tot;
    });

    const totalDrawerExpected = cashTotal + openingCash;

    const modalTitle = currentLang === 'ar' ? `🔒 جرد الصندوق وإغلاق وردية (${escapeHtml(currentUser.name)})` : `🔒 Shift Audit & Close (${escapeHtml(currentUser.name)})`;

    // Prepare closing data object
    const shiftData = {
      date: today,
      employee_name: currentUser.name,
      total_orders: completedOrders.length,
      total_revenue: totalRevenue,
      opening_cash: openingCash,
      cash_total: cashTotal,
      promptpay_total: promptpayTotal,
      card_total: cardTotal,
      truemoney_total: truemoneyTotal,
      closed_at: new Date().toISOString()
    };
    const shiftDataJson = JSON.stringify(shiftData).replace(/"/g, '&quot;');

    const modalBody = `
      <div class="emp-closing-modal-content">
        <div class="emp-closing-header-badge" style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:15px;font-weight:700;color:var(--primary);">
              👤 ${escapeHtml(currentUser.name)} ${currentUser.role ? `(${currentUser.role === 'admin' ? 'مدير' : (currentUser.role === 'waiter' ? 'نادل' : 'كاشير')})` : ''}
            </div>
            <div style="font-size:12px;color:var(--text-light);margin-top:2px;">
              📅 ${today} - ${new Date().toLocaleTimeString(currentLang === 'ar' ? 'ar-SA' : 'en-US')}
            </div>
          </div>
          <div style="background:var(--gold-light);color:var(--gold-hover);font-weight:700;padding:4px 10px;border-radius:20px;font-size:12px;">
            ${currentLang === 'ar' ? 'جرد ومطابقة' : 'Reconciliation'}
          </div>
        </div>

        <div class="emp-closing-kpis">
          <div class="emp-kpi-item highlight">
            <div class="emp-kpi-lbl">${currentLang === 'ar' ? 'إجمالي مبيعاتك اليوم' : 'Your Total Sales'}</div>
            <div class="emp-kpi-val">${totalRevenue.toFixed(2)} ${escapeHtml(currency)}</div>
          </div>
          <div class="emp-kpi-item">
            <div class="emp-kpi-lbl">${currentLang === 'ar' ? 'عدد الفواتير المكتملة' : 'Completed Invoices'}</div>
            <div class="emp-kpi-val">${completedOrders.length}</div>
          </div>
        </div>

        <div class="emp-closing-breakdown">
          ${openingCash > 0 ? `
          <div class="emp-breakdown-row" style="background:#fafafa;padding:6px 8px;border-radius:6px;">
            <span>🪙 ${currentLang === 'ar' ? 'عُهدة الصندوق الافتتاحية (فكة):' : 'Opening Cash Float:'}</span>
            <strong style="color:var(--gold-hover);font-size:14px;">${openingCash.toFixed(2)} ${escapeHtml(currency)}</strong>
          </div>
          ` : ''}
          <div class="emp-breakdown-row">
            <span>💵 ${currentLang === 'ar' ? 'مبيعات الكاش اليومية المحصلة:' : 'Daily Cash Sales:'}</span>
            <strong style="color:#28a745;font-size:15px;">${cashTotal.toFixed(2)} ${escapeHtml(currency)}</strong>
          </div>
          <div class="emp-breakdown-row" style="border-top:1.5px solid var(--border);margin-top:4px;padding-top:8px;">
            <span style="font-weight:700;color:#721c24;">💰 ${currentLang === 'ar' ? 'إجمالي النقد المفترض بالدرج (عُهدة + كاش):' : 'Total Expected in Drawer:'}</span>
            <strong style="color:#721c24;font-size:17px;font-weight:800;">${totalDrawerExpected.toFixed(2)} ${escapeHtml(currency)}</strong>
          </div>
          <div class="emp-breakdown-row">
            <span>📱 ${currentLang === 'ar' ? 'مدفوعات البنك / QR PromptPay:' : 'PromptPay QR:'}</span>
            <strong style="font-size:14px;">${promptpayTotal.toFixed(2)} ${escapeHtml(currency)}</strong>
          </div>
          <div class="emp-breakdown-row">
            <span>💳 ${currentLang === 'ar' ? 'بطاقات وشبكة و TrueMoney:' : 'Cards & Wallets:'}</span>
            <strong style="font-size:14px;">${(cardTotal + truemoneyTotal).toFixed(2)} ${escapeHtml(currency)}</strong>
          </div>
        </div>

        <!-- STEP 1: Pre-print thermal slip for verification & drawer cross-check -->
        <div style="margin-top:16px;background:linear-gradient(135deg, #fff9e6, #fffdf8);border:1.5px solid #f6c23e;border-radius:10px;padding:12px 14px;box-shadow:0 2px 6px rgba(0,0,0,0.03);">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
            <div>
              <div style="font-size:13px;font-weight:800;color:#9e6a00;display:flex;align-items:center;gap:6px;">
                <span>1️⃣</span> ${currentLang === 'ar' ? 'الخطوة الأولى: طباعة كشف الجرد والشطب' : 'Step 1: Print Slip for Verification'}
              </div>
              <div style="font-size:11.5px;color:#555;margin-top:4px;line-height:1.4;">
                ${currentLang === 'ar' ? 'اطبع الفاتورة الحرارية أولاً لجرد النقد ومطابقة الفواتير والشطب عليها قبل تثبيت الإغلاق.' : 'Print the thermal slip first to count cash and cross-check invoices before closing.'}
              </div>
            </div>
            <button type="button" class="btn" style="background:#f6c23e;color:#5a3c00;font-weight:800;padding:10px 16px;border-radius:8px;font-size:13px;white-space:nowrap;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 2px 4px rgba(0,0,0,0.1);" onclick="printDailyClosingThermal(${shiftDataJson})">
              🖨️ ${currentLang === 'ar' ? 'طباعة كشف الجرد (حراري)' : 'Print Thermal Slip'}
            </button>
          </div>
        </div>

        <!-- STEP 2: Verify & Finalize -->
        <div style="margin-top:14px;background:#f8f9fc;border:1px solid #e3e6f0;border-radius:10px;padding:12px 14px;">
          <div style="font-size:13px;font-weight:800;color:var(--primary);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
            <span>2️⃣</span> ${currentLang === 'ar' ? 'الخطوة الثانية: التأكيد والإغلاق النهائي' : 'Step 2: Verify & Finalize Close'}
          </div>

          <label style="font-size:11.5px;font-weight:600;color:#444;">
            ${currentLang === 'ar' ? 'ملاحظات المطابقة أو العجز / الزيادة بعد الجرد (اختياري):' : 'Reconciliation Notes (Optional):'}
          </label>
          <input type="text" id="emp-closing-notes" placeholder="${currentLang === 'ar' ? 'مثال: تم الجرد والمطابقة بنجاح، النقد بالدرج مطابق تماماً...' : 'e.g. All counted and matched accurately...'}" style="width:100%;margin-top:4px;padding:8px 10px;border-radius:6px;border:1px solid #ccc;font-size:12px;">

          <div style="margin-top:12px;">
            <button type="button" class="btn btn-save" style="width:100%;padding:12px;font-size:14px;font-weight:800;border-radius:8px;display:flex;justify-content:center;align-items:center;gap:8px;" onclick="submitEmployeeShiftClosing(${totalRevenue}, ${completedOrders.length}, ${cashTotal}, ${promptpayTotal}, ${cardTotal}, ${truemoneyTotal}, ${openingCash})">
              🔒 ${currentLang === 'ar' ? 'تأكيد وإغلاق الوردية بعد المطابقة' : 'Confirm & Close Shift After Audit'}
            </button>
          </div>
        </div>
      </div>
    `;

    openModal(modalTitle, modalBody);
  } catch(err) {
    console.error('Error opening closing modal:', err);
    toast(currentLang === 'ar' ? `خطأ: ${escapeHtml(err.message)}` : `Error: ${escapeHtml(err.message)}`, 'error');
  }
}

async function submitEmployeeShiftClosing(totalRevenue, totalOrders, cashTotal, promptpayTotal, cardTotal, truemoneyTotal, openingCash = 0) {
  const notes = document.getElementById('emp-closing-notes')?.value || '';
  const date = businessDate();

  try {
    const res = await api('/api/daily-closings/close', 'POST', {
      employee_id: currentUser.id,
      date: date,
      notes: notes
    });

    if (res.error) {
      toast(res.error, 'error');
      return;
    }

    closeModal();
    toast(currentLang === 'ar' ? `✅ تم إغلاق ورديتك بنجاح! الإجمالي: ${totalRevenue.toFixed(2)} ${getCurrency()}` : `✅ Shift closed successfully!`, 'success');

    // Automatically print fast thermal receipt (80mm) for employee
    printDailyClosingThermal({
      date: date,
      employee_name: currentUser.name,
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      opening_cash: openingCash,
      cash_total: cashTotal,
      promptpay_total: promptpayTotal,
      card_total: cardTotal,
      truemoney_total: truemoneyTotal,
      closed_at: new Date().toISOString()
    });

    if (typeof loadDailyClosing === 'function') loadDailyClosing();
  } catch(e) {
    toast(currentLang === 'ar' ? `خطأ أثناء الإغلاق: ${escapeHtml(e.message)}` : `Closing error: ${escapeHtml(e.message)}`, 'error');
  }
}
