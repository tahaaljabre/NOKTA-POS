function setupPOS() {
  currentOrder = { items: [], table_id: null, customer_id: null, type: 'dine_in', discount: 0, note: '', payment_method: 'cash', cash_received: 0, attributes: {} };
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
  
}

function getOrderTotal() {
  let subtotal = 0;
  currentOrder.items.forEach(i => { subtotal += i.price * i.quantity; });
  subtotal = Math.round(subtotal * 100) / 100;
  
  const discPct = (currentOrder.discount || 0) / 100;
  const afterDisc = subtotal * (1 - discPct);
  
  const taxPct = (appTaxRate || 0) / 100;
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

let pendingModifierItem = null;
let currentModifiers = [];

async function addToOrder(itemId) {
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  
  if (item.has_modifiers === 1) {
    pendingModifierItem = item;
    openModifierModal(item);
    return;
  }

  const existing = currentOrder.items.find(i => i.item_id === itemId && (!i.selected_modifiers || i.selected_modifiers === '[]'));
  if (existing) { existing.quantity++; }
  else { currentOrder.items.push({ item_id: itemId, category_id: item.category_id, name: item.name, name_en: item.name_en, price: item.price, quantity: 1, note: '', selected_modifiers: '[]' }); }
  renderOrderItems();
  updateOrderTotals();
}

async function openModifierModal(item) {
  document.getElementById('modifier-item-name').textContent = currentLang === 'ar' ? item.name : (item.name_en || item.name);
  document.getElementById('modifier-total-price').textContent = item.price.toFixed(2);
  document.getElementById('modifier-groups-container').innerHTML = `<div style="padding:20px;text-align:center;">${t("loading_modifiers")}</div>`;
  document.getElementById('modifier-modal').classList.add('open');
  
  try {
    const mods = await api("/api/modifiers/item/" + item.id);
    currentModifiers = mods;
    renderModifiers(mods, item.price);
  } catch (e) {
    document.getElementById('modifier-groups-container').innerHTML = `<div style="padding:20px;color:red;">${t("modifiers_failed")}</div>`;
  }
}

function renderModifiers(mods, basePrice) {
  const container = document.getElementById('modifier-groups-container');
  if (mods.length === 0) {
    container.innerHTML = `<div style="padding:20px;text-align:center;">${t("no_modifiers")}</div>`;
    return;
  }
  
  // Group by group_name
  const groups = {};
  mods.forEach(m => {
    const gName = currentLang === 'ar' ? m.group_name : (m.group_name_en || m.group_name);
    if (!groups[gName]) groups[gName] = { is_multiple: m.is_multiple, is_required: m.is_required, items: [] };
    groups[gName].items.push(m);
  });
  
  let html = '';
  for (const [gName, g] of Object.entries(groups)) {
    const inputType = g.is_multiple ? 'checkbox' : 'radio';
    const reqText = g.is_required ? `<span style="color:red;font-size:0.8rem;">*${t("modifier_required")}</span>` : '';
    html += `
      <div class="modifier-group" style="margin-bottom: 15px; border: 1px solid #ddd; border-radius: 8px; padding: 10px;">
        <h4 style="margin-top:0; border-bottom: 1px solid #eee; padding-bottom: 5px;">${escapeHtml(gName)} ${reqText}</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
    `;
    g.items.forEach(m => {
      const name = currentLang === 'ar' ? m.name : (m.name_en || m.name);
      const priceText = m.price_extra > 0 ? `(+${m.price_extra})` : '';
      html += `
        <label style="display:flex; justify-content:space-between; cursor:pointer;">
          <span>
            <input type="${inputType}" name="modgroup_${escapeHtml(gName)}" value="${m.id}" data-price="${m.price_extra}" onchange="updateModifierTotal(${basePrice})">
            ${escapeHtml(name)}
          </span>
          <span style="color:var(--primary-color);font-weight:bold;">${priceText}</span>
        </label>
      `;
    });
    html += `</div></div>`;
  }
  
  container.innerHTML = html;
  
  document.getElementById('btn-add-modifier-item').onclick = () => {
    // Validate required
    let valid = true;
    for (const [gName, g] of Object.entries(groups)) {
      if (g.is_required) {
        const checked = container.querySelectorAll(`input[name="modgroup_${escapeHtml(gName)}"]:checked`);
        if (checked.length === 0) {
          valid = false;
          toast((currentLang === "ar" ? "يرجى اختيار من: " : "Please choose from: ") + gName, 'error');
          break;
        }
      }
    }
    if (!valid) return;
    
    const selected = [];
    let extraPrice = 0;
    container.querySelectorAll('input:checked').forEach(input => {
      const mod = currentModifiers.find(m => m.id === parseInt(input.value));
      if (mod) {
        selected.push({
          id: mod.id,
          name: mod.name,
          name_en: mod.name_en,
          price_extra: mod.price_extra
        });
        extraPrice += mod.price_extra;
      }
    });
    
    const finalPrice = basePrice + extraPrice;
    const modStr = JSON.stringify(selected);
    
    // Check if same item with SAME exact modifiers exists
    const existing = currentOrder.items.find(i => i.item_id === pendingModifierItem.id && i.selected_modifiers === modStr);
    if (existing) {
      existing.quantity++;
    } else {
      currentOrder.items.push({
        item_id: pendingModifierItem.id,
        category_id: pendingModifierItem.category_id,
        name: pendingModifierItem.name,
        name_en: pendingModifierItem.name_en,
        price: finalPrice,
        quantity: 1,
        note: '',
        selected_modifiers: modStr
      });
    }
    
    document.getElementById('modifier-modal').classList.remove('open');
    renderOrderItems();
    updateOrderTotals();
  };
}

function updateModifierTotal(basePrice) {
  let extra = 0;
  document.getElementById('modifier-groups-container').querySelectorAll('input:checked').forEach(input => {
    extra += parseFloat(input.dataset.price) || 0;
  });
  document.getElementById('modifier-total-price').textContent = (basePrice + extra).toFixed(2);
}

function renderOrderItems() {
  const container = document.getElementById('order-items');
  if (currentOrder.items.length === 0) { container.innerHTML = `<div class="empty-order">${t('add_items')}</div>`; return; }
  const curr = getCurrency();
  container.innerHTML = currentOrder.items.map((item, idx) => {
    let modsHtml = '';
    try {
      if (item.selected_modifiers && item.selected_modifiers !== '[]') {
        const mods = JSON.parse(item.selected_modifiers);
        if (mods.length > 0) {
          modsHtml = `<div style="font-size: 0.8rem; color: #7f8c8d; margin-top: 2px;">+ ${mods.map(m => escapeHtml(currentLang === 'ar' ? m.name : (m.name_en || m.name))).join(', ')}</div>`;
        }
      }
    } catch(e) {}
    
    return `
    <div class="order-item">
      <div class="order-item-info">
        <div class="order-item-name">${escapeHtml(currentLang === 'ar' ? item.name : (item.name_en || item.name))}</div>
        ${modsHtml}
        <div class="order-item-price">${item.price.toFixed(2)} × ${item.quantity} ${escapeHtml(curr)}</div>
      </div>
      <div class="order-item-controls">
        <button class="qty-btn minus" data-idx="${idx}">−</button>
        <span class="order-item-qty">${item.quantity}</span>
        <button class="qty-btn plus" data-idx="${idx}">+</button>
      </div>
      <div class="order-item-total">${(item.price * item.quantity).toFixed(2)} ${curr}</div>
      <button class="order-item-delete" data-idx="${idx}">✕</button>
    </div>
  `}).join('');

  container.querySelectorAll('.qty-btn.minus').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); const idx = parseInt(btn.dataset.idx); if (currentOrder.items[idx].quantity > 1) currentOrder.items[idx].quantity--; else currentOrder.items.splice(idx, 1); renderOrderItems(); updateOrderTotals(); };
  });
  container.querySelectorAll('.qty-btn.plus').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); currentOrder.items[parseInt(btn.dataset.idx)].quantity++; renderOrderItems(); updateOrderTotals(); };
  });
  container.querySelectorAll('.order-item-delete').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); currentOrder.items.splice(parseInt(btn.dataset.idx), 1); renderOrderItems(); updateOrderTotals(); };
  });
}

