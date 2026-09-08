// ===== Settings =====
async function loadSettings() {
  let s;
  try {
    if (isOnline) {
      s = await api('/api/settings');
      await cacheData('settings', [s]);
    } else {
      const cached = await getCachedData('settings');
      s = cached[0] || {};
    }
  } catch(e) { s = {}; }
  
  localStorage.setItem('pos_business_timezone',s.business_timezone||'Asia/Bangkok');
  const timezoneInput=document.getElementById('set-business-timezone');if(timezoneInput)timezoneInput.value=s.business_timezone||'Asia/Bangkok';
  // Sync global currency state
  if (s.currency) {
    appCurrency = s.currency;
    localStorage.setItem('pos_currency', s.currency);
    applyTranslations();
  }
  if (s.restaurant_name) {
    appRestaurantName = s.restaurant_name;
    localStorage.setItem('pos_restaurant_name', s.restaurant_name);
  }
  if (s.restaurant_name_en) {
    appRestaurantNameEn = s.restaurant_name_en;
    localStorage.setItem('pos_restaurant_name_en', s.restaurant_name_en);
  }
  if (s.tax_rate !== undefined) {
    appTaxRate = parseFloat(s.tax_rate) || 0;
    localStorage.setItem('pos_tax_rate', s.tax_rate);
  }
  if (typeof updateHeaderRestaurantName === 'function') updateHeaderRestaurantName();

  const el = id => document.getElementById(id);
  if (el('set-restaurant-name')) el('set-restaurant-name').value = s.restaurant_name || '';
  if (el('set-restaurant-name-en')) el('set-restaurant-name-en').value = s.restaurant_name_en || '';
  if (el('set-restaurant-address')) el('set-restaurant-address').value = s.restaurant_address || '';
  if (el('set-restaurant-phone')) el('set-restaurant-phone').value = s.restaurant_phone || '';
  if (el('set-tax-number')) el('set-tax-number').value = s.tax_number || '';
  if (el('set-currency')) el('set-currency').value = s.currency || '฿';
  if (el('set-tax-rate')) el('set-tax-rate').value = s.tax_rate || '0';
  if (el('set-receipt-footer')) el('set-receipt-footer').value = s.receipt_footer || '';
  
  if (s.payment_methods_list) {
    try { paymentMethodsList = JSON.parse(s.payment_methods_list); } catch(e) { paymentMethodsList = []; }
  }
  if (s.delivery_methods_list) {
    try { deliveryMethodsList = JSON.parse(s.delivery_methods_list); } catch(e) { deliveryMethodsList = []; }
  }

  if (el('set-invoice-retention')) el('set-invoice-retention').value = s.invoice_retention_days || '365';

  // Printer Profiles
  try {
    if (s.printers_config) {
      printersConfigList = JSON.parse(s.printers_config);
    } else {
      // Default initial config based on old format
      printersConfigList = [
        { name: 'كاشير - الدور 1', device: s.printer_cashier_f1 || 'POS-80-Cashier-F1', auto_print: s.print_receipt_f1 !== '0' },
        { name: 'كاشير - الدور 2', device: s.printer_cashier_f2 || 'POS-80-Cashier-F2', auto_print: s.print_receipt_f2 !== '0' },
        { name: 'المطبخ', device: s.printer_kitchen || 'Kitchen-Printer-LAN', auto_print: s.print_kitchen_auto !== '0' },
        { name: 'البار', device: s.printer_bar || 'Bar-Printer-LAN', auto_print: s.print_bar_auto !== '0' }
      ];
    }
  } catch (e) {
    printersConfigList = [];
  }
  if (typeof renderPrintersList === 'function') renderPrintersList();


  // Load Network Server IP and URL for multi-device connection
  loadServerNetworkInfo();
}

