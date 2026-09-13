// POS screen setup, totals, cash calculator, and item selection entry point.
function setupPOS() {
  currentOrder = { items: [], table_id: null, customer_id: null, type: 'dine_in', discount: 0, note: '', payment_method: 'cash', cash_received: 0, attributes: {} };
  setupOrderMethodSelection();
  const tableSelect = document.getElementById('table-select');
  if (tableSelect) tableSelect.onchange = e => { currentOrder.table_id = e.target.value ? parseInt(e.target.value) : null; };

  // Bind primary invoice buttons before optional data loaders.  A missing optional
  // feature must never disable saving, printing, payment selection, or a new bill.
  const bindClick = (id, handler) => {
    const element = document.getElementById(id);
    if (element) element.onclick = handler;
  };
  bindClick('btn-new-order', () => resetOrder());
  bindClick('btn-save-order', () => saveOrder(true));
  bindClick('btn-print-order', () => printOrder());
  bindClick('btn-select-payment', () => openPaymentMethodModal());
  bindClick('pos-edit-invoice-btn', loadInvoiceForPosEdit);
  
  const customerSelect = document.getElementById('customer-select');
  if (customerSelect) {
    customerSelect.onchange = e => { currentOrder.customer_id = e.target.value ? parseInt(e.target.value) : null; };
    if (typeof loadCustomersDropdown === 'function') loadCustomersDropdown();
  }

  const discountInput = document.getElementById('discount-input');
  if (discountInput) discountInput.oninput = e => { 
    let val = parseFloat(e.target.value) || 0;
    const maxDisc = currentUser && currentUser.max_discount !== undefined && currentUser.max_discount !== null ? currentUser.max_discount : 100;
    if (val > maxDisc) {
      val = maxDisc;
      e.target.value = val;
      showToast(t('max_discount_reached', 'تم تجاوز الحد الأقصى للخصم المسموح لك') + ': ' + maxDisc + '%', 'warning');
    }
    currentOrder.discount = val; 
    updateOrderTotals(); 
  };
  const orderNote = document.getElementById('order-note');
  if (orderNote) orderNote.oninput = e => { currentOrder.note = e.target.value; };
  
  const cashInput = document.getElementById('cash-received-input');
  if (cashInput) {
    cashInput.oninput = e => {
      currentOrder.cash_received = parseFloat(e.target.value) || 0;
      calculateChange();
    };
  }

  // Quick cash chips
  document.querySelectorAll('.cash-chip').forEach(chip => {
    chip.onclick = () => {
      const val = chip.dataset.val;
      let total = getOrderTotal();
      if (val === 'exact') {
        currentOrder.cash_received = total;
      } else {
        const add = parseFloat(val) || 0;
        // round to next multiple or add
        if (add >= 100) {
          currentOrder.cash_received = Math.ceil((total || 1) / add) * add;
          if (currentOrder.cash_received === 0) currentOrder.cash_received = add;
        } else {
          currentOrder.cash_received = (currentOrder.cash_received || 0) + add;
        }
      }
      if (cashInput) cashInput.value = currentOrder.cash_received > 0 ? currentOrder.cash_received.toFixed(2) : '';
      calculateChange();
    };
  });
  toggleCashCalculator(true);
  
}