function updateMobileCartBadge() {
  const badge = document.getElementById('mobile-cart-badge');
  if (!badge) return;
  const count = currentOrder.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

function switchMobilePosTab(tab) {
  const menuBtn = document.getElementById('tab-btn-menu');
  const billBtn = document.getElementById('tab-btn-bill');
  const menuPanel = document.getElementById('pos-menu-panel');
  const orderPanel = document.getElementById('pos-order-panel');

  if (tab === 'menu') {
    if (menuBtn) menuBtn.classList.add('active');
    if (billBtn) billBtn.classList.remove('active');
    if (menuPanel) menuPanel.classList.add('mobile-active');
    if (orderPanel) orderPanel.classList.remove('mobile-active');
  } else {
    if (billBtn) billBtn.classList.add('active');
    if (menuBtn) menuBtn.classList.remove('active');
    if (orderPanel) orderPanel.classList.add('mobile-active');
    if (menuPanel) menuPanel.classList.remove('mobile-active');
  }
}

// Exposed for the page buttons as a reliable touch-device fallback.
function selectOrderType(type) {
  if (!['dine_in', 'takeaway', 'delivery'].includes(type)) return;
  if (type === 'delivery') {
    openDeliverySelectModal();
    return;
  }

  document.querySelectorAll('.btn-type').forEach(button => {
    button.classList.toggle('active', button.dataset.type === type);
  });
  currentOrder.type = type;
  if (currentOrder.attributes) delete currentOrder.attributes.delivery_app;

  const deliveryButton = document.querySelector('.btn-type[data-type="delivery"]');
  if (deliveryButton) {
    deliveryButton.querySelector('.type-label').textContent = t('delivery');
    deliveryButton.querySelector('.type-detail')?.remove();
  }
}

function updateOrderTotals() {
  let subtotal = 0;
  currentOrder.items.forEach(i => { subtotal += i.price * i.quantity; });
  subtotal = Math.round(subtotal * 100) / 100;
  
  const discPct = (currentOrder.discount || 0) / 100;
  const disc = Math.round((subtotal * discPct) * 100) / 100;
  const afterDisc = subtotal - disc;
  
  const taxPct = (appTaxRate || 0) / 100;
  const taxAmt = Math.round((afterDisc * taxPct) * 100) / 100;
  
  const total = Math.round((afterDisc + taxAmt) * 100) / 100;

  document.getElementById('order-subtotal').textContent = subtotal.toFixed(2);
  document.getElementById('order-discount-val').textContent = disc.toFixed(2);
  document.getElementById('order-total').textContent = total.toFixed(2);
  updateMobileCartBadge();
  calculateChange();
}

function resetOrder() {
  currentOrder = { items: [], table_id: null, customer_id: null, type: 'dine_in', discount: 0, note: '', payment_method: 'cash', cash_received: 0, attributes: {} };
  
  document.querySelectorAll('.btn-type').forEach(b => b.classList.remove('active'));
  const dBtn = document.querySelector('.btn-type[data-type="dine_in"]');
  if (dBtn) dBtn.classList.add('active');
  
  const delBtn = document.querySelector('.btn-type[data-type="delivery"]');
  if (delBtn) {
    delBtn.querySelector('.type-label').textContent = t('delivery');
    delBtn.querySelector('.type-detail')?.remove();
  }
  const tableSelect = document.getElementById('table-select');
  if (tableSelect) tableSelect.value = '';
  const noteInput = document.getElementById('order-note');
  if (noteInput) noteInput.value = '';
  const discountInput = document.getElementById('discount-input');
  if (discountInput) discountInput.value = '0';
  const cashInput = document.getElementById('cash-received-input');
  if (cashInput) cashInput.value = '';
  const paymentButton = document.getElementById('btn-select-payment');
  if (paymentButton) paymentButton.innerHTML = `💵 <span data-i18n="payment_cash">${t('payment_cash')}</span>`;
  renderOrderItems();
  updateOrderTotals();
}

async function saveOrder(printAfterSave = false) {
  if (saveOrder.busy) return;
  if (!currentUser?.token) { toast(t('login_error'),'error'); return; }
  if (!currentOrder.items.length) { toast(currentLang==='ar'?'أضف صنفًا أولًا':'Add an item first','error');return; }
  saveOrder.busy=true;
  currentOrder.offline_id ||= newRequestId();
  const payload={offline_id:currentOrder.offline_id,employee_id:currentUser.id,table_id:currentOrder.table_id,customer_id:currentOrder.customer_id,type:currentOrder.type,note:currentOrder.note||'',discount_percent:currentOrder.discount||0,discount_amount:0,payment_method:currentOrder.payment_method||'cash',items:currentOrder.items,status:'active',attributes:currentOrder.attributes||{},created_at:new Date().toISOString(),print_pending:printAfterSave};
  let saved;
  try {
    saved=await api('/api/orders','POST',payload);
    resetOrder();
    toast(currentLang==='ar'?'تم حفظ الطلب':'Order saved','success');
    await printProductionTickets(saved,saved.items);
    if(printAfterSave) await generateReceipt(saved);
    await loadTables();loadActiveOrders();
  } catch(error) {
    if(!saved && error.network) {
      try {
        await saveOfflineOrder({...payload,auth_token:currentUser.token});
        resetOrder();
        toast(currentLang==='ar'?'حُفظ على الجهاز؛ ينتظر المزامنة ولم يصل للمطبخ بعد':'Saved on device; pending sync and not yet sent to kitchen','info');
        document.getElementById('offline-bar').classList.remove('hidden');
      }catch(storageError){toast(currentLang==='ar'?'تعذر الحفظ على الجهاز؛ احتفظ بالطلب مفتوحًا':'Device storage failed; keep this order open','error');}
    }else toast(saved ? (currentLang==='ar'?'الطلب محفوظ؛ تعذرت الطباعة أو إعادة التحميل':'Order saved; printing or refresh failed') : error.message,'error');
  } finally {saveOrder.busy=false;}
}

function newRequestId() {
  const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
  return 'order_'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}


async function printOrder() {
  if (!currentOrder.items.length) {
    toast(currentLang === 'ar' ? 'أضف صنفاً قبل الطباعة' : 'Add items before printing', 'error');
    return;
  }
  await generateReceipt({
    ...currentOrder,
    total: getOrderTotal(),
    discount_percent: currentOrder.discount || 0,
    employee_name: currentUser?.name || '',
    created_at: new Date().toISOString()
  });
}

async function generateReceipt(order, targetPrinterType = 'cashier') {
  let s = {};
  try { s = await api('/api/settings'); } catch(e) {}
  const currency = getCurrency();
  const name = currentLang === 'ar' ? (s.restaurant_name || appRestaurantName || 'اسم المنشأة') : (s.restaurant_name_en || appRestaurantNameEn || s.restaurant_name || 'Your Business');
  const addr = s.restaurant_address || '';
  const phone = s.restaurant_phone || '';
  const taxNo = s.tax_number || '';
  
  const paymentLabels = {
    cash: currentLang === 'ar' ? '💵 نقداً (Cash)' : '💵 Cash',
    promptpay: '📱 PromptPay QR',
    truemoney: '💳 TrueMoney',
    card: currentLang === 'ar' ? '💳 بطاقة (Card)' : '💳 Card'
  };
  const payMethod = order.payment_method || 'cash';
  const payList = (typeof paymentMethodsList !== 'undefined') ? paymentMethodsList : [];
  const foundPay = payList.find(x => x.id === payMethod);
  const payLabel = foundPay ? foundPay.name : payMethod;

  const typeLabels = {
    dine_in: currentLang === 'ar' ? 'محلي / جلوس' : 'Dine In',
    takeaway: currentLang === 'ar' ? 'سفري / Takeaway' : 'Takeaway',
    delivery: currentLang === 'ar' ? 'توصيل / Delivery' : 'Delivery'
  };

  const invoiceNo = order.invoice_number || order.id || '-';
  let orderType = typeLabels[order.type] || order.type || '';
  if (order.type === 'delivery') {
    let attrs = {};
    if (typeof order.attributes === 'string') {
      try { attrs = JSON.parse(order.attributes); } catch(e) {}
    } else if (order.attributes) {
      attrs = order.attributes;
    }
    if (attrs.delivery_app) {
      orderType += ' - ' + attrs.delivery_app;
    }
  }
  const stationName = order.station_id === 'cashier_floor2' ? (currentLang === 'ar' ? 'كاشير الدور 2' : 'Floor 2 Cashier') : (currentLang === 'ar' ? 'كاشير الدور 1' : 'Floor 1 Cashier');

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
  <title>Receipt #${escapeHtml(invoiceNo)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      width: 76mm;
      margin: 0 auto;
      padding: 4mm 2mm;
      font-family: 'Readex Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif;
      font-size: 11px;
      color: #000;
      background: #fff;
      line-height: 1.3;
      text-align: center;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .restaurant-title {
      font-size: 14px;
      font-weight: 800;
      color: #000;
      margin-bottom: 3px;
      line-height: 1.25;
      text-transform: uppercase;
    }
    .header-info {
      font-size: 9.5px;
      font-weight: 500;
      color: #333;
      margin-bottom: 2px;
      line-height: 1.25;
    }
    .tax-badge {
      font-size: 9.5px;
      font-weight: 600;
      color: #000;
      margin-top: 2px;
      margin-bottom: 2px;
    }
    .dash-line {
      border-top: 1px dashed #000;
      margin: 5px 0;
    }
    .double-line {
      border-top: 2px solid #000;
      margin: 5px 0;
    }
    .bill-info {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      font-weight: 600;
      margin: 2px 0;
      text-align: right;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
      font-size: 10.5px;
    }
    .items-table th {
      border-bottom: 1px solid #000;
      padding: 3px 0;
      font-weight: 700;
    }
    .items-table td {
      padding: 3px 0;
      vertical-align: top;
    }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .text-center { text-align: center; }
    .total-section {
      margin-top: 4px;
      font-size: 11.5px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
    }
    .grand-total-row {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      font-weight: 800;
      padding: 3px 0;
      border-top: 1.5px solid #000;
      border-bottom: 1.5px solid #000;
      margin: 3px 0;
    }
    .payment-highlight {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 700;
      background: #f0f0f0;
      padding: 3px 6px;
      border-radius: 4px;
      margin: 3px 0;
    }
    .footer-text {
      margin-top: 6px;
      font-size: 9.5px;
      color: #333;
    }
    .drawer-kick {
      display: none;
    }
  </style>
</head>
<body>
  <div class="restaurant-title">${escapeHtml(name)}</div>
  ${addr ? `<div class="header-info">📍 ${escapeHtml(addr)}</div>` : ''}
  ${phone ? `<div class="header-info">📞 ${escapeHtml(phone)}</div>` : ''}
  ${taxNo ? `<div class="tax-badge">🏛️ ${currentLang === 'ar' ? 'الرقم الضريبي' : 'Tax / VAT ID'}: <strong>${escapeHtml(taxNo)}</strong></div>` : ''}
  
  <div class="dash-line"></div>
  
  <div class="bill-info">
    <span>${currentLang === 'ar' ? 'رقم الفاتورة' : 'Invoice #'}: <strong>${escapeHtml(invoiceNo)}</strong></span>
    <span>${escapeHtml(orderType)}</span>
  </div>
  <div class="bill-info">
    <span>${escapeHtml(stationName)}</span>
    <span>${order.table_number ? `${currentLang === 'ar' ? 'طاولة' : 'Table'}: <strong>${order.table_number}</strong>` : ''}</span>
  </div>
  <div class="bill-info">
    <span>${currentLang === 'ar' ? 'الكاشير' : 'Cashier'}: ${escapeHtml(order.employee_name || 'System')}</span>
    <span>${new Date(order.created_at || Date.now()).toLocaleTimeString(currentLang === 'ar' ? 'ar-SA' : 'en-US')}</span>
  </div>
  
  <div class="double-line"></div>
  
  <table class="items-table">
    <thead>
      <tr>
        <th class="text-right">${currentLang === 'ar' ? 'الصنف' : 'Item'}</th>
        <th class="text-center">${currentLang === 'ar' ? 'الكمية' : 'Qty'}</th>
        <th class="text-left">${currentLang === 'ar' ? 'الإجمالي' : 'Total'}</th>
      </tr>
    </thead>
    <tbody>
      ${(order.items || []).map(i => `
        <tr>
          <td class="text-right">
            <div><strong>${escapeHtml(currentLang === 'ar' ? (i.item_name || i.name) : (i.item_name_en || i.name_en || i.item_name || i.name))}</strong></div>
            <div style="font-size:9px;color:#555;">${i.price} ${escapeHtml(currency)}</div>
          </td>
          <td class="text-center" style="font-size:12px;font-weight:bold;">${i.quantity}</td>
          <td class="text-left" style="font-weight:bold;">${(i.price * i.quantity).toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <div class="double-line"></div>
  
  <div class="total-section">
    ${order.discount_percent > 0 ? `
      <div class="total-row">
        <span>${t('subtotal')}</span>
        <span>${(order.subtotal || ((order.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0))).toFixed(2)} ${escapeHtml(currency)}</span>
      </div>
      <div class="total-row">
        <span>${t('discount')} (${order.discount_percent}%)</span>
        <span>-${((order.subtotal || ((order.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0))) * (order.discount_percent/100)).toFixed(2)} ${escapeHtml(currency)}</span>
      </div>
    ` : ''}
    
    <div class="grand-total-row">
      <span>${currentLang === 'ar' ? 'المجموع الكلي' : 'TOTAL'}</span>
      <span>${(order.total || 0).toFixed(2)} ${escapeHtml(currency)}</span>
    </div>
    
    <div class="payment-highlight">
      <span>${currentLang === 'ar' ? 'طريقة الدفع' : 'Payment'}</span>
      <span>${escapeHtml(payLabel)}</span>
    </div>
    ${(payMethod === 'cash' && order.cash_received && order.cash_received >= (order.total || 0)) ? `
      <div class="total-row" style="font-size:10px;margin-top:2px;">
        <span>${currentLang === 'ar' ? 'المبلغ المدفوع' : 'Cash Tendered'}</span>
        <span>${parseFloat(order.cash_received).toFixed(2)} ${escapeHtml(currency)}</span>
      </div>
      <div class="total-row" style="font-size:10.5px;font-weight:700;color:#000;">
        <span>${currentLang === 'ar' ? 'المتبقي (الباقي)' : 'Change Return'}</span>
        <span>${(parseFloat(order.cash_received) - (order.total || 0)).toFixed(2)} ${escapeHtml(currency)}</span>
      </div>
    ` : ''}
  </div>
  
  <div class="dash-line"></div>
  <div class="footer-text">${s.receipt_footer || t('receipt_thank')}</div>
  <div style="font-size:9px;color:#888;margin-top:4px;">*** نظام نقاط البيع ***</div>
</body>
</html>`;

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.error('Print iframe error:', err);
    }
    setTimeout(() => { document.body.removeChild(iframe); }, 4000);
  }, 400);
}

