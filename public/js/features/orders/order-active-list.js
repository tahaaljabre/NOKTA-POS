// Active-order list rendering and actions.
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
          ${ (o.paid_amount >= o.total - 0.01) ? 
             `<button class="btn-pay" style="background:#28a745;color:white;" onclick="completePrepaidOrder(${o.id})">✔️ ${t('order_done')}</button>` :
             `<button class="btn-pay" onclick="openPayOrderModal(${o.id})">💳 ${t('order_pay')}</button>` }
          <button class="btn-print-order" onclick="printExistingOrder(${o.id})">🖨️ ${t('order_print')}</button>
          <button class="btn-cancel-order" onclick="cancelOrder(${o.id})">✕ ${t('order_cancel')}</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    console.error('Load active orders error:', e);
  }
}
