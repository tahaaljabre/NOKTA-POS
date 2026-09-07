// ===== Admin Reports & Custom Period Analytics =====

async function loadAdminReport() {
  const fromInput = document.getElementById('report-from');
  const toInput = document.getElementById('report-to');
  const today = businessDate();

  if (fromInput && !fromInput.value) fromInput.value = today;
  if (toInput && !toInput.value) toInput.value = today;

  const from = fromInput?.value || today;
  const to = toInput?.value || from;
  const empSel = document.getElementById('report-employee-filter');

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
  const container = document.getElementById('report-content');
  if (!container) return;

  container.innerHTML = `
    <div class="closing-stats">
      <div class="report-stat">
        <span>${currentLang === 'ar' ? 'إجمالي الطلبات' : 'Total Orders'}</span>
        <span class="stat-value">${report.totals?.total_orders || 0}</span>
      </div>
      <div class="report-stat">
        <span>${currentLang === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue'}</span>
        <span class="stat-value">${(report.totals?.total_revenue || 0).toFixed(2)} ${escapeHtml(currency)}</span>
      </div>
    </div>

    ${report.by_payment && report.by_payment.length > 0 ? `
      <h3 style="margin-top:16px; margin-bottom:8px; color:var(--primary); font-size:15px;">
        ${currentLang === 'ar' ? 'المبيعات حسب طريقة الدفع' : 'Payment Methods Breakdown'}
      </h3>
      <div class="closing-stats">
        ${report.by_payment.map(p => {
          const defaultNames = { cash: '💵 كاش' };
          let name = defaultNames[p.payment_method] || p.payment_method;
          if (typeof paymentMethodsList !== 'undefined') {
            const found = paymentMethodsList.find(x => x.id === p.payment_method);
            if (found) name = found.name;
          }
          return `
            <div class="report-stat">
              <span>${escapeHtml(name)}</span>
              <span class="stat-value">${p.count} ${currentLang === 'ar' ? 'طلبات' : 'orders'} - ${(p.total || 0).toFixed(2)} ${escapeHtml(currency)}</span>
            </div>
          `;
        }).join('')}
      </div>
    ` : ''}

    ${report.by_employee && report.by_employee.length > 0 ? `
      <h3 style="margin-top:16px; margin-bottom:8px; color:var(--primary); font-size:15px;">
        ${currentLang === 'ar' ? 'أداء ومبيعات الموظفين' : 'Employee Performance'}
      </h3>
      <div class="invoices-table-wrapper">
        <table class="admin-table">
          <thead><tr>
            <th>${currentLang === 'ar' ? 'الموظف' : 'Employee'}</th>
            <th>${currentLang === 'ar' ? 'الطلبات المكتملة' : 'Orders'}</th>
            <th>${currentLang === 'ar' ? 'الإيراد' : 'Revenue'}</th>
          </tr></thead>
          <tbody>${report.by_employee.map(e => `
            <tr>
              <td><strong>${escapeHtml(e.employee_name || 'System')}</strong></td>
              <td>${e.count}</td>
              <td><strong style="color:var(--gold-hover);">${(e.total || 0).toFixed(2)} ${escapeHtml(currency)}</strong></td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    ` : ''}
  `;
}

function printAdminReport() {
  if (typeof printSalesReport === 'function') {
    printSalesReport();
  }
}

// Backward compatibility alias
async function loadDailyReport() {
  loadAdminReport();
}