async function saveSettings() {
  try {
    const el = id => document.getElementById(id);
    const newNameAr = el('set-restaurant-name')?.value || '';
    const newNameEn = el('set-restaurant-name-en')?.value || '';
    const newCurrency = el('set-currency')?.value || '฿';
    await api('/api/settings', 'PUT', {
      restaurant_name: newNameAr,
      restaurant_name_en: newNameEn,
      restaurant_address: el('set-restaurant-address')?.value || '',
      restaurant_phone: el('set-restaurant-phone')?.value || '',
      tax_number: el('set-tax-number')?.value || '',
      currency: newCurrency,
      business_timezone: el('set-business-timezone')?.value || 'Asia/Bangkok',
      tax_rate: el('set-tax-rate')?.value || '0',
      receipt_footer: el('set-receipt-footer')?.value || '',
      invoice_retention_days: el('set-invoice-retention')?.value || '365',
      printers_config: JSON.stringify(printersConfigList)
    });
    
    appRestaurantName = newNameAr;
    appRestaurantNameEn = newNameEn;
    localStorage.setItem('pos_restaurant_name', newNameAr);
    localStorage.setItem('pos_restaurant_name_en', newNameEn);
    if (typeof updateHeaderRestaurantName === 'function') updateHeaderRestaurantName();
    
    appCurrency = newCurrency;
    localStorage.setItem('pos_currency', newCurrency);
    applyTranslations();
    if (typeof loadMenuGrid === 'function') loadMenuGrid();
    if (typeof renderOrderItems === 'function') renderOrderItems();
    if (typeof loadActiveOrders === 'function') loadActiveOrders();
    if (typeof loadInvoices === 'function') loadInvoices();
    
    toast(t('saved'), 'success');
    await loadSettings();
  } catch(e) {
    console.error('Save settings error:', e);
    toast(t('error') + ': ' + e.message, 'error');
  }
}

// ===== Auto-Discover Connected Printers & Quick Testing =====
let detectedPrintersList = [];

async function detectLocalPrinters() {
  const btn = document.getElementById('btn-scan-printers');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ جاري فحص واكتشاف الطابعات...';
  }

  try {
    const data = await api('/api/print/scan');
    detectedPrintersList = [];
    
    if (data.usb && data.usb.length) {
        data.usb.forEach(d => detectedPrintersList.push({ name: d.name, device: JSON.stringify({type:'usb', vendorId: d.vendorId, productId: d.productId}), type: 'usb' }));
      }
      if (data.network && data.network.length) {
        data.network.forEach(d => detectedPrintersList.push({ name: d.name, device: JSON.stringify({type:'network', address: d.address}), type: 'network' }));
      }
      if (data.bluetooth && data.bluetooth.length) {
        data.bluetooth.forEach(d => {
            if (d.type === 'bluetooth_hint') {
                detectedPrintersList.push({ name: d.name, device: '', type: 'hint' });
            } else {
                detectedPrintersList.push({ name: d.name, device: JSON.stringify({type:'bluetooth', address: d.address}), type: 'bluetooth' });
            }
        });
      }
      
      // Add manual entry option for Network printers that weren't discovered
      detectedPrintersList.push({ name: '➕ إضافة طابعة شبكة يدوياً (IP)', device: 'manual_network', type: 'network' });

    const selectEl = document.getElementById('printer-modal-device');
    if (selectEl) {
      selectEl.innerHTML = '<option value="">-- اختر طابعة من المكتشفة --</option>' +
      detectedPrintersList.map(p => '<option value=\'' + p.device + '\' data-name="' + p.name + '">🖨️ ' + p.name + '</option>').join('');
    }

    if (detectedPrintersList.length <= 1) { // 1 because we always add "Manual Network"
      toast(currentLang === 'ar' ? 'لم يتم العثور على طابعات USB مدعومة. للـ USB تأكد من تحويل تعريف الطابعة إلى WinUSB باستخدام Zadig. أو اختر طابعة شبكة يدوياً.' : 'No supported printers found.', 'info');
    } else {
      toast(currentLang === 'ar' ? `✅ تم العثور على ${detectedPrintersList.length - 1} طابعة.` : `✅ Found ${detectedPrintersList.length - 1} system printers.`, 'success');
    }
  } catch (err) {
    console.error('Printer scan error:', err);
    toast(currentLang === 'ar' ? 'خطأ أثناء فحص الطابعات.' : 'Error scanning for printers.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🔄 فحص واكتشاف الطابعات الآن';
    }
  }
}

