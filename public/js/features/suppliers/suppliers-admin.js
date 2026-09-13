// ==================== SUPPLIERS ADMIN - إدارة الموردين ====================

let suppliersData = [];
let currentView = 'grid';
let currentSupplier = null;

// ==================== INITIALIZATION ====================

async function initSuppliersAdmin() {
  setupEventListeners();
  await loadSupplierCashiers();
  await loadStatistics();
  await loadSuppliers();
}

let suppliersReady = false;
function setupSuppliersAdmin() {
  if (suppliersReady || !document.getElementById('admin-suppliers-admin')) return;
  suppliersReady = true;
  initSuppliersAdmin();
}
function loadSuppliersAdmin() {
  if (!suppliersReady) setupSuppliersAdmin();
  else { loadStatistics(); loadSuppliers(); }
}
async function loadSupplierCashiers() {
  const select = document.getElementById('supplier-cashier');
  if (!select) return;
  try {
    const cashiers = await api('/api/cashiers');
    select.replaceChildren(new Option(t('all_cashiers') || 'جميع الكاشيرات', ''));
    cashiers.filter(c => c.active).forEach(c => select.add(new Option(`${c.name} (${c.code})`, c.id)));
  } catch (error) { console.error('Error loading cashiers:', error); }
}

function setupEventListeners() {
  // Add supplier buttons
  document.getElementById('btn-add-supplier')?.addEventListener('click', () => openSupplierForm());
  document.getElementById('btn-add-first-supplier')?.addEventListener('click', () => openSupplierForm());
  
  // Search and filters
  document.getElementById('supplier-search')?.addEventListener('input', filterSuppliers);
  document.getElementById('supplier-status-filter')?.addEventListener('change', filterSuppliers);
  document.getElementById('supplier-category-filter')?.addEventListener('change', filterSuppliers);
  
  // View toggle
  document.getElementById('btn-view-grid')?.addEventListener('click', () => switchView('grid'));
  document.getElementById('btn-view-list')?.addEventListener('click', () => switchView('list'));
  
  // Toolbar actions
  document.getElementById('btn-refresh-suppliers')?.addEventListener('click', async () => {
    await loadSuppliers();
    toast(t('suppliers_refreshed') || 'تم التحديث', 'success');
  });
  
  document.getElementById('btn-export-suppliers')?.addEventListener('click', exportSuppliers);
  
  // Modal events
  document.getElementById('btn-save-supplier')?.addEventListener('click', saveSupplier);
  document.getElementById('btn-cancel-supplier')?.addEventListener('click', () => {
    hideSupplierModal('modal-supplier-form');
  });
  
  // Modal background clicks
  document.getElementById('modal-supplier-form')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-supplier-form') {
      hideSupplierModal('modal-supplier-form');
    }
  });
  
  document.getElementById('modal-supplier-details')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-supplier-details') {
      hideSupplierModal('modal-supplier-details');
    }
  });
}

// ==================== DATA LOADING ====================

async function loadStatistics() {
  try {
    const stats = await api('/api/suppliers/stats/summary');
    document.getElementById('stat-total-suppliers').textContent = stats.total_suppliers || 0;
    document.getElementById('stat-total-purchases').textContent = formatCurrency(stats.all_purchases || 0);
    document.getElementById('stat-total-payments').textContent = formatCurrency(stats.all_payments || 0);
    document.getElementById('stat-total-balance').textContent = formatCurrency(stats.total_balance || 0);
  } catch (error) {
    console.error('Error loading statistics:', error);
  }
}

async function loadSuppliers() {
  const container = document.getElementById('suppliers-container');
  const loading = document.getElementById('suppliers-loading');
  const emptyState = document.getElementById('suppliers-empty-state');
  
  try {
    loading.style.display = 'block';
    container.innerHTML = '';
    emptyState.style.display = 'none';
    
    suppliersData = await api('/api/suppliers');
    
    loading.style.display = 'none';
    
    if (suppliersData.length === 0) {
      emptyState.style.display = 'block';
    } else {
      renderSuppliers(suppliersData);
    }
  } catch (error) {
    loading.style.display = 'none';
    console.error('Error loading suppliers:', error);
    toast(t('error_loading_suppliers') || 'خطأ في تحميل الموردين', 'error');
  }
}

