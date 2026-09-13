// Order payment, completion, cancellation, and prepaid handling.
// Extracted item review logic moved to order-review.js.

async function completeOrder(id) {
  const latest = await api("/api/orders/" + id);
  try {
    const empId = (currentUser && currentUser.id) ? currentUser.id : 1;
    const empName = (currentUser && currentUser.name) ? currentUser.name : 'الكاشير';
    await api(`/api/orders/${id}`, 'PUT', { version: latest.version, status: 'completed', employee_id: empId, employee_name: empName });
    toast(t('order_completed'), 'success');
    loadActiveOrders();
    loadTables();
  } catch (err) {
    console.error('Complete order error:', err);
    toast(t('error') + ': ' + (err.message || ''), 'error');
  }
}

async function cancelOrder(id) {
  const latest = await api("/api/orders/" + id);
  if (!confirm(t('confirm_delete'))) return;
  const empId = (currentUser && currentUser.id) ? currentUser.id : 1;
  const empName = (currentUser && currentUser.name) ? currentUser.name : 'الكاشير';
  await api(`/api/orders/${id}`, 'PUT', { version: latest.version, status: 'cancelled', employee_id: empId, employee_name: empName });
  toast(t('order_cancel'), 'error');
  loadActiveOrders();
  loadTables();
}

async function printExistingOrder(id) {
  const o = await api(`/api/orders/${id}`);
  generateReceipt(o);
}

async function completePrepaidOrder(orderId) {
  if (!confirm(currentLang === 'ar' ? 'إنهاء الطلب كمدفوع؟' : 'Complete this pre-paid order?')) return;
  try {
    await api(`/api/orders/${orderId}`, 'PUT', { status: 'completed' });
    toast(currentLang === 'ar' ? 'تم إنهاء الطلب' : 'Order completed', 'success');
    if (typeof loadActiveOrders === 'function') loadActiveOrders();
    if (typeof loadTables === 'function') loadTables();
  } catch (error) {
    toast(error.message, 'error');
  }
}