function renderPrintersList() {
  const tbody = document.getElementById('printers-config-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  printersConfigList.forEach((p, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = 
      '<td>' + escapeHtml(p.name || '-') + '</td>' +
      '<td>' + escapeHtml(p.device || '-') + '</td>' +
      '<td>' + escapeHtml(getPrinterCategoryNames(p.category_ids).join('، ') || '-') + '</td>' +
      '<td><span class="status-badge ' + (p.auto_print ? 'status-active' : 'status-inactive') + '">' +
      (p.auto_print ? 'مفعل' : 'معطل') + '</span></td>' +
      '<td>' +
      '<button class="btn btn-save" style="padding:4px 8px;font-size:12px;" onclick="testPrintSpecific(' + idx + ')">🖨️ تجربة</button> ' +
      '<button class="btn btn-primary" style="padding:4px 8px;font-size:12px;" onclick="openPrinterModal(' + idx + ')">تعديل</button> ' +
      '<button class="btn" style="background:#e74c3c;color:#fff;padding:4px 8px;font-size:12px;" onclick="deletePrinterConfig(' + idx + ')">حذف</button>' +
      '</td>';
    tbody.appendChild(tr);
  });
}

function getPrinterCategoryNames(categoryIds) {
  const ids = Array.isArray(categoryIds) ? categoryIds.map(Number) : [];
  return ids.map(id => {
    const category = (typeof categories !== 'undefined' ? categories : []).find(c => Number(c.id) === id);
    return category ? (currentLang === 'ar' ? category.name : (category.name_en || category.name)) : '';
  }).filter(Boolean);
}

function openPrinterModal(index = -1) {
  document.getElementById('printer-modal').classList.add('open');
  document.getElementById('printer-modal-index').value = index;
  
  if (index >= 0 && printersConfigList[index]) {
    const p = printersConfigList[index];
    document.getElementById('printer-modal-name').value = p.name || '';
    document.getElementById('printer-modal-device').value = p.device || '';
    document.getElementById('printer-modal-auto').checked = p.auto_print || false;
    renderPrinterCategoryChoices(p.category_ids || []);
  } else {
    document.getElementById('printer-modal-name').value = '';
    document.getElementById('printer-modal-device').value = '';
    document.getElementById('printer-modal-auto').checked = true;
    renderPrinterCategoryChoices([]);
  }
}

function renderPrinterCategoryChoices(selectedIds) {
  const container = document.getElementById('printer-modal-categories');
  if (!container) return;
  const selected = new Set((Array.isArray(selectedIds) ? selectedIds : []).map(Number));
  const list = typeof categories !== 'undefined' ? categories : [];
  if (!list.length) {
    container.innerHTML = '<span style="font-size:12px;color:var(--text-light);">جاري تحميل أقسام المنيو...</span>';
    return;
  }
  container.innerHTML = list.map(category => `<label style="display:flex;align-items:center;gap:8px;padding:5px;cursor:pointer;">
    <input type="checkbox" class="printer-category-choice" value="${category.id}" ${selected.has(Number(category.id)) ? 'checked' : ''}>
    <span>${escapeHtml(category.icon || '📁')} ${escapeHtml(currentLang === 'ar' ? category.name : (category.name_en || category.name))}</span>
  </label>`).join('');
}

function savePrinterConfig() {
  const index = parseInt(document.getElementById('printer-modal-index').value);
  const name = document.getElementById('printer-modal-name').value.trim();
  const device = document.getElementById('printer-modal-device').value;
  const auto_print = document.getElementById('printer-modal-auto').checked;
  const category_ids = [...document.querySelectorAll('.printer-category-choice:checked')].map(input => Number(input.value));
  
  if (!name) return toast('الرجاء إدخال اسم القسم', 'error');
  
  const config = { name, device, auto_print, category_ids };
  
  if (index >= 0) printersConfigList[index] = config;
  else printersConfigList.push(config);
  
  document.getElementById('printer-modal').classList.remove('open');
  renderPrintersList();
  saveSettings();
}