function renderSuppliers(suppliers) {
  const container = document.getElementById('suppliers-container');
  
  if (currentView === 'grid') {
    container.className = 'suppliers-grid';
    container.innerHTML = suppliers.map(supplier => createSupplierCard(supplier)).join('');
    
    // Add event listeners after rendering
    attachSupplierCardListeners();
  } else {
    container.className = 'suppliers-table-container';
    container.innerHTML = createSuppliersTable(suppliers);
    
    // Add event listeners after rendering
    attachSupplierTableListeners();
  }
}

function attachSupplierCardListeners() {
  document.querySelectorAll('.supplier-card').forEach(card => {
    const supplierId = parseInt(card.dataset.supplierId);
    
    card.querySelector('[data-action="view"]')?.addEventListener('click', () => viewSupplierDetails(supplierId));
    card.querySelector('[data-action="edit"]')?.addEventListener('click', () => openSupplierForm(supplierId));
    card.querySelector('[data-action="purchase"]')?.addEventListener('click', () => openPurchaseForm(supplierId));
    card.querySelector('[data-action="payment"]')?.addEventListener('click', () => openPaymentForm(supplierId));
    card.querySelector('[data-action="statement"]')?.addEventListener('click', () => viewSupplierStatement(supplierId));
  });
}

function attachSupplierTableListeners() {
  document.querySelectorAll('.suppliers-table tbody tr').forEach(row => {
    const supplierId = parseInt(row.dataset.supplierId);
    
    row.querySelector('[data-action="view"]')?.addEventListener('click', () => viewSupplierDetails(supplierId));
    row.querySelector('[data-action="edit"]')?.addEventListener('click', () => openSupplierForm(supplierId));
    row.querySelector('[data-action="purchase"]')?.addEventListener('click', () => openPurchaseForm(supplierId));
    row.querySelector('[data-action="payment"]')?.addEventListener('click', () => openPaymentForm(supplierId));
    row.querySelector('[data-action="statement"]')?.addEventListener('click', () => viewSupplierStatement(supplierId));
  });
}

function createSupplierCard(supplier) {
  const balance = supplier.current_balance || 0;
  const balanceClass = balance > 0 ? 'balance-debt' : balance < 0 ? 'balance-credit' : 'balance-zero';
  
  return `
    <div class="supplier-card" data-supplier-id="${supplier.id}">
      <div class="supplier-card-header">
        <div class="supplier-avatar">
          <i class="fas fa-building"></i>
        </div>
        <div class="supplier-title">
          <h4>${escapeHtml(supplier.name)}</h4>
          ${supplier.name_en ? `<p class="supplier-subtitle">${escapeHtml(supplier.name_en)}</p>` : ''}
        </div>
        <div class="supplier-status ${supplier.active ? 'status-active' : 'status-inactive'}">
          <i class="fas fa-circle"></i>
        </div>
      </div>
      
      <div class="supplier-card-body">
        <div class="supplier-info-row">
          <span class="info-label">
            <i class="fas fa-barcode"></i> ${t('code') || 'الكود'}
          </span>
          <span class="info-value">${escapeHtml(supplier.code || '—')}</span>
        </div>
        
        ${supplier.phone ? `
        <div class="supplier-info-row">
          <span class="info-label">
            <i class="fas fa-phone"></i> ${t('phone') || 'الهاتف'}
          </span>
          <span class="info-value">${escapeHtml(supplier.phone)}</span>
        </div>
        ` : ''}
        
        ${supplier.category ? `
        <div class="supplier-info-row">
          <span class="info-label">
            <i class="fas fa-tag"></i> ${t('category') || 'التصنيف'}
          </span>
          <span class="info-value">${escapeHtml(t(supplier.category || 'general') || supplier.category || '')}</span>
        </div>
        ` : ''}
        
        <div class="supplier-balance ${balanceClass}">
          <span class="balance-label">${t('current_balance') || 'الرصيد الحالي'}</span>
          <span class="balance-amount">${formatCurrency(Math.abs(balance))}</span>
          ${balance > 0 ? '<small class="balance-note">' + (t('we_owe') || 'لنا') + '</small>' : 
            balance < 0 ? '<small class="balance-note">' + (t('owe_us') || 'علينا') + '</small>' : ''}
        </div>
      </div>
      
      <div class="supplier-card-actions">
        <button type="button" class="supplier-action" data-action="view">
          ${t('view_details') || 'التفاصيل'}
        </button>
        <button type="button" class="supplier-action" data-action="edit">
          ${t('edit') || 'تعديل'}
        </button>
        <button type="button" class="supplier-action" data-action="purchase">
          ${t('add_purchase') || 'مشتريات'}
        </button>
        <button type="button" class="supplier-action supplier-action-primary" data-action="payment">
          ${t('add_payment') || 'سند صرف'}
        </button>
        <button type="button" class="supplier-action" data-action="statement">
          ${t('statement') || 'كشف حساب'}
        </button>
      </div>
    </div>
  `;
}