async function printProductionTickets(order, orderItems) {
  let settings = {};
  try { settings = await api('/api/settings'); } catch (error) { return; }
  let printerConfigs = [];
  try { printerConfigs = JSON.parse(settings.printers_config || '[]'); } catch (error) { return; }

  for (const printer of printerConfigs) {
    if (!printer.auto_print || !Array.isArray(printer.category_ids) || !printer.category_ids.length) continue;
    const categoryIds = new Set(printer.category_ids.map(Number));
    const printerItems = orderItems.filter(item => categoryIds.has(Number(item.category_id)));
    if (printerItems.length) await generateProductionTicket(order, printer, printerItems);
  }
}

function generateProductionTicket(order, printer, ticketItems) {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const typeLabel = { dine_in: 'داخل المنشأة', takeaway: 'سفري', delivery: 'توصيل' }[order.type] || order.type || '';
  const table = order.table_number ? ` - طاولة ${escape(order.table_number)}` : '';
  const ticket = document.createElement('iframe');
  ticket.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0;';
  document.body.appendChild(ticket);
  const doc = ticket.contentWindow.document;
  doc.open();
  doc.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(escape(printer.name))}</title><style>@page{size:80mm auto;margin:0}body{width:76mm;margin:auto;padding:4mm 2mm;font-family:Arial,sans-serif;font-size:12px;color:#000}.head{text-align:center;font-weight:800;font-size:16px}.sub{text-align:center;margin:5px 0;border-bottom:1px dashed #000;padding-bottom:5px}.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #ddd}.note{font-size:10px;color:#a11;margin-top:3px}</style></head><body><div class="head">طلب إنتاج — ${escapeHtml(escape(printer.name))}</div><div class="sub">#${escape(order.invoice_number || order.id)} ${escape(typeLabel)}${table}<br>${new Date(order.created_at || Date.now()).toLocaleTimeString('ar-SA')}</div>${ticketItems.map(item => `<div class="row"><span><b>${escapeHtml(escape(item.name || item.item_name))}</b>${item.note ? `<div class="note">${escapeHtml(escape(item.note))}</div>` : ''}</span><b>× ${escape(item.quantity)}</b></div>`).join('')}<div class="sub">${escapeHtml(escape(order.note || ''))}</div></body></html>`);
  doc.close();
  setTimeout(() => {
    try { ticket.contentWindow.focus(); ticket.contentWindow.print(); } catch (error) { console.error('Production print error:', error); }
    setTimeout(() => ticket.remove(), 4000);
  }, 350);
}

