// Active-order editing, payment, cancellation, and existing-order printing.
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
      const afterDisc = Math.max(0, sub - disc);
      
      const taxRate = order.tax_percent !== undefined ? order.tax_percent : (window.settings?.tax_rate || 0);
      const taxType = window.settings?.tax_type || 'exclusive';
      
      if (taxType === 'exclusive' && taxRate > 0) {
        return afterDisc + (afterDisc * (taxRate / 100));
      }
      return afterDisc;
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
          tax_percent: (order.tax_percent !== undefined ? order.tax_percent : (window.settings?.tax_rate || 0)), // Provide current tax rate to backend
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