async function loadInvoiceForPosEdit() {
  const input = document.getElementById('pos-edit-invoice-number');
  const number = (input?.value || '').trim();
  if (!number) return toast(currentLang === 'ar' ? 'أدخل رقم الفاتورة' : 'Enter invoice number', 'error');
  try {
    const data = await api(`/api/orders?limit=200&with_items=1`);
    const order = (data || []).find(o => String(o.invoice_number) === number || String(o.id) === number);
    if (!order) return toast(currentLang === 'ar' ? 'الفاتورة غير موجودة' : 'Invoice not found', 'error');
    if (order.is_deleted || order.status === 'cancelled') return toast(currentLang === 'ar' ? 'لا يمكن تعديل فاتورة ملغاة أو محذوفة' : 'Cancelled or deleted invoices cannot be edited', 'error');
    if (typeof openPayOrderModal !== 'function') return toast(t('error'), 'error');
    // Load the invoice into the normal POS cart so additions use the same
    // menu flow as a new order instead of a separate review dialog.
    currentOrder = {
      editingOrderId: order.id, editingOrderVersion: order.version,
      items: (order.items || []).map(i => ({ item_id:i.item_id, name:i.item_name, name_en:i.item_name_en, price:Number(i.price)||0, quantity:Number(i.quantity)||1, note:i.note||'', selected_modifiers:i.selected_modifiers||'[]' })),
      table_id: order.table_id || null, customer_id: order.customer_id || null,
      type: order.type || 'dine_in', discount: Number(order.discount_percent)||0,
      tax_percent: order.tax_percent == null ? appTaxRate : Number(order.tax_percent),
      note: order.note || '', payment_method: order.payment_method || 'cash', cash_received: Number(order.paid_amount)||0,
      attributes: order.attributes ? (typeof order.attributes === 'string' ? JSON.parse(order.attributes) : order.attributes) : {}
    };
    document.getElementById('current-order-number').textContent = `${currentLang === 'ar' ? 'تعديل الفاتورة' : 'Edit invoice'} #${order.invoice_code || order.invoice_number || order.id}`;
    const discount = document.getElementById('discount-input'); if (discount) discount.value = currentOrder.discount;
    const note = document.getElementById('order-note'); if (note) note.value = currentOrder.note;
    const cashInput = document.getElementById('cash-received-input');
    if (cashInput) cashInput.value = currentOrder.cash_received > 0 ? currentOrder.cash_received.toFixed(2) : '';
    const paymentButton = document.getElementById('btn-select-payment');
    if (paymentButton) paymentButton.textContent = order.payment_method_name || (currentOrder.payment_method === 'cash' ? t('payment_cash') : currentOrder.payment_method);
    toggleCashCalculator(currentOrder.payment_method === 'cash');
    renderOrderItems(); updateOrderTotals(); closeModal();
  } catch (e) { toast(t('error') + ': ' + e.message, 'error'); }
}

function getOrderTotal() {
  let subtotal = 0;
  currentOrder.items.forEach(i => { subtotal += i.price * i.quantity; });
  subtotal = Math.round(subtotal * 100) / 100;
  
  const discPct = (currentOrder.discount || 0) / 100;
  const afterDisc = subtotal * (1 - discPct);
  
  const taxPct = (currentOrder.tax_percent ?? appTaxRate ?? 0) / 100;
  if (appTaxType === 'inclusive') return Math.round(afterDisc * 100) / 100;
  const taxAmt = Math.round((afterDisc * taxPct) * 100) / 100;
  return Math.round((afterDisc + taxAmt) * 100) / 100;
}

function toggleCashCalculator(isCash) {
  const calcRow = document.getElementById('cash-calc-row');
  const changeRow = document.getElementById('change-row');
  if (calcRow) calcRow.style.display = isCash ? 'flex' : 'none';
  if (changeRow) changeRow.style.display = isCash ? 'flex' : 'none';
  if (isCash) calculateChange();
}

function calculateChange() {
  const total = getOrderTotal();
  const received = currentOrder.cash_received || 0;
  const changeEl = document.getElementById('order-change-val');
  if (!changeEl) return;
  if (received > 0 && received >= total) {
    const diff = received - total;
    changeEl.textContent = diff.toFixed(2);
    changeEl.style.color = 'var(--success)';
  } else if (received > 0 && received < total) {
    changeEl.textContent = `-${(total - received).toFixed(2)}`;
    changeEl.style.color = 'var(--danger)';
  } else {
    changeEl.textContent = '0.00';
    changeEl.style.color = 'var(--gold-hover)';
  }
}
