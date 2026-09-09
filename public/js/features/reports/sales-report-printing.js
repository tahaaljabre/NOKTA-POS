// Printable A4 sales report generation.
async function printSalesReport() {
  const fromInput = document.getElementById('sales-from');
  const toInput = document.getElementById('sales-to');
  const today = businessDate();

  const from = fromInput?.value || today;
  const to = toInput?.value || from;
  const empSel = document.getElementById('sales-employee-filter');
  const empId = empSel?.value || '';
  const empText = empSel && empSel.selectedIndex > 0 ? empSel.options[empSel.selectedIndex].text : (currentLang === 'ar' ? 'كل الموظفين' : 'All Employees');

  let url = `/api/reports/sales?from=${from}&to=${to}`;
  if (empId) url += `&employee_id=${empId}`;

  const report = await api(url);
  const currency = getCurrency();

  let s = {};
  try { s = await api('/api/settings'); } catch(e) {}
  const restName = currentLang === 'ar' ? (s.restaurant_name || appRestaurantName || 'اسم المنشأة') : (s.restaurant_name_en || appRestaurantNameEn || s.restaurant_name || 'Your Business');
  const addr = s.restaurant_address || '';
  const phone = s.restaurant_phone || '';
  const taxNo = s.tax_number || '';

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;

  const totalSales = report.totals?.total_revenue || 0;
  const totalOrders = report.totals?.total_orders || 0;
  const avgTicket = totalOrders > 0 ? (totalSales / totalOrders).toFixed(2) : '0.00';

  const html = `<!DOCTYPE html>
<html lang="${currentLang}" dir="${currentLang === 'ar' ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <title>Sales & Analytics Report - ${from} to ${to}</title>
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
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    .kpi-card {
      background: #fcf9f5;
      border: 1.5px solid #ebd9c8;
      border-radius: 8px;
      padding: 12px;
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
      font-size: 20px;
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
      margin: 16px 0 8px;
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

    /* Signatures */
    .signatures-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
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
      <div class="brand-logo">📊</div>
      <div>
        <div class="brand-name">${escapeHtml(restName)}</div>
        ${addr ? `<div class="brand-info">📍 ${escapeHtml(addr)}</div>` : ''}
        ${phone ? `<div class="brand-info">📞 ${escapeHtml(phone)}</div>` : ''}
        ${taxNo ? `<div class="brand-info">🏛️ ${currentLang === 'ar' ? 'الرقم الضريبي' : 'Tax / VAT ID'}: <strong>${escapeHtml(taxNo)}</strong></div>` : ''}
      </div>
    </div>
    <div class="report-meta">
      <div class="report-title">${t('sales_report_title')} (A4 / PDF)</div>
      <div class="meta-line">📅 ${t('period')}: <strong>${from} ${from !== to ? `➔ ${to}` : ''}</strong></div>
      <div class="meta-line">👤 ${currentLang === 'ar' ? 'الموظف المستهدف' : 'Employee'}: <strong>${empText}</strong></div>
      <div class="meta-line">⏰ ${currentLang === 'ar' ? 'تاريخ التوليد' : 'Generated'}: ${new Date().toLocaleDateString(currentLang === 'ar' ? 'ar-SA' : 'en-US')} ${new Date().toLocaleTimeString(currentLang === 'ar' ? 'ar-SA' : 'en-US')}</div>
    </div>
  </div>

  <!-- KPI Summary Cards -->
  <div class="kpi-grid">
    <div class="kpi-card highlight">
      <div class="kpi-label">${currentLang === 'ar' ? 'إجمالي الإيرادات الكلية' : 'Total Revenue'}</div>
      <div class="kpi-value">${totalSales.toFixed(2)} ${escapeHtml(currency)}</div>
      <div class="kpi-sub">${currentLang === 'ar' ? 'صافي المبيعات المحققة' : 'Net Sales'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">${currentLang === 'ar' ? 'عدد الطلبات المكتملة' : 'Completed Orders'}</div>
      <div class="kpi-value">${totalOrders}</div>
      <div class="kpi-sub">${currentLang === 'ar' ? 'إجمالي الفواتير' : 'Invoices Count'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">${currentLang === 'ar' ? 'متوسط قيمة الفاتورة' : 'Average Order Ticket'}</div>
      <div class="kpi-value">${avgTicket} ${escapeHtml(currency)}</div>
      <div class="kpi-sub">${currentLang === 'ar' ? 'معدل الإنفاق لكل طلب' : 'Avg Spend per Order'}</div>
    </div>
  </div>

  <!-- Payment Methods Breakdown Table -->
  ${report.by_payment && report.by_payment.length > 0 ? `
    <div class="section-title">
      <span>💳 ${currentLang === 'ar' ? 'المبيعات حسب طرق الدفع والقنوات' : 'Sales by Payment Method'}</span>
      <span style="font-size:11px; color:#777;">${currentLang === 'ar' ? 'قنوات التحصيل' : 'Payment Channels'}</span>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th>${currentLang === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</th>
          <th>${currentLang === 'ar' ? 'عدد العمليات' : 'Transactions'}</th>
          <th>${currentLang === 'ar' ? 'النسبة المئوية' : 'Share %'}</th>
          <th style="text-align:${currentLang === 'ar' ? 'left' : 'right'};">${currentLang === 'ar' ? 'الإجمالي المحصل' : 'Total Amount'}</th>
        </tr>
      </thead>
      <tbody>
        ${report.by_payment.map(p => {
          const names = { cash: '💵 نقداً (كاش)', promptpay: '📱 PromptPay QR', truemoney: '💳 TrueMoney Wallet', card: '💳 بطاقات بنكية (Cards)' };
          const share = totalSales > 0 ? (((p.total || 0) / totalSales) * 100).toFixed(1) : '0';
          return `
            <tr>
              <td><strong>${escapeHtml(names[p.payment_method] || p.payment_method)}</strong></td>
              <td>${p.count}</td>
              <td>${share}%</td>
              <td style="text-align:${currentLang === 'ar' ? 'left' : 'right'}; font-weight:700;">${(p.total || 0).toFixed(2)} ${escapeHtml(currency)}</td>
            </tr>
          `;
        }).join('')}
        <tr class="total-row">
          <td>${currentLang === 'ar' ? 'المجموع' : 'Total'}</td>
          <td>${totalOrders}</td>
          <td>100%</td>
          <td style="text-align:${currentLang === 'ar' ? 'left' : 'right'}; color:#721c24;">${totalSales.toFixed(2)} ${escapeHtml(currency)}</td>
        </tr>
      </tbody>
    </table>
  ` : ''}

  <!-- Employee Performance Table -->
  ${report.by_employee && report.by_employee.length > 0 ? `
    <div class="section-title">
      <span>👥 ${currentLang === 'ar' ? 'أداء ومبيعات الموظفين' : 'Sales by Employee Performance'}</span>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th>${currentLang === 'ar' ? 'اسم الموظف' : 'Employee Name'}</th>
          <th>${currentLang === 'ar' ? 'الطلبات المنجزة' : 'Orders Handled'}</th>
          <th>${currentLang === 'ar' ? 'المساهمة بالمبيعات' : 'Contribution %'}</th>
          <th style="text-align:${currentLang === 'ar' ? 'left' : 'right'};">${currentLang === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}</th>
        </tr>
      </thead>
      <tbody>
        ${report.by_employee.map(e => {
          const contrib = totalSales > 0 ? (((e.total || 0) / totalSales) * 100).toFixed(1) : '0';
          return `
            <tr>
              <td><strong>${escapeHtml(e.employee_name || 'System')}</strong></td>
              <td>${e.count}</td>
              <td>${contrib}%</td>
              <td style="text-align:${currentLang === 'ar' ? 'left' : 'right'}; font-weight:700;">${(e.total || 0).toFixed(2)} ${escapeHtml(currency)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  ` : ''}

  <!-- Daily Timeline Breakdown Table -->
  ${report.daily && report.daily.length > 1 ? `
    <div class="section-title">
      <span>📅 ${currentLang === 'ar' ? 'التوزيع الزمني للمبيعات اليومية' : 'Daily Sales Timeline'}</span>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th>${currentLang === 'ar' ? 'اليوم والتاريخ' : 'Date'}</th>
          <th>${currentLang === 'ar' ? 'عدد الطلبات' : 'Orders'}</th>
          <th style="text-align:${currentLang === 'ar' ? 'left' : 'right'};">${currentLang === 'ar' ? 'الإيراد اليومي' : 'Daily Revenue'}</th>
        </tr>
      </thead>
      <tbody>
        ${report.daily.map(d => `
          <tr>
            <td><strong>${d.day}</strong></td>
            <td>${d.orders}</td>
            <td style="text-align:${currentLang === 'ar' ? 'left' : 'right'}; font-weight:700;">${(d.revenue || 0).toFixed(2)} ${escapeHtml(currency)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}

  <!-- Formal Signatures -->
  <div class="signatures-grid">
    <div class="sig-box">
      <div class="sig-title">${currentLang === 'ar' ? 'المسؤول عن استخراج التقرير' : 'Report Generated By'}</div>
      <div class="sig-line">${escapeHtml((currentUser && currentUser.name) ? currentUser.name : 'Branch Staff')}</div>
    </div>
    <div class="sig-box">
      <div class="sig-title">${currentLang === 'ar' ? 'اعتماد مدير الفرع / الحسابات' : 'Branch Manager / Accounting Approval'}</div>
      <div class="sig-line">${currentLang === 'ar' ? 'الختم والتوقيع الرسمي' : 'Official Stamp & Signature'}</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="report-footer">
    <div>🍽️ ${escapeHtml(restName)} - POS Enterprise System</div>
    <div>${currentLang === 'ar' ? 'تم إنشاء التقرير آلياً بصيغة A4 / PDF' : 'Generated automatically in A4 / PDF format'}</div>
    <div>${from} ${from !== to ? `➔ ${to}` : ''}</div>
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
