// Cart rendering, mobile cart navigation, order type, totals, and reset.
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
  const chk = document.getElementById('chk-prepaid');
  if (chk) chk.checked = false;
  renderOrderItems();
  updateOrderTotals();
}