function deletePrinterConfig(index) {
  if (!confirm('هل أنت متأكد من حذف هذا القسم؟')) return;
  printersConfigList.splice(index, 1);
  renderPrintersList();
  saveSettings();
}

function testPrintSpecific(index) {
  const p = printersConfigList[index];
  if (!p) return;
  
  const testOrder = {
    id: 'TEST',
    invoice_number: 'TEST-001',
    type: 'dine_in',
    table_number: '5',
    employee_name: (currentUser && currentUser.name) ? currentUser.name : 'المدير',
    items: [
      { item_name: 'طعام تجریبی 1', item_name_en: 'Test Dish 1', quantity: 2, price: 30 },
      { item_name: 'مشروب تجریبی 2', item_name_en: 'Test Drink 2', quantity: 1, price: 15 }
    ],
    total: 75,
    discount_percent: 0,
    payment_method: 'cash',
    created_at: new Date().toISOString()
  };

  toast(currentLang === 'ar' ? 'جاري إرسال طباعة تجريبية إلى: ' + p.name : 'Sending test print to: ' + p.name, 'info');
  generateReceipt(testOrder);
}

let currentServerUrl = window.location.origin;

async function loadServerNetworkInfo() {
  try {
    const net = await api('/api/settings/network');
    const primaryInput = document.getElementById('server-primary-url');
    const openBtn = document.getElementById('btn-open-server-url');
    const listContainer = document.getElementById('server-interfaces-list');
    
    if (net && net.primaryUrl) {
      currentServerUrl = net.primaryUrl;
      if (primaryInput) primaryInput.value = net.primaryUrl;
      if (openBtn) openBtn.href = net.primaryUrl;
    }

    if (listContainer && net && net.networkIps) {
      if (net.networkIps.length > 0) {
        listContainer.innerHTML = `
          <div style="margin-top:10px;font-size:12px;color:var(--text-light);font-weight:600;">عناوين الشبكات المتاحة على هذا الجهاز:</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;">
            ${net.networkIps.map(ip => `
              <div class="network-badge" style="background:var(--bg);border:1px solid var(--border);padding:6px 10px;border-radius:8px;display:flex;align-items:center;gap:6px;font-size:12px;">
                <span style="color:#28a745;">●</span>
                <strong>${ip.iface}:</strong>
                <code style="background:rgba(0,0,0,0.05);padding:2px 6px;border-radius:4px;">${ip.url}</code>
                <button type="button" class="btn" style="padding:2px 8px;font-size:11px;" onclick="copySpecificUrl('${ip.url}')">نسخ</button>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        listContainer.innerHTML = `<div style="font-size:12px;color:var(--text-light);margin-top:6px;">الرابط المحلي: <code>http://localhost:${net.port || 3000}</code></div>`;
      }
    }
  } catch(e) {
    console.warn('Network info endpoint note:', e.message);
    const primaryInput = document.getElementById('server-primary-url');
    if (primaryInput && (!primaryInput.value || primaryInput.value === '')) {
      primaryInput.value = window.location.origin;
    }
  }
}

function refreshNetworkInfo() {
  toast(currentLang === 'ar' ? 'جاري فحص وتحديث عنوان IP للسيرفر...' : 'Refreshing Server IP and Network links...', 'info');
  loadServerNetworkInfo().then(() => {
    toast(currentLang === 'ar' ? 'تم جلب عنوان السيرفر بنجاح' : 'Server network info updated', 'success');
  });
}

function copyServerUrl() {
  const input = document.getElementById('server-primary-url');
  if (!input) return;
  const url = input.value || window.location.origin;
  copySpecificUrl(url);
}

