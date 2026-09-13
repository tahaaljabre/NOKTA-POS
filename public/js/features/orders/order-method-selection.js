// Payment-method and delivery-method selection modals.
// ===== Dynamic Method Modal Logic =====
function openPaymentMethodModal() {
  const container = document.getElementById('payment-buttons-container');
  container.innerHTML = '';
  const appOrder = currentOrder.type === 'delivery' && currentOrder.attributes?.delivery_app_id;
  const methods = appOrder
    ? [{ id: 'platform', name: t('platform_collection') }]
    : ((typeof paymentMethodsList !== 'undefined' && paymentMethodsList.length > 0) ? paymentMethodsList : [{id:'cash', name:'نقداً (Cash)'}]);
  methods.filter(m => m.active !== false).forEach(m => {
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
  methods.filter(m => m.active !== false).forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.style.margin = '5px';
    btn.style.minWidth = '120px';
    btn.textContent = m.name;
    btn.onclick = () => {
      currentOrder.type = 'delivery';
      currentOrder.attributes = currentOrder.attributes || {};
      currentOrder.attributes.delivery_app_id = m.id;
      currentOrder.attributes.delivery_app = m.name;
      currentOrder.payment_method = 'platform';
      document.getElementById('btn-select-payment').textContent = t('platform_collection');
      toggleCashCalculator(false);
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

function setupOrderMethodSelection() {
  document.querySelectorAll('.btn-type').forEach(btn => {
    btn.onclick = () => selectOrderType(btn.dataset.type);
  });
}
