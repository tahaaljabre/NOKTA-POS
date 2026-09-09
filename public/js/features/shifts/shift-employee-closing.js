// Employee shift-closing modal, reconciliation, and submission.
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
              👤 ${escapeHtml(currentUser.name)} ${currentUser.role ? `(${currentUser.role === 'admin' ? (currentLang === 'ar' ? 'مدير' : 'Admin') : (currentUser.role === 'waiter' ? (currentLang === 'ar' ? 'نادل' : 'Waiter') : (currentLang === 'ar' ? 'كاشير' : 'Cashier'))})` : ''}
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
            <button type="button" class="btn" id="print-thermal-slip-btn" style="background:#f6c23e;color:#5a3c00;font-weight:800;padding:10px 16px;border-radius:8px;font-size:13px;white-space:nowrap;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
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
    const thermalBtn = document.getElementById('print-thermal-slip-btn');
    if (thermalBtn) {
      thermalBtn.addEventListener('click', () => printDailyClosingThermal(shiftData));
    }
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
