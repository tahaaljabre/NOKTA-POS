// ==================== SUPPLIER PURCHASES - المشتريات من الموردين ====================

let purchaseItems = [];
let currentPurchaseSupplier = null;
let purchaseMode = 'quick';

function setPurchaseMode(mode) {
  purchaseMode = mode === 'detailed' ? 'detailed' : 'quick';
  document.getElementById('purchase-quick-fields').hidden = purchaseMode !== 'quick';
  document.getElementById('purchase-detailed-fields').hidden = purchaseMode !== 'detailed';
  document.querySelectorAll('[data-purchase-mode]').forEach(button => {
    button.classList.toggle('btn-primary', button.dataset.purchaseMode === purchaseMode);
    button.classList.toggle('btn-secondary', button.dataset.purchaseMode !== purchaseMode);
    button.setAttribute('aria-pressed', String(button.dataset.purchaseMode === purchaseMode));
  });
  calculatePurchaseTotal();
}

// ==================== OPEN PURCHASE FORM ====================

function openPurchaseForm(supplierId) {
  currentPurchaseSupplier = suppliersData.find(s => s.id === supplierId);
  
  if (!currentPurchaseSupplier) {
    toast(t('supplier_not_found') || 'المورد غير موجود', 'error');
    return;
  }
  
  purchaseItems = [];
  purchaseMode = 'quick';
  
  // Close any open details modal first
  const detailsModal = document.getElementById('modal-supplier-details');
  if (detailsModal) {
    hideSupplierModal('modal-supplier-details');
  }
  
  const modalHtml = `
    <div id="modal-purchase-form" class="modal">
      <div class="modal-content modal-xl">
        <div class="modal-header">
          <h3>
            <i class="fas fa-shopping-cart"></i>
            <span data-i18n="add_purchase">تسجيل مشتريات</span>
            <small style="font-weight: normal; color: #666;">
              ${t('supplier') || 'المورد'}: ${escapeHtml(currentPurchaseSupplier.name)}
            </small>
          </h3>
          <button class="modal-close" onclick="closePurchaseModal()">&times;</button>
        </div>
        
        <div class="modal-body">
          <form id="form-purchase">
            <div class="purchase-mode-switch" role="group" aria-label="${t('purchase_entry_mode')}">
              <button type="button" class="btn btn-primary" data-purchase-mode="quick" aria-pressed="true" onclick="setPurchaseMode('quick')">${t('quick_invoice')}</button>
              <button type="button" class="btn btn-secondary" data-purchase-mode="detailed" aria-pressed="false" onclick="setPurchaseMode('detailed')">${t('detailed_invoice')}</button>
            </div>
            <!-- Purchase Header -->
            <div class="form-section">
              <h4 class="section-title">
                <i class="fas fa-info-circle"></i>
                <span data-i18n="purchase_info">معلومات الفاتورة</span>
              </h4>
              <div class="form-grid-3">
                <div class="form-group">
                  <label data-i18n="purchase_date">تاريخ الشراء *</label>
                  <input type="date" name="purchase_date" required value="${getTodayDate()}">
                </div>
                <div class="form-group">
                  <label data-i18n="invoice_number">رقم الفاتورة الخارجي</label>
                  <input type="text" name="invoice_number" placeholder="INV-12345">
                </div>
                <div class="form-group">
                  <label data-i18n="delivery_date">تاريخ التسليم</label>
                  <input type="date" name="delivery_date">
                </div>
                <div class="form-group">
                  <label data-i18n="warehouse">المستودع</label>
                  <select name="warehouse">
                    <option value="main" data-i18n="main_warehouse">المستودع الرئيسي</option>
                    <option value="secondary" data-i18n="secondary_warehouse">المستودع الثانوي</option>
                    <option value="kitchen" data-i18n="kitchen">المطبخ</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div id="purchase-quick-fields" class="form-section">
              <div class="form-grid-2">
                <div class="form-group"><label>${t('invoice_description')}</label><input type="text" name="quick_description" maxlength="200"></div>
                <div class="form-group"><label>${t('total_amount')} *</label><input type="number" name="quick_total" min="0.01" step="0.01" oninput="calculatePurchaseTotal()"></div>
              </div>
            </div>
            <div id="purchase-detailed-fields" hidden>
            <!-- Purchase Items -->
            <div class="form-section">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h4 class="section-title" style="margin: 0;">
                  <i class="fas fa-list"></i>
                  <span data-i18n="items">الأصناف</span>
                </h4>
                <button type="button" class="btn btn-primary btn-sm" onclick="addPurchaseItem()">
                  <i class="fas fa-plus"></i>
                  <span data-i18n="add_item">إضافة صنف</span>
                </button>
              </div>
              
              <div id="purchase-items-container">
                <div class="empty-state-small" id="purchase-empty-items">
                  <i class="fas fa-box-open"></i>
                  <p data-i18n="no_items_added">لم يتم إضافة أصناف بعد</p>
                </div>
              </div>
            </div>
            
            <!-- Financial Summary -->
            <div class="form-section">
              <h4 class="section-title">
                <i class="fas fa-calculator"></i>
                <span data-i18n="financial_summary">الملخص المالي</span>
              </h4>
              <div class="financial-grid">
                <div class="form-group">
                  <label data-i18n="subtotal">المجموع الفرعي</label>
                  <input type="number" name="subtotal" id="purchase-subtotal" readonly value="0" step="0.01">
                </div>
                <div class="form-group">
                  <label>${t('invoice_tax_amount')}</label>
                  <input type="number" name="tax_amount" id="purchase-tax" value="0" min="0" step="0.01" oninput="calculatePurchaseTotal()">
                </div>
                <div class="form-group">
                  <label data-i18n="discount_amount">الخصم</label>
                  <input type="number" name="discount_amount" id="purchase-discount" value="0" step="0.01" onchange="calculatePurchaseTotal()">
                </div>
                <div class="form-group">
                  <label data-i18n="shipping_cost">تكلفة الشحن</label>
                  <input type="number" name="shipping_cost" id="purchase-shipping" value="0" step="0.01" onchange="calculatePurchaseTotal()">
                </div>
                <div class="form-group total-amount-group">
                  <label data-i18n="total_amount">الإجمالي النهائي</label>
                  <input type="number" name="total_amount" id="purchase-total" readonly value="0" step="0.01">
                </div>
              </div>
            </div>
            </div>
            
            <!-- Payment -->
            <div class="form-section">
              <h4 class="section-title">
                <i class="fas fa-money-bill-wave"></i>
                <span data-i18n="payment_info">معلومات الدفع</span>
              </h4>
              <div class="form-grid-2">
                <div class="form-group">
                  <label data-i18n="paid_amount">المبلغ المدفوع</label>
                  <input type="number" name="paid_amount" id="purchase-paid" value="0" step="0.01" min="0">
                </div>
                <div class="form-group">
                  <label data-i18n="payment_method">طريقة الدفع</label>
                  <select name="payment_method">
                    <option value="credit" data-i18n="credit">آجل</option>
                    <option value="cash" data-i18n="cash">نقدي</option>
                    <option value="check" data-i18n="check">شيك</option>
                    <option value="bank_transfer" data-i18n="bank_transfer">تحويل بنكي</option>
                  </select>
                </div>
                <div class="form-group form-group-full">
                  <label data-i18n="notes">ملاحظات</label>
                  <textarea name="notes" rows="2" data-i18n-placeholder="notes_placeholder"></textarea>
                </div>
              </div>
            </div>
          </form>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="closePurchaseModal()">
            <i class="fas fa-times"></i>
            <span data-i18n="cancel">إلغاء</span>
          </button>
          <button type="button" class="btn btn-primary" id="purchase-save-button" onclick="savePurchase(this)">
            <i class="fas fa-save"></i>
            <span data-i18n="save_purchase">حفظ المشتريات</span>
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Inject modal
  let existingModal = document.getElementById('modal-purchase-form');
  if (existingModal) {
    existingModal.remove();
  }
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  if (typeof applyTranslations === 'function') applyTranslations();
  
  // Setup event listeners
  const modal = document.getElementById('modal-purchase-form');
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closePurchaseModal();
    }
  });
  
  // Prevent modal content clicks from closing
  modal.querySelector('.modal-content')?.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  showSupplierModal('modal-purchase-form');
}

// ==================== PURCHASE ITEMS MANAGEMENT ====================

function addPurchaseItem() {
  const item = {
    id: Date.now(),
    name: '',
    quantity: 1,
    unit_price: 0,
    unit: 'unit',
    total: 0
  };
  
  purchaseItems.push(item);
  renderPurchaseItems();
}

function removePurchaseItem(itemId) {
  purchaseItems = purchaseItems.filter(i => i.id !== itemId);
  renderPurchaseItems();
  calculatePurchaseTotal();
}

function updatePurchaseItem(itemId, field, value) {
  const item = purchaseItems.find(i => i.id === itemId);
  if (!item) return;
  
  item[field] = value;
  
  // Recalculate item total
  if (field === 'quantity' || field === 'unit_price') {
    item.total = parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0);
  }
  
  renderPurchaseItems();
  calculatePurchaseTotal();
}

function renderPurchaseItems() {
  const container = document.getElementById('purchase-items-container');
  const emptyState = document.getElementById('purchase-empty-items');
  
  if (purchaseItems.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  
  if (emptyState) emptyState.style.display = 'none';
  
  const itemsHtml = purchaseItems.map(item => `
    <div class="purchase-item-row" data-item-id="${item.id}">
      <div class="item-field item-name">
        <input type="text" 
               value="${escapeHtml(item.name)}" 
               placeholder="${t('item_name') || 'اسم الصنف'}"
               onchange="updatePurchaseItem(${item.id}, 'name', this.value)">
      </div>
      <div class="item-field item-quantity">
        <input type="number" 
               value="${item.quantity}" 
               min="0.01" 
               step="0.01"
               placeholder="${t('quantity') || 'الكمية'}"
               onchange="updatePurchaseItem(${item.id}, 'quantity', this.value)">
      </div>
      <div class="item-field item-unit">
        <select onchange="updatePurchaseItem(${item.id}, 'unit', this.value)">
          <option value="unit" ${item.unit === 'unit' ? 'selected' : ''}>${t('unit') || 'وحدة'}</option>
          <option value="kg" ${item.unit === 'kg' ? 'selected' : ''}>${t('kg') || 'كجم'}</option>
          <option value="box" ${item.unit === 'box' ? 'selected' : ''}>${t('box') || 'صندوق'}</option>
          <option value="bag" ${item.unit === 'bag' ? 'selected' : ''}>${t('bag') || 'كيس'}</option>
          <option value="liter" ${item.unit === 'liter' ? 'selected' : ''}>${t('liter') || 'لتر'}</option>
        </select>
      </div>
      <div class="item-field item-price">
        <input type="number" 
               value="${item.unit_price}" 
               min="0" 
               step="0.01"
               placeholder="${t('unit_price') || 'سعر الوحدة'}"
               onchange="updatePurchaseItem(${item.id}, 'unit_price', this.value)">
      </div>
      <div class="item-field item-total">
        <strong>${formatCurrency(item.total)}</strong>
      </div>
      <div class="item-field item-actions">
        <button type="button" class="btn-icon btn-danger" onclick="removePurchaseItem(${item.id})" title="${t('delete') || 'حذف'}">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = `
    <div class="purchase-items-table">
      <div class="purchase-item-header">
        <div class="item-field item-name">${t('item_name') || 'اسم الصنف'}</div>
        <div class="item-field item-quantity">${t('quantity') || 'الكمية'}</div>
        <div class="item-field item-unit">${t('unit') || 'الوحدة'}</div>
        <div class="item-field item-price">${t('unit_price') || 'سعر الوحدة'}</div>
        <div class="item-field item-total">${t('total') || 'الإجمالي'}</div>
        <div class="item-field item-actions"></div>
      </div>
      ${itemsHtml}
    </div>
  `;
}