// ===== Active Orders =====
async function loadActiveOrders() {
  const container = document.getElementById('active-orders-list');
  if (!container) return;

  try {
    const orders = await api('/api/orders?status=active&with_items=1');
    if (!orders || orders.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:40px;color:#999;">${t('no_active_orders')}</div>`;
      return;
    }
    const curr = getCurrency();
    container.innerHTML = orders.map(o => {
      const list = (o.items || []).map(i => `${i.quantity}× ${escapeHtml(currentLang === 'ar' ? (i.item_name || i.name) : (i.item_name_en || i.name_en || i.item_name || i.name))}`).join(', ');
      return `<div class="active-order-card" data-id="${o.id}">
        <div class="order-card-header"><span class="order-card-id">#${o.invoice_number || o.id}</span><span class="order-card-table">${o.table_number ? (currentLang === 'ar' ? 'طاولة ' : 'Table ') + o.table_number : (currentLang === 'ar' ? (o.type === 'takeaway' ? 'سفري' : o.type) : o.type)}</span></div>
        <div class="order-card-items">${list || '---'}</div>
        <div class="order-card-total">${(o.total || 0).toFixed(2)} ${curr}</div>
        <div class="order-card-emp" style="font-size:11px;color:#999;">${escapeHtml(o.employee_name || '')}</div>
        <div class="order-card-time">${parsePOSDate(o.created_at).toLocaleTimeString(currentLang === 'ar' ? 'ar-SA' : 'en-US')}</div>
        <div class="order-card-actions">
          <button class="btn-pay" onclick="openPayOrderModal(${o.id})">💳 ${t('order_pay')}</button>
          <button class="btn-print-order" onclick="printExistingOrder(${o.id})">🖨️ ${t('order_print')}</button>
          <button class="btn-cancel-order" onclick="cancelOrder(${o.id})">✕ ${t('order_cancel')}</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    console.error('Load active orders error:', e);
  }
}

// Payment modal for Active Orders: Review/Edit items (Add/Delete/Qty) -> Select Payment Method -> Pay -> Auto-Print Receipt -> Complete Order & Audit
async function openPayOrderModal(orderId) {
  try {
    const order = await api(`/api/orders/${orderId}`);
    if (!order) throw new Error('Order not found');

    let allMenuItems = items;
    if (!allMenuItems || allMenuItems.length === 0) {
      try {
        allMenuItems = await api('/api/items');
      } catch(e) {
        allMenuItems = [];
      }
    }

    // Clone order items for live editing in the modal
    let editOrderItems = (order.items || []).map(i => ({
      item_id: i.item_id,
      name: i.item_name || i.name,
      name_en: i.item_name_en || i.name_en || i.name,
      price: parseFloat(i.price) || 0,
      quantity: parseInt(i.quantity) || 1,
      note: i.note || ''
    }));

    const curr = getCurrency();
    const orderTitle = (order.table_number ? (currentLang === 'ar' ? 'طاولة ' : 'Table ') + order.table_number : (order.invoice_number ? '#' + order.invoice_number : '#' + order.id));
    const modalTitle = currentLang === 'ar' ? `دفع ومراجعة الفاتورة (${orderTitle})` : `Settle & Review Bill (${orderTitle})`;

    function calcCurrentTotal() {
      let sub = 0;
      editOrderItems.forEach(it => { sub += (it.price * it.quantity); });
      const disc = sub * ((order.discount_percent || 0) / 100);
      return Math.max(0, sub - disc);
    }

    const modalHtml = `
      <div style="padding:4px 0;">
        <!-- Order info & total header -->
        <div style="background:var(--bg-subtle, #f8f9fa);padding:12px 14px;border-radius:8px;margin-bottom:12px;border:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px;">
            <span>${currentLang === 'ar' ? 'رقم الفاتورة:' : 'Invoice No:'} <strong>#${order.invoice_number || order.id}</strong></span>
            <span style="color:var(--text-light);">${order.table_number ? (currentLang === 'ar' ? 'طاولة ' : 'Table ') + order.table_number : (order.type === 'takeaway' ? (currentLang === 'ar' ? 'سفري' : 'Takeaway') : order.type)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;color:var(--primary);">
            <span>${t('total')}:</span>
            <span id="modal-live-total">${calcCurrentTotal().toFixed(2)} ${curr}</span>
          </div>
        </div>

        <!-- Inline Items Edit Section -->
        <div style="margin-bottom:14px;border:1px solid var(--border);border-radius:8px;padding:10px;background:var(--card);">
          <div style="font-size:12.5px;font-weight:700;color:var(--text);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
            <span>📋 ${t('order_items_review')}</span>
            <span style="font-size:11px;color:var(--text-light);">(${currentLang === 'ar' ? 'يمكنك زيادة/نقص أو إضافة وحذف' : 'adjust items & quantities'})</span>
          </div>

          <div id="modal-order-items-list" style="max-height:160px;overflow-y:auto;margin-bottom:8px;"></div>

          <!-- Search & Add Item Section -->
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
        </div>

        <!-- Payment Method Selection -->
        <label style="display:block;font-weight:700;font-size:13px;margin-bottom:6px;">${t('select_payment')}:</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
          <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;background:var(--card);font-weight:600;font-size:13px;">
            <input type="radio" name="pay-method-radio" value="cash" checked style="transform:scale(1.2);">
            <span>💵 ${t('payment_cash')}</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;background:var(--card);font-weight:600;font-size:13px;">
            <input type="radio" name="pay-method-radio" value="promptpay" style="transform:scale(1.2);">
            <span>📱 PromptPay</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;background:var(--card);font-weight:600;font-size:13px;">
            <input type="radio" name="pay-method-radio" value="card" style="transform:scale(1.2);">
            <span>💳 ${t('payment_card')}</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;background:var(--card);font-weight:600;font-size:13px;">
            <input type="radio" name="pay-method-radio" value="truemoney" style="transform:scale(1.2);">
            <span>💳 TrueMoney</span>
          </label>
        </div>

        <div id="modal-cash-section" style="margin-bottom:12px;">
          <label style="display:block;font-weight:600;font-size:12.5px;margin-bottom:4px;">${t('cash_received')}:</label>
          <input type="number" id="modal-cash-tendered" value="${calcCurrentTotal().toFixed(2)}" step="any" style="width:100%;padding:9px;font-size:16px;font-weight:800;border:1.5px solid var(--border);border-radius:6px;">
        </div>

        <div style="background:#e8f5e9;padding:9px 12px;border-radius:6px;display:flex;align-items:center;gap:8px;color:#2e7d32;font-size:12px;font-weight:600;">
          <span>🖨️</span>
          <span>${currentLang === 'ar' ? 'سيتم حفظ التعديلات وطباعة الإيصال الحراري فوراً وتسجيل كل حركة بالتدقيق اليومي' : 'Changes, print and audit will be saved immediately'}</span>
        </div>
      </div>
    `;

    openModal(
      modalTitle, 
      modalHtml, 
      async () => {
        if (editOrderItems.length === 0) {
          throw new Error(currentLang === 'ar' ? 'لا يمكن إتمام الفاتورة بدون أصناف' : 'Order must contain at least one item');
        }

        const selectedRadio = document.querySelector('input[name="pay-method-radio"]:checked');
        const selectedMethod = selectedRadio ? selectedRadio.value : 'cash';
        const finalTotal = calcCurrentTotal();
        const cashInput = document.getElementById('modal-cash-tendered');
        const cashPaid = cashInput ? (parseFloat(cashInput.value) || finalTotal) : finalTotal;
        const changeDue = Math.max(0, cashPaid - finalTotal);

        const empId = (currentUser && currentUser.id) ? currentUser.id : 1;
        const empName = (currentUser && currentUser.name) ? currentUser.name : 'الكاشير';

        // 1. Send update to server with final modified items & completed status
        const fullCompletedOrder = await api(`/api/orders/${orderId}`, 'PUT', {
          version: order.version,
          status: 'completed',
          payment_method: selectedMethod,
          total: finalTotal,
          paid_amount: cashPaid,
          change_amount: changeDue,
          employee_id: empId,
          employee_name: empName,
          items: editOrderItems
        });

        // 2. Automatically print customer thermal receipt
        generateReceipt(fullCompletedOrder);

        toast(currentLang === 'ar' ? `✅ تم الدفع والتعديل وطباعة الفاتورة بنجاح #${order.invoice_number || order.id}` : `✅ Paid & Printed #${order.invoice_number || order.id}`, 'success');
        loadActiveOrders();
        loadTables();
      },
      currentLang === 'ar' ? '💳 تأكيد الدفع والطباعة' : '💳 Settle & Print'
    );

    // Setup interactive item controls in the modal
    function renderModalItemsList() {
      const listEl = document.getElementById('modal-order-items-list');
      if (!listEl) return;

      if (editOrderItems.length === 0) {
        listEl.innerHTML = `<div style="text-align:center;padding:12px;color:#999;font-size:12px;">${t('add_items')}</div>`;
      } else {
        listEl.innerHTML = editOrderItems.map((item, idx) => `
          <div class="edit-item-row" style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:12.5px;">
            <span style="flex:1;font-weight:600;">${escapeHtml(currentLang === 'ar' ? item.name : (item.name_en || item.name))}</span>
            <button type="button" class="qty-btn minus modal-qty-minus" data-idx="${idx}" style="width:24px;height:24px;font-size:13px;border-radius:4px;cursor:pointer;">−</button>
            <span style="min-width:18px;text-align:center;font-weight:700;">${item.quantity}</span>
            <button type="button" class="qty-btn plus modal-qty-plus" data-idx="${idx}" style="width:24px;height:24px;font-size:13px;border-radius:4px;cursor:pointer;">+</button>
            <span style="min-width:65px;text-align:left;font-weight:700;color:var(--primary);">${(item.price * item.quantity).toFixed(2)} ${curr}</span>
            <button type="button" class="order-item-delete modal-item-del" data-idx="${idx}" style="background:none;border:none;color:#dc3545;cursor:pointer;font-weight:700;padding:2px 6px;">✕</button>
          </div>
        `).join('');
      }

      // Live update total
      const newTotal = calcCurrentTotal();
      const liveTotalEl = document.getElementById('modal-live-total');
      if (liveTotalEl) liveTotalEl.textContent = `${newTotal.toFixed(2)} ${curr}`;
      const cashInp = document.getElementById('modal-cash-tendered');
      if (cashInp) cashInp.value = newTotal.toFixed(2);

      // Bind minus
      listEl.querySelectorAll('.modal-qty-minus').forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.dataset.idx);
          if (editOrderItems[idx].quantity > 1) {
            editOrderItems[idx].quantity--;
          } else {
            editOrderItems.splice(idx, 1);
          }
          renderModalItemsList();
        };
      });

      // Bind plus
      listEl.querySelectorAll('.modal-qty-plus').forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.dataset.idx);
          editOrderItems[idx].quantity++;
          renderModalItemsList();
        };
      });

      // Bind delete
      listEl.querySelectorAll('.modal-item-del').forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.dataset.idx);
          editOrderItems.splice(idx, 1);
          renderModalItemsList();
        };
      });
    }

    renderModalItemsList();

    // Setup real-time search filter for menu items in modal
    const searchInput = document.getElementById('modal-item-search-input');
    const selectEl = document.getElementById('modal-add-item-select');
    
    function filterModalOptions(query) {
      if (!selectEl) return;
      const q = (query || '').trim().toLowerCase();
      const activeItems = allMenuItems.filter(i => i.active !== 0);
      const filtered = q ? activeItems.filter(i => 
        (i.name && i.name.toLowerCase().includes(q)) || 
        (i.name_en && i.name_en.toLowerCase().includes(q)) ||
        (i.id && String(i.id).includes(q))
      ) : activeItems;

      selectEl.innerHTML = `
        <option value="">-- ${t('choose_item')} (${filtered.length}) --</option>
        ${filtered.map(i => `<option value="${i.id}" data-name="${escapeHtml(i.name)}" data-name-en="${escapeHtml(i.name_en || i.name)}" data-price="${i.price}">${escapeHtml(i.name)} (${i.price} ${curr})</option>`).join('')}
      `;

      if (q && filtered.length > 0) {
        selectEl.selectedIndex = 1; // Auto select first search match
      }
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        filterModalOptions(e.target.value);
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const addBtn = document.getElementById('modal-btn-add-item');
          if (addBtn) addBtn.click();
        }
      });
    }

    // Bind Add item button
    const addBtn = document.getElementById('modal-btn-add-item');
    if (addBtn) {
      addBtn.onclick = () => {
        const sel = document.getElementById('modal-add-item-select');
        if (!sel || !sel.value) return;
        const opt = sel.options[sel.selectedIndex];
        const itemId = parseInt(sel.value);
        const name = opt.dataset.name;
        const nameEn = opt.dataset.nameEn;
        const price = parseFloat(opt.dataset.price) || 0;

        const existingIdx = editOrderItems.findIndex(i => i.item_id === itemId);
        if (existingIdx >= 0) {
          editOrderItems[existingIdx].quantity++;
        } else {
          editOrderItems.push({
            item_id: itemId,
            name: name,
            name_en: nameEn,
            price: price,
            quantity: 1,
            note: ''
          });
        }
        
        // Reset search input and refresh dropdown
        if (searchInput) {
          searchInput.value = '';
          filterModalOptions('');
          searchInput.focus();
        } else {
          sel.value = '';
        }
        renderModalItemsList();
      };
    }

  } catch (err) {
    console.error('Open pay modal error:', err);
    toast(t('error') + ': ' + (err.message || ''), 'error');
  }
}

