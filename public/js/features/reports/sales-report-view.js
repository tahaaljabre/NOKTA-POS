// Sales report filters, loading, and on-screen rendering.
// ===== Sales Reports & Period Printing =====

async function loadSalesReport() {
  const fromInput = document.getElementById('sales-from');
  const toInput = document.getElementById('sales-to');
  const today = businessDate();

  if (fromInput && !fromInput.value) fromInput.value = today;
  if (toInput && !toInput.value) toInput.value = today;

  const from = fromInput?.value || today;
  const to = toInput?.value || from;
  const empSel = document.getElementById('sales-employee-filter');

  // Populate employee filter dropdown if needed
  if (empSel && empSel.options.length <= 1) {
    try {
      const emps = await api('/api/employees');
      empSel.innerHTML = `<option value="">${currentLang === 'ar' ? 'كل الموظفين' : 'All Employees'}</option>` +
        emps.filter(e => e.active).map(e => `<option value="${e.id}">${escapeHtml(currentLang === 'ar' ? e.name : (e.name_en || e.name))}</option>`).join('');
    } catch(e) {}
  }

  const empId = empSel?.value || '';
  let url = `/api/reports/sales?from=${from}&to=${to}`;
  if (empId) url += `&employee_id=${empId}`;

  const report = await api(url);
  const currency = getCurrency();
  const container = document.getElementById('sales-content');
  if (!container) return;

  container.innerHTML = `
    <div class="closing-stats">
      <div class="report-stat">
        <span>${currentLang === 'ar' ? 'إجمالي الطلبات' : 'Total Orders'}</span>
        <span class="stat-value">${report.totals?.total_orders || 0}</span>
      </div>
      <div class="report-stat">
        <span>${currentLang === 'ar' ? 'إجمالي المبيعات' : 'Total Revenue'}</span>
        <span class="stat-value">${(report.totals?.total_revenue || 0).toFixed(2)} ${escapeHtml(currency)}</span>
      </div>
      <div class="report-stat">
        <span>${currentLang === 'ar' ? 'الضريبة المحصلة' : 'Total Tax'} ${report.totals?.tax_rate ? `(${report.totals.tax_rate}%)` : ''}</span>
        <span class="stat-value">${(report.totals?.total_tax || 0).toFixed(2)} ${escapeHtml(currency)}</span>
      </div>
      <div class="report-stat">
        <span>${currentLang === 'ar' ? 'متوسط قيمة الطلب' : 'Average Order'}</span>
        <span class="stat-value">
          ${report.totals?.total_orders > 0 ? ((report.totals?.total_revenue || 0) / report.totals?.total_orders).toFixed(2) : '0.00'} ${escapeHtml(currency)}
        </span>
      </div>
    </div>

    ${report.by_type && report.by_type.length > 0 ? `
      <h3 style="margin-top:18px; margin-bottom:10px; color:var(--primary); font-size:15px;">
        ${currentLang === 'ar' ? 'المبيعات حسب نوع الطلب' : 'Sales by Order Type'}
      </h3>
      <div class="closing-stats">
        ${report.by_type.map(t => {
          const typeLabels = { dine_in: currentLang === 'ar' ? '🍽️ محلي' : '🍽️ Dine In', takeaway: currentLang === 'ar' ? '🛍️ سفري' : '🛍️ Takeaway', delivery: currentLang === 'ar' ? '🛵 توصيل' : '🛵 Delivery' };
          return `
            <div class="report-stat">
              <span>${escapeHtml(typeLabels[t.type] || t.type)}</span>
              <span class="stat-value">${t.count} ${currentLang === 'ar' ? 'طلبات' : 'orders'} - ${(t.total || 0).toFixed(2)} ${escapeHtml(currency)}</span>
            </div>
          `;
        }).join('')}
      </div>
    ` : ''}

    ${report.daily && report.daily.length > 0 ? `
      <h3 style="margin-top:18px; margin-bottom:10px; color:var(--primary); font-size:15px;">
        ${currentLang === 'ar' ? 'المبيعات حسب الأيام' : 'Daily Sales Breakdown'}
      </h3>
      <div class="invoices-table-wrapper">
        <table class="admin-table">
          <thead><tr>
            <th>${currentLang === 'ar' ? 'التاريخ' : 'Date'}</th>
            <th>${currentLang === 'ar' ? 'عدد الطلبات' : 'Orders'}</th>
            <th>${currentLang === 'ar' ? 'الإيراد' : 'Revenue'}</th>
            <th>${currentLang === 'ar' ? 'الضريبة' : 'Tax'}</th>
          </tr></thead>
          <tbody>${report.daily.map(d => `
            <tr>
              <td><strong>${d.day}</strong></td>
              <td>${d.orders}</td>
              <td><strong style="color:var(--gold-hover);">${(d.revenue || 0).toFixed(2)} ${escapeHtml(currency)}</strong></td>
              <td><span style="color:#777;">${(d.tax || 0).toFixed(2)} ${escapeHtml(currency)}</span></td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    ` : ''}

    ${report.by_payment && report.by_payment.length > 0 ? `
      <h3 style="margin-top:18px; margin-bottom:10px; color:var(--primary); font-size:15px;">
        ${currentLang === 'ar' ? 'المبيعات حسب طريقة الدفع' : 'Sales by Payment Method'}
      </h3>
      <div class="closing-stats">
        ${report.by_payment.map(p => {
          const labels = { cash: '💵 ' + t('payment_cash'), promptpay: '📱 ' + t('payment_promptpay'), truemoney: '💳 ' + t('payment_truemoney'), card: '💳 ' + t('payment_card') };
          return `
            <div class="report-stat">
              <span>${escapeHtml(labels[p.payment_method] || p.payment_method)}</span>
              <span class="stat-value">${p.count} ${currentLang === 'ar' ? 'طلبات' : 'orders'} - ${(p.total || 0).toFixed(2)} ${escapeHtml(currency)}</span>
            </div>
          `;
        }).join('')}
      </div>
    ` : ''}

    ${report.by_employee && report.by_employee.length > 0 ? `
      <h3 style="margin-top:18px; margin-bottom:10px; color:var(--primary); font-size:15px;">
        ${currentLang === 'ar' ? 'المبيعات حسب الموظف' : 'Sales by Employee'}
      </h3>
      <div class="invoices-table-wrapper">
        <table class="admin-table">
          <thead><tr>
            <th>${currentLang === 'ar' ? 'الموظف' : 'Employee'}</th>
            <th>${currentLang === 'ar' ? 'الطلبات' : 'Orders'}</th>
            <th>${currentLang === 'ar' ? 'الإجمالي' : 'Revenue'}</th>
          </tr></thead>
          <tbody>${report.by_employee.map(e => `
            <tr>
              <td><strong>${escapeHtml(e.employee_name || '-')}</strong></td>
              <td>${e.count}</td>
              <td><strong style="color:var(--gold-hover);">${(e.total || 0).toFixed(2)} ${escapeHtml(currency)}</strong></td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    ` : ''}
  `;
}