function copySpecificUrl(url) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      toast(currentLang === 'ar' ? `✅ تم نسخ الرابط: ${url} (أرسله للموظفين عبر الواتساب أو افتحه في جوالاتهم)` : `✅ Copied link: ${url}`, 'success');
    }).catch(() => fallbackCopy(url));
  } else {
    fallbackCopy(url);
  }
}

function fallbackCopy(text) {
  const temp = document.createElement('textarea');
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand('copy');
  document.body.removeChild(temp);
  toast(currentLang === 'ar' ? `✅ تم نسخ الرابط: ${text}` : `✅ Copied: ${text}`, 'success');
}
// ===== Dynamic Methods Management (Delivery & Payment) =====
let paymentMethodsList = [];
let deliveryMethodsList = [];
let manageMethodsType = 'payment'; // 'payment' or 'delivery'

function openManageDeliveryModal() {
  manageMethodsType = 'delivery';
  document.getElementById('manage-methods-title').textContent = 'إدارة تطبيقات التوصيل';
  renderManageMethodsTable();
  document.getElementById('manage-methods-modal').style.display = 'flex';
}

function openManagePaymentModal() {
  manageMethodsType = 'payment';
  document.getElementById('manage-methods-title').textContent = 'إدارة طرق الدفع';
  renderManageMethodsTable();
  document.getElementById('manage-methods-modal').style.display = 'flex';
}

function closeManageMethodsModal() {
  document.getElementById('manage-methods-modal').style.display = 'none';
}

