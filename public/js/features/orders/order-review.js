// Active-order item review and editing for payment modal.
// Extracted from order-payment.js for modular organization.

function calcCurrentTotal(editOrderItems, order) {
  let sub = 0;
  editOrderItems.forEach(it => { sub += (it.price * it.quantity); });
  const disc = sub * ((order.discount_percent || 0) / 100);
  const afterDisc = Math.max(0, sub - disc);
  const taxRate = order.tax_percent !== undefined ? order.tax_percent : (window.settings?.tax_rate || 0);
  const taxType = window.settings?.tax_type || 'exclusive';
  if (taxType === 'exclusive' && taxRate > 0) {
    return afterDisc + (afterDisc * (taxRate / 100));
  }
  return afterDisc;
}

function renderModalItemsList(editOrderItems, allMenuItems, currentLang, curr, t, escapeHtml) {
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
  const totalEl = document.getElementById('modal-live-total');
  const dueEl = document.getElementById('modal-payment-due');
  if (totalEl && window.__paymentReviewOrder) {
    const total = calcCurrentTotal(editOrderItems, window.__paymentReviewOrder);
    totalEl.textContent = `${total.toFixed(2)} ${curr}`;
    if (dueEl) {
      const paid = parseFloat(document.getElementById('modal-cash-tendered')?.value) || 0;
      const delta = paid - total;
      dueEl.textContent = delta >= 0 ? `${t('change_due')}: ${delta.toFixed(2)} ${curr}` : `${t('remaining_due')}: ${Math.abs(delta).toFixed(2)} ${curr}`;
    }
  }
}

function filterModalOptions(query, allMenuItems, selectEl, currentLang, t, escapeHtml, curr) {
  if (!selectEl) return;
  const q = (query || '').trim().toLowerCase();
  const activeItems = allMenuItems.filter(i => i.active !== 0);
  const filtered = q ? activeItems.filter(i =>
    (i.name && i.name.toLowerCase().includes(q)) ||
    (i.name_en && i.name_en.toLowerCase().includes(q)) ||
    (i.id && String(i.id).includes(q))
  ) : activeItems;
  selectEl.innerHTML = `<option value="">-- ${t('choose_item')} (${filtered.length}) --</option>` +
    filtered.map(i => `<option value="${i.id}" data-name="${escapeHtml(i.name)}" data-name-en="${escapeHtml(i.name_en || i.name)}" data-price="${i.price}">${escapeHtml(i.name)} (${i.price} ${curr})</option>`).join('');
  if (q && filtered.length > 0) { selectEl.selectedIndex = 1; }
}

function setupModalItemControls(editOrderItems, allMenuItems, currentLang, curr, t, escapeHtml) {
  renderModalItemsList(editOrderItems, allMenuItems, currentLang, curr, t, escapeHtml);

  const searchInput = document.getElementById('modal-item-search-input');
  const selectEl = document.getElementById('modal-add-item-select');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => { filterModalOptions(e.target.value, allMenuItems, selectEl, currentLang, t, escapeHtml, curr); });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); const addBtn = document.getElementById('modal-btn-add-item'); if (addBtn) addBtn.click(); }
    });
  }

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
      if (existingIdx >= 0) { editOrderItems[existingIdx].quantity++; }
      else { editOrderItems.push({ item_id: itemId, name, name_en: nameEn, price, quantity: 1, note: '' }); }
      if (searchInput) { searchInput.value = ''; filterModalOptions('', allMenuItems, selectEl, currentLang, t, escapeHtml, curr); searchInput.focus(); }
      else { sel.value = ''; }
      renderModalItemsList(editOrderItems, allMenuItems, currentLang, curr, t, escapeHtml);
    };
  }
}