function createSuppliersTable(suppliers) {
  return `
    <table class="suppliers-table">
      <thead>
        <tr>
          <th>${t('code') || 'الكود'}</th>
          <th>${t('name') || 'الاسم'}</th>
          <th>${t('phone') || 'الهاتف'}</th>
          <th>${t('category') || 'التصنيف'}</th>
          <th>${t('current_balance') || 'الرصيد الحالي'}</th>
          <th>${t('status') || 'الحالة'}</th>
          <th>${t('actions') || 'الإجراءات'}</th>
        </tr>
      </thead>
      <tbody>
        ${suppliers.map(supplier => `
          <tr data-supplier-id="${supplier.id}">
            <td><strong>${escapeHtml(supplier.code || '—')}</strong></td>
            <td>
              <div class="table-cell-name">
                ${escapeHtml(supplier.name)}
                ${supplier.name_en ? `<br><small>${escapeHtml(supplier.name_en)}</small>` : ''}
              </div>
            </td>
            <td>${escapeHtml(supplier.phone || '-')}</td>
            <td><span class="badge">${escapeHtml(t(supplier.category || 'general') || supplier.category || '')}</span></td>
            <td class="${supplier.current_balance > 0 ? 'text-success' : supplier.current_balance < 0 ? 'text-danger' : ''}">
              ${formatCurrency(supplier.current_balance || 0)}
            </td>
            <td>
              <span class="status-badge ${supplier.active ? 'status-active' : 'status-inactive'}">
                ${supplier.active ? (t('active') || 'نشط') : (t('inactive') || 'غير نشط')}
              </span>
            </td>
            <td>
              <div class="table-actions">
                <button type="button" class="supplier-action" data-action="view">${t('view_details')}</button>
                <button type="button" class="supplier-action" data-action="edit">${t('edit')}</button>
                <button type="button" class="supplier-action" data-action="purchase">${t('add_purchase')}</button>
                <button type="button" class="supplier-action supplier-action-primary" data-action="payment">${t('add_payment')}</button>
                <button type="button" class="supplier-action" data-action="statement">${t('statement')}</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ==================== FILTERING & SEARCHING ====================

function filterSuppliers() {
  const searchTerm = (document.getElementById('supplier-search')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('supplier-status-filter')?.value || 'all';
  const categoryFilter = document.getElementById('supplier-category-filter')?.value || 'all';
  
  let filtered = suppliersData;
  
  // Search filter
  if (searchTerm) {
    filtered = filtered.filter(s => 
      s.name.toLowerCase().includes(searchTerm) ||
      (s.name_en && s.name_en.toLowerCase().includes(searchTerm)) ||
      s.code.toLowerCase().includes(searchTerm) ||
      (s.phone && s.phone.includes(searchTerm))
    );
  }
  
  // Status filter
  if (statusFilter !== 'all') {
    filtered = filtered.filter(s => 
      statusFilter === 'active' ? s.active === 1 : s.active === 0
    );
  }
  
  // Category filter
  if (categoryFilter !== 'all') {
    filtered = filtered.filter(s => s.category === categoryFilter);
  }
  
  renderSuppliers(filtered);
}

function switchView(view) {
  currentView = view;
  
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  
  renderSuppliers(suppliersData);
}

// ==================== SUPPLIER FORM ====================

function openSupplierForm(supplierId = null) {
  const modal = document.getElementById('modal-supplier-form');
  const form = document.getElementById('form-supplier');
  const title = document.getElementById('supplier-modal-title');
  
  form.reset();
  
  if (supplierId) {
    title.setAttribute('data-i18n', 'edit_supplier');
    title.textContent = t('edit_supplier') || 'تعديل مورد';
    loadSupplierData(supplierId);
  } else {
    title.setAttribute('data-i18n', 'add_supplier');
    title.textContent = t('add_supplier') || 'إضافة مورد';
    // Generate next supplier code
    generateSupplierCode();
  }
  
  showSupplierModal('modal-supplier-form');
}

async function loadSupplierData(supplierId) {
  try {
    const supplier = await api(`/api/suppliers/${supplierId}`);
    const form = document.getElementById('form-supplier');
    
    // Populate simplified form
    form.elements.id.value = supplier.id;
    document.getElementById('supplier-code-hidden').value = supplier.code || '';
    form.elements.name.value = supplier.name || '';
    form.elements.phone.value = supplier.phone || '';
    form.elements.tax_number.value = supplier.tax_number || '';
    form.elements.address.value = supplier.address || '';
    form.elements.cashier_id.value = supplier.cashier_id || '';
  } catch (error) {
    console.error('Error loading supplier:', error);
    toast(t('error_loading_supplier') || 'خطأ في تحميل بيانات المورد', 'error');
  }
}

function generateSupplierCode() {
  const lastCode = suppliersData.length > 0 
    ? Math.max(...suppliersData.map(s => {
        const num = parseInt(String(s.code || '').replace(/\D/g, ''), 10);
        return isNaN(num) ? 0 : num;
      }))
    : 0;
  
  const nextCode = `SUP-${String(lastCode + 1).padStart(4, '0')}`;
  document.getElementById('supplier-code-hidden').value = nextCode;
}

async function saveSupplier() {
  const form = document.getElementById('form-supplier');
  
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  
  const formData = new FormData(form);
  const data = {};
  formData.forEach((value, key) => {
    if (key !== 'id') {
      data[key] = value;
    }
  });
  
  // Add the hidden code
  const code = document.getElementById('supplier-code-hidden').value;
  if (code) {
    data.code = code;
  }
  
  const supplierId = form.elements.id.value;
  
  try {
    const btnSave = document.getElementById('btn-save-supplier');
    btnSave.disabled = true;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (t('saving') || 'جاري الحفظ...');
    
    if (supplierId) {
      await api(`/api/suppliers/${supplierId}`, 'PUT', data);
      toast(t('supplier_updated') || 'تم تحديث المورد بنجاح', 'success');
    } else {
      await api('/api/suppliers', 'POST', data);
      toast(t('supplier_added') || 'تم إضافة المورد بنجاح', 'success');
    }
    
    hideSupplierModal('modal-supplier-form');
    await loadStatistics();
    await loadSuppliers();
  } catch (error) {
    console.error('Error saving supplier:', error);
    toast(error.message || t('error_saving_supplier') || 'خطأ في حفظ المورد', 'error');
  } finally {
    const btnSave = document.getElementById('btn-save-supplier');
    btnSave.disabled = false;
    btnSave.innerHTML = '<i class="fas fa-save"></i> ' + (t('save') || 'حفظ');
  }
}

// ==================== SUPPLIER DETAILS ====================

async function viewSupplierDetails(supplierId) {
  try {
    const supplier = await api(`/api/suppliers/${supplierId}`);
    const modal = document.getElementById('modal-supplier-details');
    const title = document.getElementById('supplier-details-title');
    const body = document.getElementById('supplier-details-body');
    
    title.textContent = supplier.name;
    
    body.innerHTML = `
      <div class="supplier-details-container">
        <!-- Tabs -->
        <div class="tabs">
          <button class="tab-btn active" data-tab="info">
            <i class="fas fa-info-circle"></i> ${t('information') || 'المعلومات'}
          </button>
          <button class="tab-btn" data-tab="statement">
            <i class="fas fa-file-invoice"></i> ${t('statement') || 'كشف الحساب'}
          </button>
          <button class="tab-btn" data-tab="purchases">
            <i class="fas fa-shopping-cart"></i> ${t('purchases') || 'المشتريات'}
          </button>
          <button class="tab-btn" data-tab="payments">
            <i class="fas fa-money-bill-wave"></i> ${t('payments') || 'سندات الصرف'}
          </button>
        </div>
        
        <!-- Tab Contents -->
        <div class="tab-content active" id="tab-info">
          ${renderSupplierInfo(supplier)}
        </div>
        
        <div class="tab-content" id="tab-statement">
          <div id="supplier-statement-container">
            <div class="loading-state"><div class="spinner"></div></div>
          </div>
        </div>
        
        <div class="tab-content" id="tab-purchases">
          <div id="supplier-purchases-container">
            <div class="loading-state"><div class="spinner"></div></div>
          </div>
        </div>
        
        <div class="tab-content" id="tab-payments">
          <div id="supplier-payments-container">
            <div class="loading-state"><div class="spinner"></div></div>
          </div>
        </div>
      </div>
    `;
    
    // Setup tab switching
    body.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        body.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        body.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${tabName}`).classList.add('active');
        
        // Load data on first view
        if (tabName === 'statement' && !body.querySelector('#supplier-statement-container table')) {
          loadSupplierStatement(supplierId);
        } else if (tabName === 'purchases' && !body.querySelector('#supplier-purchases-container table')) {
          loadSupplierPurchases(supplierId);
        } else if (tabName === 'payments' && !body.querySelector('#supplier-payments-container table')) {
          loadSupplierPayments(supplierId);
        }
      });
    });
    
    currentSupplier = supplier;
    showSupplierModal('modal-supplier-details');
  } catch (error) {
    console.error('Error loading supplier details:', error);
    toast(t('error_loading_details') || 'خطأ في تحميل التفاصيل', 'error');
  }
}

function renderSupplierInfo(supplier) {
  return `
    <div class="supplier-info-grid">
      <div class="info-section">
        <h4><i class="fas fa-info-circle"></i> ${t('basic_info') || 'المعلومات الأساسية'}</h4>
        <dl>
          <dt>${t('code') || 'الكود'}</dt>
          <dd>${escapeHtml(supplier.code)}</dd>
          
          <dt>${t('name_ar') || 'الاسم بالعربي'}</dt>
          <dd>${escapeHtml(supplier.name)}</dd>
          
          ${supplier.name_en ? `
          <dt>${t('name_en') || 'الاسم بالإنجليزي'}</dt>
          <dd>${escapeHtml(supplier.name_en)}</dd>
          ` : ''}
          
          <dt>${t('category') || 'التصنيف'}</dt>
          <dd>${t(supplier.category) || supplier.category}</dd>
          
          <dt>${t('status') || 'الحالة'}</dt>
          <dd><span class="status-badge ${supplier.active ? 'status-active' : 'status-inactive'}">
            ${supplier.active ? (t('active') || 'نشط') : (t('inactive') || 'غير نشط')}
          </span></dd>
        </dl>
      </div>
      
      <div class="info-section">
        <h4><i class="fas fa-address-book"></i> ${t('contact_info') || 'معلومات الاتصال'}</h4>
        <dl>
          ${supplier.phone ? `<dt>${t('phone') || 'الهاتف'}</dt><dd>${escapeHtml(supplier.phone)}</dd>` : ''}
          ${supplier.email ? `<dt>${t('email') || 'البريد الإلكتروني'}</dt><dd>${escapeHtml(supplier.email)}</dd>` : ''}
          ${supplier.contact_person ? `<dt>${t('contact_person') || 'الشخص المسؤول'}</dt><dd>${escapeHtml(supplier.contact_person)}</dd>` : ''}
          ${supplier.contact_phone ? `<dt>${t('contact_phone') || 'هاتف المسؤول'}</dt><dd>${escapeHtml(supplier.contact_phone)}</dd>` : ''}
          ${supplier.address ? `<dt>${t('address') || 'العنوان'}</dt><dd>${escapeHtml(supplier.address)}</dd>` : ''}
          ${supplier.city ? `<dt>${t('city') || 'المدينة'}</dt><dd>${escapeHtml(supplier.city)}</dd>` : ''}
        </dl>
      </div>
      
      <div class="info-section">
        <h4><i class="fas fa-money-check-alt"></i> ${t('financial_info') || 'المعلومات المالية'}</h4>
        <dl>
          <dt>${t('opening_balance') || 'الرصيد الافتتاحي'}</dt>
          <dd>${formatCurrency(supplier.opening_balance || 0)}</dd>
          
          <dt>${t('current_balance') || 'الرصيد الحالي'}</dt>
          <dd class="${supplier.current_balance > 0 ? 'text-success' : supplier.current_balance < 0 ? 'text-danger' : ''}">
            ${formatCurrency(supplier.current_balance || 0)}
          </dd>
          
          <dt>${t('total_purchases') || 'إجمالي المشتريات'}</dt>
          <dd>${formatCurrency(supplier.stats?.total_purchases || 0)}</dd>
          
          <dt>${t('total_payments') || 'إجمالي المدفوعات'}</dt>
          <dd>${formatCurrency(supplier.stats?.total_payments || 0)}</dd>
          
          <dt>${t('payment_terms') || 'شروط الدفع'}</dt>
          <dd>${supplier.payment_terms || 0} ${t('days') || 'يوم'}</dd>
          
          <dt>${t('credit_limit') || 'حد الائتمان'}</dt>
          <dd>${formatCurrency(supplier.credit_limit || 0)}</dd>
        </dl>
      </div>
      
      ${supplier.bank_name || supplier.bank_account || supplier.iban ? `
      <div class="info-section">
        <h4><i class="fas fa-university"></i> ${t('bank_info') || 'المعلومات البنكية'}</h4>
        <dl>
          ${supplier.bank_name ? `<dt>${t('bank_name') || 'اسم البنك'}</dt><dd>${escapeHtml(supplier.bank_name)}</dd>` : ''}
          ${supplier.bank_account ? `<dt>${t('bank_account') || 'رقم الحساب'}</dt><dd>${escapeHtml(supplier.bank_account)}</dd>` : ''}
          ${supplier.iban ? `<dt>IBAN</dt><dd>${escapeHtml(supplier.iban)}</dd>` : ''}
        </dl>
      </div>
      ` : ''}
    </div>
  `;
}

async function loadSupplierStatement(supplierId) {
  const container = document.getElementById('supplier-statement-container');
  try {
    const data = await api(`/api/suppliers/${supplierId}/statement`);
    
    if (data.transactions.length === 0) {
      container.innerHTML = `<div class="empty-state"><i class="fas fa-file-invoice"></i><p>${t('no_transactions') || 'لا توجد معاملات'}</p></div>`;
      return;
    }
    
    container.innerHTML = `
      <div class="statement-summary">
        <div class="summary-item">
          <span>${t('opening_balance') || 'الرصيد الافتتاحي'}</span>
          <strong>${formatCurrency(data.summary.opening_balance)}</strong>
        </div>
        <div class="summary-item">
          <span>${t('total_purchases') || 'إجمالي المشتريات'}</span>
          <strong>${formatCurrency(data.summary.total_purchases)}</strong>
        </div>
        <div class="summary-item">
          <span>${t('total_payments') || 'إجمالي المدفوعات'}</span>
          <strong>${formatCurrency(data.summary.total_payments)}</strong>
        </div>
        <div class="summary-item">
          <span>${t('current_balance') || 'الرصيد الحالي'}</span>
          <strong class="${data.summary.current_balance > 0 ? 'text-success' : data.summary.current_balance < 0 ? 'text-danger' : ''}">
            ${formatCurrency(data.summary.current_balance)}
          </strong>
        </div>
      </div>
      
      <table class="statement-table">
        <thead>
          <tr>
            <th>${t('date') || 'التاريخ'}</th>
            <th>${t('transaction_number') || 'رقم الحركة'}</th>
            <th>${t('type') || 'النوع'}</th>
            <th>${t('description') || 'الوصف'}</th>
            <th>${t('debit') || 'مدين'}</th>
            <th>${t('credit') || 'دائن'}</th>
            <th>${t('balance') || 'الرصيد'}</th>
          </tr>
        </thead>
        <tbody>
          ${data.transactions.map(tx => `
            <tr>
              <td>${formatDate(tx.transaction_date)}</td>
              <td><strong>${escapeHtml(tx.transaction_number)}</strong></td>
              <td><span class="badge ${tx.transaction_type === 'purchase' ? 'badge-warning' : 'badge-success'}">
                ${tx.transaction_type === 'purchase' ? (t('purchase') || 'مشتريات') : (t('payment') || 'دفع')}
              </span></td>
              <td>${escapeHtml(tx.description || '-')}</td>
              <td class="text-danger">${tx.transaction_type === 'purchase' ? formatCurrency(tx.amount) : '-'}</td>
              <td class="text-success">${tx.transaction_type === 'payment' ? formatCurrency(tx.amount) : '-'}</td>
              <td><strong>${formatCurrency(tx.balance)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="statement-actions">
        <button class="btn btn-primary" onclick="printSupplierStatement(${supplierId})">
          <i class="fas fa-print"></i> ${t('print') || 'طباعة'}
        </button>
      </div>
    `;
  } catch (error) {
    console.error('Error loading statement:', error);
    container.innerHTML = `<div class="error-state"><p>${t('error_loading_statement') || 'خطأ في تحميل كشف الحساب'}</p></div>`;
  }
}

async function loadSupplierPurchases(supplierId) {
  const container = document.getElementById('supplier-purchases-container');
  try {
    const purchases = await api(`/api/suppliers/${supplierId}/purchases`);
    
    if (purchases.length === 0) {
      container.innerHTML = `<div class="empty-state"><i class="fas fa-shopping-cart"></i><p>${t('no_purchases') || 'لا توجد مشتريات'}</p></div>`;
      return;
    }
    
    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>${t('purchase_number') || 'رقم الفاتورة'}</th>
            <th>${t('date') || 'التاريخ'}</th>
            <th>${t('invoice_number') || 'رقم الفاتورة الخارجي'}</th>
            <th>${t('total_amount') || 'المبلغ الإجمالي'}</th>
            <th>${t('paid_amount') || 'المدفوع'}</th>
            <th>${t('remaining_amount') || 'المتبقي'}</th>
            <th>${t('status') || 'الحالة'}</th>
          </tr>
        </thead>
        <tbody>
          ${purchases.map(p => `
            <tr>
              <td><strong>${escapeHtml(p.purchase_number)}</strong><details class="supplier-invoice-details"><summary>${t('invoice_details')}</summary>${(() => {
                let lines = [];
                try { lines = JSON.parse(p.items_json || '[]'); } catch (_) {}
                return `<ul>${(Array.isArray(lines) ? lines : []).map(line => `<li>${escapeHtml(line.name || '')} — ${escapeHtml(String(line.quantity || 0))} × ${escapeHtml(String(line.unit_price || 0))}</li>`).join('')}</ul>`;
              })()}</details></td>
              <td>${formatDate(p.purchase_date)}</td>
              <td>${escapeHtml(p.invoice_number || '-')}</td>
              <td>${formatCurrency(p.total_amount)}</td>
              <td class="text-success">${formatCurrency(p.paid_amount)}</td>
              <td class="text-danger">${formatCurrency(p.remaining_amount)}</td>
              <td>
                <span class="badge ${
                  p.payment_status === 'paid' ? 'badge-success' : 
                  p.payment_status === 'partial' ? 'badge-warning' : 'badge-danger'
                }">
                  ${p.payment_status === 'paid' ? (t('paid') || 'مدفوع') : 
                    p.payment_status === 'partial' ? (t('partial') || 'جزئي') : (t('pending') || 'معلق')}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('Error loading purchases:', error);
    container.innerHTML = `<div class="error-state"><p>${t('error_loading_purchases') || 'خطأ في تحميل المشتريات'}</p></div>`;
  }
}

async function loadSupplierPayments(supplierId) {
  const container = document.getElementById('supplier-payments-container');
  try {
    const payments = await api(`/api/suppliers/${supplierId}/payments`);
    
    if (payments.length === 0) {
      container.innerHTML = `<div class="empty-state"><i class="fas fa-money-bill-wave"></i><p>${t('no_payments') || 'لا توجد سندات صرف'}</p></div>`;
      return;
    }
    
    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>${t('payment_number') || 'رقم السند'}</th>
            <th>${t('date') || 'التاريخ'}</th>
            <th>${t('amount') || 'المبلغ'}</th>
            <th>${t('payment_method') || 'طريقة الدفع'}</th>
            <th>${t('reference_number') || 'رقم المرجع'}</th>
            <th>${t('notes') || 'ملاحظات'}</th>
          </tr>
        </thead>
        <tbody>
          ${payments.map(p => `
            <tr>
              <td><strong>${escapeHtml(p.payment_number)}</strong></td>
              <td>${formatDate(p.payment_date)}</td>
              <td class="text-success">${formatCurrency(p.amount)}</td>
              <td>${t(p.payment_method) || p.payment_method}</td>
              <td>${escapeHtml(p.reference_number || '-')}</td>
              <td>${escapeHtml(p.notes || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('Error loading payments:', error);
    container.innerHTML = `<div class="error-state"><p>${t('error_loading_payments') || 'خطأ في تحميل سندات الصرف'}</p></div>`;
  }
}

// ==================== VIEW SUPPLIER STATEMENT ====================

function viewSupplierStatement(supplierId) {
  viewSupplierDetails(supplierId);
  // Switch to statement tab after modal opens
  setTimeout(() => {
    document.querySelector('[data-tab="statement"]')?.click();
  }, 100);
}

// ==================== EXPORT ====================

function exportSuppliers() {
  const csv = [
    ['Code', 'Name', 'Phone', 'Email', 'Category', 'Current Balance', 'Status'].join(','),
    ...suppliersData.map(s => [
      s.code,
      s.name,
      s.phone || '',
      s.email || '',
      s.category || '',
      s.current_balance || 0,
      s.active ? 'Active' : 'Inactive'
    ].join(','))
  ].join('\n');
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `suppliers_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  
  toast(t('exported_successfully') || 'تم التصدير بنجاح', 'success');
}

// ==================== HELPER FUNCTIONS ====================

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString(currentLang === 'ar' ? 'ar-SA' : 'en-US');
}

function formatCurrency(amount) {
  const number = new Intl.NumberFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(amount) || 0);
  return `${number} ${getCurrency()}`;
}

function printSupplierStatement(supplierId) {
  toast('سيتم إضافة الطباعة قريباً', 'info');
}

// ==================== INITIALIZATION ====================

if (document.getElementById('admin-suppliers-admin')) setupSuppliersAdmin();


// ==================== MODAL HELPERS ====================

/**
 * Show a specific modal by ID (for supplier modals)
 */
function showSupplierModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    // Don't open if already open
    if (modal.classList.contains('open')) {
      return;
    }
    
    modal.classList.add('open');
    // Don't add body.modal-open as it may interfere with main app
  }
}

/**
 * Hide a specific modal by ID (for supplier modals)
 */
function hideSupplierModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('open');
  }
}

/**
 * Close all supplier modals
 */
function closeAllSupplierModals() {
  const supplierModals = [
    'modal-supplier-form',
    'modal-supplier-details', 
    'modal-purchase-form',
    'modal-payment-form'
  ];
  
  supplierModals.forEach(modalId => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('open');
    }
  });
}