function calculatePurchaseTotal() {
  if (purchaseMode === 'quick') {
    const amount = Number(document.querySelector('[name="quick_total"]')?.value || 0);
    document.getElementById('purchase-total').value = Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
    return;
  }
  const subtotal = purchaseItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const tax = parseFloat(document.getElementById('purchase-tax')?.value || 0);
  const discount = parseFloat(document.getElementById('purchase-discount')?.value || 0);
  const shipping = parseFloat(document.getElementById('purchase-shipping')?.value || 0);
  const total = subtotal + tax - discount + shipping;
  
  document.getElementById('purchase-subtotal').value = subtotal.toFixed(2);
  document.getElementById('purchase-total').value = total.toFixed(2);
}

// ==================== SAVE PURCHASE ====================

async function savePurchase(button) {
  const form = document.getElementById('form-purchase');
  
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  
  if (purchaseMode === 'detailed' && purchaseItems.length === 0) {
    toast(t('add_at_least_one_item') || 'أضف صنفاً واحداً على الأقل', 'error');
    return;
  }
  
  // Validate items
  const invalidItems = purchaseMode === 'detailed' ? purchaseItems.filter(i => !i.name || i.quantity <= 0 || i.unit_price < 0) : [];
  if (invalidItems.length > 0) {
    toast(t('complete_all_items') || 'أكمل بيانات جميع الأصناف', 'error');
    return;
  }
  
  const formData = new FormData(form);
  const data = {
    mode: purchaseMode,
    quick_description: formData.get('quick_description'),
    quick_total: parseFloat(formData.get('quick_total')),
    purchase_date: formData.get('purchase_date'),
    invoice_number: formData.get('invoice_number'),
    delivery_date: formData.get('delivery_date'),
    warehouse: formData.get('warehouse'),
    items: purchaseMode === 'detailed' ? purchaseItems : [],
    subtotal: parseFloat(formData.get('subtotal')),
    tax_amount: parseFloat(formData.get('tax_amount')),
    discount_amount: parseFloat(formData.get('discount_amount')),
    shipping_cost: parseFloat(formData.get('shipping_cost')),
    total_amount: parseFloat(formData.get('total_amount')),
    paid_amount: parseFloat(formData.get('paid_amount')),
    payment_method: formData.get('payment_method'),
    notes: formData.get('notes')
  };
  
  try {
    const btn = button;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (t('saving') || 'جاري الحفظ...');
    
    const result = await api(`/api/suppliers/${currentPurchaseSupplier.id}/purchases`, 'POST', data);
    
    toast(t('purchase_saved') || 'تم حفظ المشتريات بنجاح', 'success');
    closePurchaseModal();
    
    // Refresh data
    await loadStatistics();
    await loadSuppliers();
    
    // If viewing supplier details, refresh
    if (currentSupplier && currentSupplier.id === currentPurchaseSupplier.id) {
      viewSupplierDetails(currentSupplier.id);
    }
  } catch (error) {
    console.error('Error saving purchase:', error);
    toast(error.message || t('error_saving_purchase') || 'خطأ في حفظ المشتريات', 'error');
    
    const btn = document.getElementById('purchase-save-button');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> ' + (t('save_purchase') || 'حفظ المشتريات');
  }
}