async function completeOrder(id) {
  const latest=await api("/api/orders/"+id);
  try {
    const empId = (currentUser && currentUser.id) ? currentUser.id : 1;
    const empName = (currentUser && currentUser.name) ? currentUser.name : 'الكاشير';

    await api(`/api/orders/${id}`, 'PUT', {
      version:latest.version,
      status: 'completed',
      employee_id: empId,
      employee_name: empName
    });

    toast(t('order_completed'), 'success');
    loadActiveOrders();
    loadTables();
  } catch (err) {
    console.error('Complete order error:', err);
    toast(t('error') + ': ' + (err.message || ''), 'error');
  }
}

async function cancelOrder(id) {
  const latest=await api("/api/orders/"+id);
  if (!confirm(t('confirm_delete'))) return;
  const empId = (currentUser && currentUser.id) ? currentUser.id : 1;
  const empName = (currentUser && currentUser.name) ? currentUser.name : 'الكاشير';
  await api(`/api/orders/${id}`, 'PUT', { version:latest.version, status: 'cancelled', employee_id: empId, employee_name: empName });
  toast(t('order_cancel'), 'error');
  loadActiveOrders();
  loadTables();
}

async function printExistingOrder(id) {
  const o = await api(`/api/orders/${id}`);
  generateReceipt(o);
}

