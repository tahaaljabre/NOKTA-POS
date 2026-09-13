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
  const platformTotal = paymentTotals['platform'] || 0;
  const networkTotal = (paymentTotals['card'] || 0) + (paymentTotals['promptpay'] || 0) + (paymentTotals['truemoney'] || 0);
  const platformApps = platformBreakdownFromOrders(completedToday);
  const dailyReport = await api(`/api/reports/daily?date=${date}${empId ? `&employee_id=${empId}` : ''}`);
  const paymentRows = dailyReport.by_payment || [];
  const networkRows = paymentRows.filter(p => p.payment_method !== 'cash' && p.payment_method !== 'platform');

  const container = document.getElementById('closing-content');
  if (!container) return;

  container.innerHTML = `
    <div class="closing-stats">
      <div class="report-stat">
        <span>${currentLang === 'ar' ? 'الطلبات المكتملة' : 'Completed Orders'}</span>
        <span class="stat-value">${dailyReport.total_orders}</span>
      </div>
      <div class="report-stat">
        <span>${currentLang === 'ar' ? 'إجمالي المبيعات' : 'Total Revenue'}</span>
        <span class="stat-value">${Number(dailyReport.total_revenue || 0).toFixed(2)} ${escapeHtml(currency)}</span>
      </div>
      <div class="report-stat">
        <span>💵 ${currentLang === 'ar' ? 'نقداً (كاش)' : 'Cash'}</span>
        <span class="stat-value">${Number(dailyReport.cash_sales || 0).toFixed(2)} ${escapeHtml(currency)}</span>
      </div>
      <div class="report-stat">
        <span>💳 ${currentLang === 'ar' ? 'شبكة و QR' : 'Card & QR'}</span>
        <span class="stat-value">${networkRows.reduce((sum, row) => sum + Number(row.total || 0), 0).toFixed(2)} ${escapeHtml(currency)}</span>
      </div>
      <div class="report-stat"><span>${t('platform_receivable')}</span><span class="stat-value">${Number(dailyReport.platform_receivable || 0).toFixed(2)} ${escapeHtml(currency)}</span></div>
    </div>
    <h3>${t('network_sales')}</h3><div class="closing-stats">${networkRows.map(row => `<div class="report-stat"><span>${escapeHtml((typeof paymentMethodsList !== 'undefined' ? paymentMethodsList : []).find(m => m.id === row.payment_method)?.name || row.payment_method)}</span><span class="stat-value">${Number(row.total || 0).toFixed(2)} ${escapeHtml(currency)}</span></div>`).join('')}</div>
    <h3>${t('sales_by_delivery_app')}</h3><div class="closing-stats">${(dailyReport.by_delivery_app || []).map(app => `<div class="report-stat"><span>${escapeHtml(app.app_name)}</span><span class="stat-value">${Number(app.total || 0).toFixed(2)} ${escapeHtml(currency)}</span></div>`).join('')}<div class="report-stat"><span>${t('delivery_apps_total')}</span><span class="stat-value">${(dailyReport.by_delivery_app || []).reduce((sum, app) => sum + Number(app.total || 0), 0).toFixed(2)} ${escapeHtml(currency)}</span></div></div>
    <h3>${t('supplier_expenses')}</h3><div class="closing-stats">${(dailyReport.supplier_expenses || []).map(row => `<div class="report-stat"><span>${escapeHtml(row.supplier_name)}</span><span class="stat-value">${Number(row.amount || 0).toFixed(2)} ${escapeHtml(currency)}</span></div>`).join('')}<div class="report-stat"><span>${t('supplier_expenses_total')}</span><span class="stat-value">${Number(dailyReport.supplier_expenses_total || 0).toFixed(2)} ${escapeHtml(currency)}</span></div></div>
    <h3>${t('admin_expenses')}</h3><div class="closing-stats">${(dailyReport.shop_expenses || []).map(row => `<div class="report-stat"><span>${escapeHtml(row.title)} · ${escapeHtml(row.cashier_name)}</span><span class="stat-value">${Number(row.amount || 0).toFixed(2)} ${escapeHtml(currency)}</span></div>`).join('')}<div class="report-stat"><span>${t('shop_expenses_total')}</span><span class="stat-value">${Number(dailyReport.shop_expenses_total || 0).toFixed(2)} ${escapeHtml(currency)}</span></div><div class="report-stat"><span>${t('expenses_total')}</span><span class="stat-value">${Number(dailyReport.expenses_total || 0).toFixed(2)} ${escapeHtml(currency)}</span></div></div>
    <div class="closing-stats"><div class="report-stat"><span>${t('expected_cash_drawer')}</span><span class="stat-value">${Number(dailyReport.expected_cash || 0).toFixed(2)} ${escapeHtml(currency)}</span></div><div class="report-stat"><span>${t('net_after_expenses')}</span><span class="stat-value">${Number(dailyReport.net_after_expenses || 0).toFixed(2)} ${escapeHtml(currency)}</span></div></div>
    <div class="admin-muted">${t('cash_drawer_formula')}: ${Number(dailyReport.opening_cash || 0).toFixed(2)} + ${Number(dailyReport.cash_sales || 0).toFixed(2)} − ${Number(dailyReport.cash_expenses || 0).toFixed(2)}. ${t('cash_discounts')}: ${Number(dailyReport.cash_discount || 0).toFixed(2)} (${t('discounts_included_in_sales')})</div>
    ${dailyReport.counted_cash !== null ? `<div class="closing-stats"><div class="report-stat"><span>${t('counted_cash')}${dailyReport.cash_count_complete ? '' : ` (${t('partial_cash_count')})`}</span><span class="stat-value">${Number(dailyReport.counted_cash).toFixed(2)} ${escapeHtml(currency)}</span></div>${dailyReport.cash_count_complete ? `<div class="report-stat"><span>${t('cash_difference')}</span><span class="stat-value">${Number(dailyReport.cash_difference || 0).toFixed(2)} ${escapeHtml(currency)}</span></div>` : ''}</div>` : ''}
    ${dailyReport.legacy_app_collection ? `<div class="admin-muted">${t('legacy_app_collection')}: ${dailyReport.legacy_app_collection.toFixed(2)} ${escapeHtml(currency)}</div>` : ''}
    ${dailyReport.by_cashier?.length ? `<h3 style="margin-top:18px;margin-bottom:10px;color:var(--primary);font-size:15px;">${t('cashier_waiter_sales')}</h3><div class="closing-stats">${dailyReport.by_cashier.map(c => `<div class="report-stat"><span>🧾 ${escapeHtml(c.cashier_name || c.cashier_code || '')}${c.cashier_name ? ` (${escapeHtml(c.cashier_code)})` : ''}${c.waiters?.length ? `<small style="display:block;color:var(--text-light);margin-top:5px;">${c.waiters.map(w => `${escapeHtml(w.employee_name)}: ${(w.total || 0).toFixed(2)}`).join(' · ')}</small>` : ''}</span><span class="stat-value">${c.count} · ${(c.total || 0).toFixed(2)} ${escapeHtml(currency)}</span></div>`).join('')}</div><div class="admin-muted">${currentLang === 'ar' ? 'الضريبة' : 'Tax'}: ${(dailyReport.total_tax || 0).toFixed(2)} (${dailyReport.tax_rate || 0}%)</div>` : ''}
    
    ${closings.length > 0 ? `
      <h3 style="margin-top:18px; margin-bottom:10px; color:var(--primary); font-size:15px;">
        ${currentLang === 'ar' ? 'سجل الإغلاقات المسجلة' : 'Recorded Daily Closings'}
      </h3>
      <div class="invoices-table-wrapper">
        <table class="admin-table">
          <thead><tr>
            <th>${currentLang === 'ar' ? 'الكاشير' : 'Cashier'}</th><th>${currentLang === 'ar' ? 'الموظف' : 'Employee'}</th>
            <th>${currentLang === 'ar' ? 'الطلبات' : 'Orders'}</th>
            <th>${currentLang === 'ar' ? 'الإجمالي' : 'Total'}</th>
            <th>💵 ${currentLang === 'ar' ? 'نقد' : 'Cash'}</th>
            <th>💳 ${currentLang === 'ar' ? 'شبكة و QR' : 'Card & QR'}</th>
            <th>${t('platform_receivable')}</th>
            <th>${currentLang === 'ar' ? 'الحالة' : 'Status'}</th>
            <th>${currentLang === 'ar' ? 'إجراءات' : 'Actions'}</th>
          </tr></thead>
          <tbody>${closings.map(c => `
            <tr>
              <td><strong>${escapeHtml(c.cashier_code || '-')}</strong></td><td><strong>${escapeHtml(c.employee_name)}</strong></td>
              <td>${c.total_orders}</td>
              <td><strong style="color:var(--gold-hover);">${(c.total_revenue || 0).toFixed(2)} ${escapeHtml(currency)}</strong></td>
              <td>${(c.cash_total || 0).toFixed(2)}</td>
              <td>${((c.promptpay_total || 0) + (c.card_total || 0) + (c.truemoney_total || 0)).toFixed(2)}</td>
              <td>${(c.platform_total || 0).toFixed(2)}${Object.keys(readPlatformBreakdown(c.platform_breakdown)).length ? `<small style="display:block">${Object.entries(readPlatformBreakdown(c.platform_breakdown)).map(([app, value]) => `${escapeHtml(deliveryAppName(app))}: ${Number(value).toFixed(2)}`).join(' · ')}</small>` : ''}</td>
              <td class="${c.is_closed ? 'status-active' : 'status-inactive'}">
                ${c.is_closed ? (currentLang === 'ar' ? '✓ مغلق' : '✓ Closed') : (currentLang === 'ar' ? 'مفتوح' : 'Open')}
                ${c.approved_by ? `<small style="display:block;color:var(--success);margin-top:4px;">✓ ${currentLang === 'ar' ? 'معتمد إدارياً' : 'Admin approved'}</small>` : ''}
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
                  ${currentUser?.role === 'admin' && c.is_closed && !c.approved_by ? `<button class="btn-save" data-action="approve-closing" data-closing-id="${c.id}">✅ ${currentLang === 'ar' ? 'اعتماد الإغلاق' : 'Approve'}</button>` : ''}
                  ${currentUser?.role === 'admin' && c.is_closed ? `<button class="btn-edit" data-action="reopen-closing" data-closing-id="${c.id}">↩️ ${currentLang === 'ar' ? 'فتح الوردية للتصحيح' : 'Reopen for correction'}</button>` : ''}
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
  container._closingRecords = new Map(closings.map(closing => [String(closing.id), closing]));
  if (!container._delegationAdded) {
    container._delegationAdded = true;
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const closingId = btn.dataset.closingId;
      const closing = container._closingRecords?.get(closingId);
      if (!closing) return toast(t('closing_record_missing'), 'error');
      if (btn.disabled) return;
      if (action === 'approve-closing' || action === 'reopen-closing') {
        const prompt = action === 'approve-closing'
          ? (currentLang === 'ar' ? 'اعتماد هذا الإغلاق إدارياً؟' : 'Approve this closing administratively?')
          : (currentLang === 'ar' ? 'إعادة فتح هذا الإغلاق؟' : 'Reopen this closing?');
        if (!confirm(prompt)) return;
      }
      btn.disabled = true;
      try {
        if (action === 'print-thermal') await printDailyClosingReportFromRecord(closing, 'thermal');
        else if (action === 'print-pdf') await printDailyClosingReportFromRecord(closing, 'pdf');
        else if (action === 'approve-closing' || action === 'reopen-closing') {
          const endpoint = action === 'approve-closing' ? 'approve' : 'reopen';
          const result = await api(`/api/daily-closings/${closingId}/${endpoint}`, 'POST', {});
          if (result?.error) throw new Error(result.error);
          toast(action === 'approve-closing'
            ? (currentLang === 'ar' ? 'تم اعتماد الإغلاق إدارياً' : 'Closing approved')
            : (currentLang === 'ar' ? 'تمت إعادة فتح الإغلاق' : 'Closing reopened'), 'success');
          await loadDailyClosing();
        }
      } catch (error) {
        toast(error.message || t('closing_action_failed'), 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }
}

async function closeDay(closingId) {
  if (!confirm(currentLang === 'ar' ? 'هل تريد تأكيد إغلاق اليوم؟' : 'Confirm closing the day?')) return;
  const date = document.getElementById('closing-date')?.value || businessDate();
  const records = await api(`/api/daily-closings?date=${date}`);
  const record = records.find(item => Number(item.id) === Number(closingId));
  if (!record) return toast(t('closing_record_missing'), 'error');
  const empId = record.employee_id;
  const notes = document.getElementById('closing-notes')?.value?.trim() || '';
  const countedCash = document.getElementById('closing-counted-cash')?.value || '';
  const res = await api('/api/daily-closings/close', 'POST', { employee_id: empId, date, notes, counted_cash: countedCash });
  if (res.error) return toast(res.error, 'error');
  toast(currentLang === 'ar' ? 'تم الإغلاق اليومي بنجاح' : 'Day closed successfully', 'success');
  loadDailyClosing();
  printDailyClosingReport({
    date: date,
    employee_id: empId,
    notes,
    counted_cash: res.counted_cash,
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
  const notes = document.getElementById('closing-notes')?.value?.trim() || '';
  const countedCash = document.getElementById('closing-counted-cash')?.value || '';
  const result = await api('/api/daily-closings/close', 'POST', { employee_id: empId, date, notes, counted_cash: countedCash });
  if (result.error) return toast(result.error, 'error');

  toast(`${currentLang === 'ar' ? 'تم الإغلاق' : 'Closed'}: ${result.total_orders} ${currentLang === 'ar' ? 'طلبات' : 'orders'} - ${result.total_revenue?.toFixed(2)} ${getCurrency()}`, 'success');
  loadDailyClosing();

  printDailyClosingReport({
    date: date,
    employee_id: empId,
    notes,
    counted_cash: result.counted_cash,
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
    return printDailyClosingThermal(closingRecord);
  } else {
    return printDailyClosingReport(closingRecord);
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
      notes: document.getElementById('closing-notes')?.value?.trim() || (currentLang === 'ar' ? 'إغلاق كلي للمطعم معتمد من الإدارة' : 'Grand restaurant closing')
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
