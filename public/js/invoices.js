// ===== Invoices =====
async function loadInvoices(page = 1) {
  const date = document.getElementById('invoice-date-filter')?.value || '';
  const empId = document.getElementById('invoice-employee-filter')?.value || '';
  const search = document.getElementById('invoice-search')?.value || '';

  let url = `/api/invoices?page=${page}&limit=50`;
  if (date) url += `&date=${date}`;
  if (empId) url += `&employee_id=${empId}`;
  if (search) url += `&search=${search}`;

  const data = await api(url);
  const container = document.getElementById('invoices-list');
  if (!data.orders || data.orders.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#999;">${currentLang === 'ar' ? 'لا توجد فواتير' : 'No invoices'}</div>`;
    return;
  }

  const currency = getCurrency();

  container.innerHTML = `
    <div class="invoices-summary">
      <span>${data.total} ${currentLang === 'ar' ? 'فاتورة' : 'invoices'}</span>
    </div>
    <div class="invoices-table-wrapper">
      <table class="admin-table">
        <thead><tr>
          <th>#</th>
          <th>${currentLang === 'ar' ? 'التاريخ' : 'Date'}</th>
          <th>${currentLang === 'ar' ? 'النوع' : 'Type'}</th>
          <th>${currentLang === 'ar' ? 'الطاولة' : 'Table'}</th>
          <th>${currentLang === 'ar' ? 'الاجمالي' : 'Total'}</th>
          <th>${currentLang === 'ar' ? 'الدفع' : 'Payment'}</th>
          <th>${currentLang === 'ar' ? 'الحالة' : 'Status'}</th>
          <th>${currentLang === 'ar' ? 'إجراءات' : 'Actions'}</th>
        </tr></thead>
        <tbody>${data.orders.map(o => {
          const payLabels = { cash: '💵', promptpay: '📱', truemoney: '💳', card: '💳' };
          const typeLabels = { dine_in: t('dine_in'), takeaway: t('takeaway'), delivery: t('delivery') };
          const statusClass = o.status === 'completed' ? 'status-active' : 'status-inactive';
          const statusText = o.status === 'completed' ? (currentLang === 'ar' ? 'مكتمل' : 'Completed') : (currentLang === 'ar' ? 'ملغي' : 'Cancelled');
          return `<tr class="${o.is_deleted ? 'row-deleted' : ''}">
            <td><strong>#${o.invoice_number || o.id}</strong></td>
            <td style="font-size:11px;">${parsePOSDate(o.created_at).toLocaleString(currentLang === 'ar' ? 'ar-SA' : 'en-US')}</td>
            <td>${typeLabels[o.type] || o.type}</td>
            <td>${o.table_number || '-'}</td>
            <td><strong>${(o.total || 0).toFixed(2)} ${escapeHtml(currency)}</strong></td>
            <td>${escapeHtml(payLabels[o.payment_method] || '💵')}</td>
            <td class="${statusClass}">${statusText}</td>
            <td class="action-btns">
              <button class="btn-edit" onclick="printExistingOrder(${o.id})">🖨️ ${currentLang === 'ar' ? 'طباعة' : 'Print'}</button>
              <button class="btn-edit" onclick="viewInvoice(${o.id})">${currentLang === 'ar' ? 'عرض' : 'View'}</button>
              ${o.status === 'completed' && !o.is_deleted ? `<button class="btn-edit" onclick="editInvoice(${o.id})">${currentLang === 'ar' ? 'تعديل' : 'Edit'}</button>` : ''}
              ${!o.is_deleted ? `<button class="btn-delete" onclick="deleteInvoice(${o.id})">${currentLang === 'ar' ? 'حذف' : 'Delete'}</button>` : ''}
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>
  `;
}

async function viewInvoice(id) {
  const order = await api(`/api/orders/${id}`);
  if (!order) return;
  const s = await api('/api/settings');
  const currency = s.currency || '฿';
  const name = currentLang === 'ar' ? (s.restaurant_name || '') : (s.restaurant_name_en || s.restaurant_name || '');
  const payLabels = { cash: t('payment_cash'), promptpay: t('payment_promptpay'), truemoney: t('payment_truemoney'), card: t('payment_card') };

  openModal(`${currentLang === 'ar' ? 'فاتورة' : 'Invoice'} #${order.invoice_number || order.id}`, `
    <div class="invoice-view">
      <p><strong>${escapeHtml(name)}</strong></p>
      <p>${currentLang === 'ar' ? 'رقم الفاتورة' : 'Invoice #'}: <strong>${order.invoice_number || order.id}</strong></p>
      <p>${currentLang === 'ar' ? 'التاريخ' : 'Date'}: ${parsePOSDate(order.created_at).toLocaleString(currentLang === 'ar' ? 'ar-SA' : 'en-US')}</p>
      <p>${currentLang === 'ar' ? 'النوع' : 'Type'}: ${order.type === 'dine_in' ? t('dine_in') : order.type === 'takeaway' ? t('takeaway') : t('delivery')}</p>
      ${order.table_number ? `<p>${currentLang === 'ar' ? 'الطاولة' : 'Table'}: ${order.table_number}</p>` : ''}
      <p>${currentLang === 'ar' ? 'الموظف' : 'Employee'}: ${escapeHtml(order.employee_name || '-')}</p>
      <div class="line"></div>
      <table style="width:100%;font-size:13px;">
        <thead><tr><th style="text-align:right;">${currentLang === 'ar' ? 'الصنف' : 'Item'}</th><th>Qty</th><th>${currentLang === 'ar' ? 'السعر' : 'Price'}</th><th>${currentLang === 'ar' ? 'الاجمالي' : 'Total'}</th></tr></thead>
        <tbody>${(order.items || []).map(i => `<tr><td>${escapeHtml(currentLang === 'ar' ? i.item_name : (i.item_name_en || i.item_name))}</td><td>${i.quantity}</td><td>${i.price}</td><td>${(i.price * i.quantity).toFixed(2)}</td></tr>`).join('')}</tbody>
      </table>
      <div class="line"></div>
      ${order.discount_percent > 0 ? `<p>${t('discount')}: ${order.discount_percent}%</p>` : ''}
      <p style="font-size:16px;font-weight:bold;">${currentLang === 'ar' ? 'الاجمالي' : 'Total'}: ${(order.total || 0).toFixed(2)} ${escapeHtml(currency)}</p>
      <p>${currentLang === 'ar' ? 'طريقة الدفع' : 'Payment'}: ${escapeHtml(payLabels[order.payment_method] || order.payment_method)}</p>
      <div style="margin-top:14px;text-align:center;">
        <button class="btn btn-save" onclick="printExistingOrder(${order.id})" style="width:100%;">🖨️ ${currentLang === 'ar' ? 'طباعة الفاتورة الحرارية' : 'Print Thermal Receipt'}</button>
      </div>
    </div>
  `, null);
}

async function editInvoice(id) {
  if (!checkPermission('edit_orders')) return toast(t('no_permission'), 'error');
  const order = await api(`/api/orders/${id}`);
  if (!order) return;
  if (order.status !== 'completed') return toast(currentLang === 'ar' ? 'يمكن تعديل الفواتير المكتملة فقط' : 'Only completed invoices can be edited', 'error');

  const s = await api('/api/settings');
  const currency = s.currency || '฿';
  const allItems = await api('/api/items');

  // Load current items
  let editItems = (order.items || []).map(i => ({
    order_item_id: i.id,
    item_id: i.item_id,
    name: i.item_name,
    name_en: i.item_name_en,
    quantity: i.quantity,
    price: i.price
  }));

  function renderEditItems() {
    const container = document.getElementById('edit-invoice-items');
    container.innerHTML = editItems.map((item, idx) => `
      <div class="edit-item-row">
        <span>${escapeHtml(currentLang === 'ar' ? item.name : (item.name_en || item.name))}</span>
        <button class="qty-btn minus" data-idx="${idx}">−</button>
        <span>${item.quantity}</span>
        <button class="qty-btn plus" data-idx="${idx}">+</button>
        <span>${(item.price * item.quantity).toFixed(2)} ${escapeHtml(currency)}</span>
        <button class="order-item-delete" data-idx="${idx}">✕</button>
      </div>
    `).join('');

    container.querySelectorAll('.qty-btn.minus').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.idx);
        if (editItems[idx].quantity > 1) editItems[idx].quantity--;
        else editItems.splice(idx, 1);
        renderEditItems();
      };
    });
    container.querySelectorAll('.qty-btn.plus').forEach(btn => {
      btn.onclick = () => {
        editItems[parseInt(btn.dataset.idx)].quantity++;
        renderEditItems();
      };
    });
    container.querySelectorAll('.order-item-delete').forEach(btn => {
      btn.onclick = () => {
        editItems.splice(parseInt(btn.dataset.idx), 1);
        renderEditItems();
      };
    });
  }

  openModal(`${currentLang === 'ar' ? 'تعديل فاتورة' : 'Edit Invoice'} #${order.invoice_number || order.id}`, `
    <div id="edit-invoice-items"></div>
    <label>${currentLang === 'ar' ? 'إضافة صنف' : 'Add Item'}</label>
    <select id="edit-add-item">
      <option value="">-- ${currentLang === 'ar' ? 'اختر صنف' : 'Choose item'} --</option>
      ${allItems.filter(i => i.active).map(i => `<option value="${i.id}" data-price="${i.price}">${escapeHtml(i.name)} - ${i.price} ${escapeHtml(currency)}</option>`).join('')}
    </select>
  `, async () => {
    // Recalculate total
    let newTotal = 0;
    editItems.forEach(i => { newTotal += i.price * i.quantity; });
    newTotal = newTotal * (1 - (order.discount_percent || 0) / 100);

    await api('/api/orders/'+id, 'PUT', {version:order.version, items:editItems, note:order.note, discount_percent:order.discount_percent, payment_method:order.payment_method});
    toast(t('saved'), 'success');
    loadInvoices();
  });

  renderEditItems();

  // Add item dropdown
  document.getElementById('edit-add-item').onchange = (e) => {
    const itemId = parseInt(e.target.value);
    if (!itemId) return;
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;
    const existing = editItems.find(i => i.item_id === itemId);
    if (existing) existing.quantity++;
    else editItems.push({ item_id: itemId, name: item.name, name_en: item.name_en, quantity: 1, price: item.price });
    renderEditItems();
    e.target.value = '';
  };
}

async function deleteInvoice(id) {
  if (!checkPermission('delete_orders')) return toast(t('no_permission'), 'error');
  if (!confirm(currentLang === 'ar' ? 'هل تريد حذف هذه الفاتورة نهائياً؟' : 'Permanently delete this invoice?')) return;
  await api(`/api/orders/${id}`, 'DELETE');
  toast(t('deleted'), 'success');
  loadInvoices();
}

function checkPermission(perm) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  return !!currentUser.permissions[perm];
}
