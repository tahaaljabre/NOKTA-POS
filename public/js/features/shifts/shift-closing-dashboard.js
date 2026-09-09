// Daily-closing dashboard, employee closing actions, and grand business-day closing.
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
                  <button class="btn-edit" data-action="print-thermal" data-closing-id="${c.id}" title="${currentLang === 'ar' ? 'طباعة إيصال حراري' : 'Print Thermal Receipt'}">
                    🧾 ${currentLang === 'ar' ? 'حراري' : 'Thermal'}
                  </button>
                  <button class="btn" data-action="print-pdf" data-closing-id="${c.id}" title="${currentLang === 'ar' ? 'طباعة تقرير A4' : 'Print A4 Report'}">
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
  if (!container._delegationAdded) {
    container._delegationAdded = true;
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const closingId = parseInt(btn.dataset.closingId);
      const closing = closings.find(c => c.id === closingId);
      if (!closing) return;
      if (action === 'print-thermal') printDailyClosingReportFromRecord(closing, 'thermal');
      else if (action === 'print-pdf') printDailyClosingReportFromRecord(closing, 'pdf');
    });
  }
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
    if (res.backup_created) {
      toast(`${t('closing_backup_success')}: ${res.backup_file}`, 'success');
    } else if (res.backup_created === false) {
      toast(t('closing_backup_failed'), 'error');
    }
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