// ==================== HELPER FUNCTIONS ====================

function getTodayDate() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

function closePurchaseModal() {
  const modal = document.getElementById('modal-purchase-form');
  if (modal) {
    hideSupplierModal('modal-purchase-form');
    setTimeout(() => modal.remove(), 300);
  }
  purchaseItems = [];
  currentPurchaseSupplier = null;
}

// ==================== ADD CSS FOR PURCHASE ITEMS ====================

// Inject styles if not already present
if (!document.getElementById('purchase-items-styles')) {
  const styles = document.createElement('style');
  styles.id = 'purchase-items-styles';
  styles.textContent = `
    .purchase-items-table {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .purchase-item-header {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1.5fr 1.5fr 80px;
      gap: 12px;
      padding: 12px;
      background: #f5f5f5;
      font-weight: 600;
      font-size: 13px;
      color: #666;
    }
    
    .purchase-item-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1.5fr 1.5fr 80px;
      gap: 12px;
      padding: 12px;
      border-top: 1px solid #e0e0e0;
      align-items: center;
    }
    
    .item-field input,
    .item-field select {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .item-field.item-total {
      text-align: center;
      font-size: 15px;
    }
    
    .item-field.item-actions {
      text-align: center;
    }
    
    .btn-danger {
      background: #f44336;
      color: white;
    }
    
    .btn-danger:hover {
      background: #d32f2f;
    }
    
    .empty-state-small {
      text-align: center;
      padding: 40px;
      color: #999;
    }
    
    .empty-state-small i {
      font-size: 32px;
      color: #ddd;
      margin-bottom: 12px;
    }
    
    .financial-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    
    .total-amount-group {
      grid-column: 1 / -1;
    }
    
    .total-amount-group input {
      font-size: 18px;
      font-weight: 700;
      background: #f5f5f5;
    }
    
    @media (max-width: 768px) {
      .purchase-item-header,
      .purchase-item-row {
        grid-template-columns: 1fr;
      }
      
      .financial-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(styles);
}