// Open pay order modal - delegates item editing to order-review.js
async function openPayOrderModal(orderId) {
  try {
    const order = await api(`/api/orders/${orderId}`);
    if (!order) throw new Error('Order not found');
    let orderAttributes = {};
    try { orderAttributes = typeof order.attributes === 'string' ? JSON.parse(order.attributes) : (order.attributes || {}); } catch {}
    const appSettlement = order.type === 'delivery' && !!orderAttributes.delivery_app_id;

    let allMenuItems = items;
    if (!allMenuItems || allMenuItems.length === 0) {
      try { allMenuItems = await api('/api/items'); } catch(e) { allMenuItems = []; }
    }

    let editOrderItems = (order.items || []).map(i => ({
      item_id: i.item_id, name: i.item_name || i.name,
      name_en: i.item_name_en || i.name_en || i.name,
      price: parseFloat(i.price) || 0,
      quantity: parseInt(i.quantity) || 1, note: i.note || ''
    }));

    const curr = getCurrency();
    const orderTitle = (order.table_number ? (currentLang === 'ar' ? 'طاولة ' : 'Table ') + order.table_number : '#' + (order.invoice_code || order.invoice_number || order.id));
    const modalTitle = currentLang === 'ar' ? `دفع ومراجعة الفاتورة (${orderTitle})` : `Settle & Review Bill (${orderTitle})`;

    const modalHtml = `
      <div style="padding:4px 0;">
        <div style="background:var(--bg-subtle, #f8f9fa);padding:12px 14px;border-radius:8px;margin-bottom:12px;border:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px;">
            <span>${currentLang === 'ar' ? 'رقم الفاتورة:' : 'Invoice No:'} <strong>#${escapeHtml(order.invoice_code || order.invoice_number || order.id)}</strong></span>
            <span style="color:var(--text-light);">${order.table_number ? (currentLang === 'ar' ? 'طاولة ' : 'Table ') + order.table_number : (order.type === 'takeaway' ? (currentLang === 'ar' ? 'سفري' : 'Takeaway') : order.type)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;color:var(--primary);">
            <span>${t('total')}:</span>
            <span id="modal-live-total">${calcCurrentTotal(editOrderItems, order).toFixed(2)} ${curr}</span>
          </div>
        </div>
        <div id="modal-order-items-list" style="max-height:160px;overflow-y:auto;margin-bottom:8px;"></div>
        <div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);">
          <div style="display:flex;gap:6px;margin-bottom:6px;">
            <input type="text" id="modal-item-search-input" placeholder="${currentLang === 'ar' ? '🔍 ابحث باسم الصنف...' : '🔍 Search item by name...'}" style="flex:1;padding:7px 10px;font-size:12.5px;border-radius:6px;border:1px solid var(--border);background:var(--bg);">
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <select id="modal-add-item-select" style="flex:1;padding:7px 10px;font-size:12px;border-radius:6px;border:1px solid var(--border);background:var(--bg);max-width:calc(100% - 110px);">
              <option value="">-- ${t('choose_item')} (${allMenuItems.filter(i => i.active !== 0).length}) --</option>
              ${allMenuItems.filter(i => i.active !== 0).map(i => `<option value="${i.id}" data-name="${escapeHtml(i.name)}" data-name-en="${escapeHtml(i.name_en || i.name)}" data-price="${i.price}">${escapeHtml(i.name)} (${i.price} ${curr})</option>`).join('')}
            </select>
            <button type="button" class="btn" id="modal-btn-add-item" style="padding:6px 12px;font-size:12px;background:var(--primary);color:#fff;white-space:nowrap;">
              ${t('add_item_to_order')}
            </button>
          </div>
        </div>
        <label style="display:block;font-weight:700;font-size:13px;margin-bottom:6px;">${t('select_payment')}:</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
          ${appSettlement ? `<label style="grid-column:1/-1;display:flex;align-items:center;gap:8px;padding:12px;border:1.5px solid var(--primary);border-radius:8px;background:var(--card);font-weight:700;"><input type="radio" name="pay-method-radio" value="platform" checked> ${t('platform_collection')} — ${escapeHtml(orderAttributes.delivery_app || orderAttributes.delivery_app_id)}</label>` : `
          <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;background:var(--card);font-weight:600;font-size:13px;">
            <input type="radio" name="pay-method-radio" value="cash" checked style="transform:scale(1.2);"> <span>💵 ${t('payment_cash')}</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;background:var(--card);font-weight:600;font-size:13px;">
            <input type="radio" name="pay-method-radio" value="promptpay" style="transform:scale(1.2);"> <span>📱 PromptPay</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;background:var(--card);font-weight:600;font-size:13px;">
            <input type="radio" name="pay-method-radio" value="card" style="transform:scale(1.2);"> <span>💳 ${t('payment_card')}</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;background:var(--card);font-weight:600;font-size:13px;">
            <input type="radio" name="pay-method-radio" value="truemoney" style="transform:scale(1.2);"> <span>💳 TrueMoney</span>
          </label>`}
        </div>
        <div id="modal-cash-section" style="margin-bottom:12px;${appSettlement ? 'display:none;' : ''}">
          <label style="display:block;font-weight:600;font-size:12.5px;margin-bottom:4px;">${t('cash_received')}:</label>
          <input type="number" id="modal-cash-tendered" value="${calcCurrentTotal(editOrderItems, order).toFixed(2)}" step="any" style="width:100%;padding:9px;font-size:16px;font-weight:800;border:1.5px solid var(--border);border-radius:6px;">
          <div id="modal-payment-due" style="margin-top:6px;padding:7px 10px;border-radius:6px;background:var(--bg-subtle,#f8f5ef);font-weight:700;color:var(--primary);text-align:center;"></div>
        </div>
        <div style="background:#e8f5e9;padding:9px 12px;border-radius:6px;display:flex;align-items:center;gap:8px;color:#2e7d32;font-size:12px;font-weight:600;">
          <span>🖨️</span>
          <span>${currentLang === 'ar' ? 'سيتم حفظ التعديلات وطباعة الإيصال الحراري فوراً وتسجيل كل حركة بالتدقيق اليومي' : 'Changes, print and audit will be saved immediately'}</span>
        </div>
      </div>
    `;

    openModal(modalTitle, modalHtml, async () => {
      if (editOrderItems.length === 0) throw new Error(currentLang === 'ar' ? 'لا يمكن إتمام الفاتورة بدون أصناف' : 'Order must contain at least one item');
      const selectedRadio = document.querySelector('input[name="pay-method-radio"]:checked');
      const selectedMethod = selectedRadio ? selectedRadio.value : 'cash';
      const finalTotal = calcCurrentTotal(editOrderItems, order);
      const cashInput = document.getElementById('modal-cash-tendered');
      const cashPaid = selectedMethod === 'cash'
        ? (cashInput ? (parseFloat(cashInput.value) || finalTotal) : finalTotal)
        : finalTotal;
      const changeDue = Math.max(0, cashPaid - finalTotal);
      const empId = (currentUser && currentUser.id) ? currentUser.id : 1;
      const empName = (currentUser && currentUser.name) ? currentUser.name : 'الكاشير';
      const fullCompletedOrder = await api(`/api/orders/${orderId}`, 'PUT', {
        version: order.version, status: 'completed', payment_method: selectedMethod,
        tax_percent: (order.tax_percent !== undefined ? order.tax_percent : (window.settings?.tax_rate || 0)),
        total: finalTotal, paid_amount: cashPaid, change_amount: changeDue,
        employee_id: empId, employee_name: empName, items: editOrderItems
      });
      generateReceipt(fullCompletedOrder);
      toast(currentLang === 'ar' ? `✅ تم الدفع والتعديل وطباعة الفاتورة بنجاح #${order.invoice_number || order.id}` : `✅ Paid & Printed #${order.invoice_number || order.id}`, 'success');
      loadActiveOrders();
      loadTables();
    }, currentLang === 'ar' ? '💳 تأكيد الدفع والطباعة' : '💳 Settle & Print');

    window.__paymentReviewOrder = order;
    setupModalItemControls(editOrderItems, allMenuItems, currentLang, curr, t, escapeHtml);
    const cashInput = document.getElementById('modal-cash-tendered');
    if (cashInput) cashInput.addEventListener('input', () => renderModalItemsList(editOrderItems, allMenuItems, currentLang, curr, t, escapeHtml));
  } catch (err) {
    console.error('Open pay modal error:', err);
    toast(t('error') + ': ' + (err.message || ''), 'error');
  }
}