// ===== Customer Loyalty & CRM =====
async function loadCustomersDropdown() {
  try {
    const customers = await api('/api/customers');
    const select = document.getElementById('customer-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- اختيار عميل --</option>';
    customers.forEach(c => {
      select.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.phone)}) - ${c.points || 0} pts</option>`;
    });
  } catch (err) {
    console.error('Failed to load customers:', err);
  }
}

function openCustomerModal() {
  document.getElementById('customer-modal').style.display = 'flex';
  document.getElementById('cust-name').value = '';
  document.getElementById('cust-phone').value = '';
  document.getElementById('cust-email').value = '';
}

function closeCustomerModal() {
  document.getElementById('customer-modal').style.display = 'none';
}

async function saveCustomer() {
  const name = document.getElementById('cust-name').value;
  const phone = document.getElementById('cust-phone').value;
  const email = document.getElementById('cust-email').value;

  if (!name || !phone) return alert('الاسم ورقم الجوال مطلوبان (Name & Phone required)');

  try {
    const res = await api('/api/customers', 'POST', { name, phone, email });
    if (res.id) {
      closeCustomerModal();
      toast('تم حفظ العميل بنجاح (Customer saved)', 'success');
      loadCustomersDropdown();
      // Auto-select the newly created customer
      setTimeout(() => {
        const select = document.getElementById('customer-select');
        if (select) {
          select.value = res.id;
          currentOrder.customer_id = res.id;
        }
      }, 500);
    }
  } catch (err) {
    console.error(err);
    toast('خطأ في حفظ العميل (Error saving customer)', 'error');
  }
}
// ===== Dynamic Method Modal Logic =====
function openPaymentMethodModal() {
  const container = document.getElementById('payment-buttons-container');
  container.innerHTML = '';
  const methods = (typeof paymentMethodsList !== 'undefined' && paymentMethodsList.length > 0) ? paymentMethodsList : [{id:'cash', name:'نقداً (Cash)'}];
  methods.forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.style.margin = '5px';
    btn.style.minWidth = '120px';
    btn.textContent = m.name;
    btn.onclick = () => {
      currentOrder.payment_method = m.id;
      document.getElementById('btn-select-payment').textContent = m.name;
      toggleCashCalculator(m.id === 'cash');
      closePaymentSelectModal();
      updateOrderTotals();
    };
    container.appendChild(btn);
  });
  document.getElementById('payment-select-modal').style.display = 'flex';
}

function closePaymentSelectModal() {
  document.getElementById('payment-select-modal').style.display = 'none';
}

function openDeliverySelectModal() {
  const container = document.getElementById('delivery-buttons-container');
  container.innerHTML = '';
  const methods = (typeof deliveryMethodsList !== 'undefined' && deliveryMethodsList.length > 0) ? deliveryMethodsList : [{id:'delivery', name:'توصيل عام (General Delivery)'}];
  methods.forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.style.margin = '5px';
    btn.style.minWidth = '120px';
    btn.textContent = m.name;
    btn.onclick = () => {
      currentOrder.type = 'delivery';
      currentOrder.attributes = currentOrder.attributes || {};
      currentOrder.attributes.delivery_app = m.name;
      document.querySelectorAll('.btn-type').forEach(b => b.classList.remove('active'));
      const delBtn = document.querySelector('.btn-type[data-type="delivery"]');
      if (delBtn) {
        delBtn.classList.add('active');
        delBtn.querySelector('.type-label').textContent = t('delivery');
        delBtn.querySelector('.type-detail')?.remove();
        const detail = document.createElement('span');
        detail.className = 'type-detail';
        detail.textContent = m.name;
        delBtn.appendChild(detail);
      }
      closeDeliverySelectModal();
    };
    container.appendChild(btn);
  });
  document.getElementById('delivery-select-modal').style.display = 'flex';
}

function closeDeliverySelectModal() {
  document.getElementById('delivery-select-modal').style.display = 'none';
}

document.querySelectorAll('.btn-type').forEach(btn => {
  btn.onclick = () => selectOrderType(btn.dataset.type);
});
