// Full closing report printing for A4 and PDF output.
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