function renderManageMethodsTable() {
  const tbody = document.getElementById('manage-methods-table-body');
  tbody.innerHTML = '';
  const list = manageMethodsType === 'payment' ? paymentMethodsList : deliveryMethodsList;
  
  list.forEach((item, index) => {
    const isActive = item.active !== false;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.id}</td>
      <td>${escapeHtml(item.name)}</td>
      <td>
        <label class="switch" style="transform: scale(0.8); margin: 0;">
          <input type="checkbox" ${isActive ? 'checked' : ''} onchange="toggleDynamicMethodStatus(${index}, this.checked)">
          <span class="slider round"></span>
        </label>
      </td>
      <td style="display:flex; gap:5px; justify-content:center;">
        <button class="btn btn-warning" style="padding:4px 8px; font-size:12px;" onclick="editDynamicMethod(${index})" data-i18n="edit_btn">تعديل ✏️</button>
        <button class="btn btn-danger" style="padding:4px 8px; font-size:12px;" onclick="deleteDynamicMethod(${index})" data-i18n="delete_btn">حذف 🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if (typeof applyTranslations === 'function') applyTranslations();
}

function toggleDynamicMethodStatus(index, isActive) {
  const list = manageMethodsType === 'payment' ? paymentMethodsList : deliveryMethodsList;
  list[index].active = isActive;
}

function editDynamicMethod(index) {
  const list = manageMethodsType === 'payment' ? paymentMethodsList : deliveryMethodsList;
  const method = list[index];
  const newName = prompt(currentLang === 'ar' ? 'الاسم الجديد للطريقة:' : 'New name for method:', method.name);
  if (newName && newName.trim()) {
    method.name = newName.trim();
    renderManageMethodsTable();
  }
}

function addDynamicMethod() {
  const idInput = document.getElementById('new-method-id');
  const nameInput = document.getElementById('new-method-name');
  const id = idInput.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const name = nameInput.value.trim();
  
  if (!id || !name) {
    return toast('يرجى إدخال المعرف والاسم', 'error');
  }
  
  const list = manageMethodsType === 'payment' ? paymentMethodsList : deliveryMethodsList;
  if (list.find(x => x.id === id)) {
    return toast('المعرف موجود مسبقاً', 'error');
  }
  
  list.push({ id, name, active: true });
  idInput.value = '';
  nameInput.value = '';
  renderManageMethodsTable();
}

function deleteDynamicMethod(index) {
  if (confirm('هل أنت متأكد من حذف هذه الطريقة؟')) {
    const list = manageMethodsType === 'payment' ? paymentMethodsList : deliveryMethodsList;
    list.splice(index, 1);
    renderManageMethodsTable();
  }
}

async function saveManagedMethods() {
  try {
    await api('/api/settings', 'PUT', {
      payment_methods_list: JSON.stringify(paymentMethodsList),
      delivery_methods_list: JSON.stringify(deliveryMethodsList)
    });
    toast('تم الحفظ بنجاح', 'success');
    closeManageMethodsModal();
  } catch (e) {
    toast('خطأ أثناء الحفظ', 'error');
  }
}

// ===== Backup & Restore =====
async function exportBackup() {
  try {
    toast(currentLang === 'ar' ? 'جاري التصدير...' : 'Exporting...', 'info');
    const data = await api('/api/backup/export');
    toast(t('backup_private'),'info');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `nokta-pos-backup-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(currentLang === 'ar' ? '✅ تم التصدير بنجاح' : '✅ Export successful', 'success');
  } catch (e) {
    toast(currentLang === 'ar' ? 'خطأ في التصدير' : 'Export failed', 'error');
  }
}

async function exportOrdersOnly() {
  try {
    const data = await api('/api/backup/export?type=orders');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `nokta-pos-orders-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(currentLang === 'ar' ? '✅ تم تصدير الطلبات' : '✅ Orders exported', 'success');
  } catch (e) {
    toast(currentLang === 'ar' ? 'خطأ في التصدير' : 'Export failed', 'error');
  }
}

let _restoreData = null;

function previewRestoreFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      _restoreData = JSON.parse(e.target.result);
      const preview = document.getElementById('restore-preview');
      const btn = document.getElementById('btn-restore-backup');
      const info = [];
      if (_restoreData.orders) info.push(`${currentLang === 'ar' ? 'طلبات' : 'Orders'}: ${_restoreData.orders.length}`);
      if (_restoreData.items) info.push(`${currentLang === 'ar' ? 'أصناف' : 'Items'}: ${_restoreData.items.length}`);
      if (_restoreData.employees) info.push(`${currentLang === 'ar' ? 'موظفين' : 'Employees'}: ${_restoreData.employees.length}`);
      if (_restoreData.tables) info.push(`${currentLang === 'ar' ? 'طاولات' : 'Tables'}: ${_restoreData.tables.length}`);
      const dateLabel = currentLang === 'ar' ? 'تاريخ النسخة' : 'Backup Date';
      const contentsLabel = currentLang === 'ar' ? 'المحتويات' : 'Contents';
      preview.innerHTML = `<strong>📁 ${escapeHtml(file.name)}</strong><br><span style="color:#888;">${dateLabel}: ${escapeHtml(_restoreData.exported_at || '—')}</span><br>${contentsLabel}: ${info.join(' | ')}`;
      preview.style.display = 'block';
      btn.disabled = false;
    } catch (err) {
      toast(currentLang === 'ar' ? 'ملف غير صالح' : 'Invalid file', 'error');
      _restoreData = null;
    }
  };
  reader.readAsText(file);
}

async function restoreBackup() {
  if (!_restoreData) return;
  const confirmMsg = currentLang === 'ar'
    ? '⚠️ هذا سيحل محل البيانات الحالية. هل أنت متأكد تماماً؟'
    : '⚠️ This will overwrite current data. Are you absolutely sure?';
  if (!confirm(confirmMsg)) return;
  try {
    toast(currentLang === 'ar' ? 'جاري الاستعادة...' : 'Restoring...', 'info');
    await api('/api/backup/restore', 'POST', _restoreData);
    toast(currentLang === 'ar' ? '✅ تمت الاستعادة بنجاح. ستتم إعادة التحميل.' : '✅ Restore successful. Reloading.', 'success');
    setTimeout(() => location.reload(), 2000);
  } catch (e) {
    toast(currentLang === 'ar' ? 'خطأ في الاستعادة' : 'Restore failed', 'error');
  }
}

