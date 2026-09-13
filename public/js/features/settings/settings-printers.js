// Printer discovery, configuration, category routing, and test printing.
// ===== Auto-Discover Connected Printers & Quick Testing =====
let detectedPrintersList = [];

async function detectLocalPrinters() {
  const btn = document.getElementById('btn-scan-printers');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ ' + (currentLang === 'ar' ? 'جاري الفحص...' : 'Scanning...');
  }

  try {
    detectedPrintersList = [];
    
    // 1. Try Electron Desktop API first (works reliably on Windows/Mac/Linux)
    if (window.noktaDesktop && typeof window.noktaDesktop.listPrinters === 'function') {
      console.log('🖥️ Using Electron printer detection API...');
      try {
        const electronPrinters = await window.noktaDesktop.listPrinters();
        console.log('Found', electronPrinters.length, 'system printers via Electron');
        
        electronPrinters.forEach(p => {
          detectedPrintersList.push({
            name: p.name + (p.isDefault ? ' ⭐' : ''),
            device: JSON.stringify({type: 'system', name: p.device}),
            type: 'system',
            isDefault: p.isDefault
          });
        });
        
        if (detectedPrintersList.length > 0) {
          toast(currentLang === 'ar' 
            ? `✅ تم العثور على ${detectedPrintersList.length} طابعة من النظام` 
            : `✅ Found ${detectedPrintersList.length} system printers`, 
            'success');
        }
      } catch (electronErr) {
        console.error('Electron printer detection failed:', electronErr);
      }
    }
    
    // 2. Fallback to server-side scanning (network printers + USB if available)
    if (detectedPrintersList.length === 0) {
      console.log('🌐 Falling back to server-side printer detection...');
      try {
        const data = await api('/api/print/scan');
        
        if (data.usb && data.usb.length) {
          data.usb.forEach(d => detectedPrintersList.push({ 
            name: d.name, 
            device: JSON.stringify({type:'usb', vendorId: d.vendorId, productId: d.productId}), 
            type: 'usb' 
          }));
        }
        if (data.network && data.network.length) {
          data.network.forEach(d => detectedPrintersList.push({ 
            name: d.name, 
            device: JSON.stringify({type:'network', address: d.address}), 
            type: 'network' 
          }));
        }
        if (data.bluetooth && data.bluetooth.length) {
          data.bluetooth.forEach(d => {
            if (d.type === 'bluetooth_hint') {
              detectedPrintersList.push({ name: d.name, device: '', type: 'hint' });
            } else {
              detectedPrintersList.push({ 
                name: d.name, 
                device: JSON.stringify({type:'bluetooth', address: d.address}), 
                type: 'bluetooth' 
              });
            }
          });
        }
        
        if (detectedPrintersList.length > 0) {
          toast(currentLang === 'ar' 
            ? `✅ تم العثور على ${detectedPrintersList.length} طابعة` 
            : `✅ Found ${detectedPrintersList.length} printers`, 
            'success');
        }
      } catch (serverErr) {
        console.error('Server printer detection failed:', serverErr);
      }
    }
      
    // Always add manual entry option
    detectedPrintersList.push({ 
      name: '➕ ' + (currentLang === 'ar' ? 'إضافة طابعة شبكة يدوياً (IP)' : 'Add Network Printer (IP)'), 
      device: 'manual_network', 
      type: 'network' 
    });

    // Update the select dropdown
    const selectEl = document.getElementById('printer-modal-device');
    if (selectEl) {
      selectEl.innerHTML = '<option value="">' + 
        (currentLang === 'ar' ? '-- اختر طابعة من المكتشفة --' : '-- Select a detected printer --') + 
        '</option>' +
        detectedPrintersList.map(p => {
          const icon = p.type === 'system' ? (p.isDefault ? '⭐' : '🖨️') : 
                       p.type === 'network' ? '🌐' : 
                       p.type === 'usb' ? '🔌' : 
                       p.type === 'hint' ? 'ℹ️' : '🖨️';
          return `<option value='${p.device}' data-name="${escapeHtml(p.name)}">${icon} ${escapeHtml(p.name)}</option>`;
        }).join('');
    }

    // Show appropriate message if no printers found
    if (detectedPrintersList.length <= 1) { // 1 because we always add "Manual Network"
      if (window.noktaDesktop) {
        toast(currentLang === 'ar' 
          ? '⚠️ لم يتم العثور على طابعات مثبتة. تأكد من تثبيت تعريف الطابعة في Windows أولاً، أو اختر طابعة شبكة يدوياً.' 
          : '⚠️ No installed printers found. Install printer drivers in Windows first, or add network printer manually.', 
          'warning');
      } else {
        toast(currentLang === 'ar' 
          ? 'ℹ️ يُنصح باستخدام تطبيق Desktop للتعرف التلقائي على الطابعات. أو اختر طابعة شبكة يدوياً.' 
          : 'ℹ️ Use Desktop app for automatic printer detection, or add network printer manually.', 
          'info');
      }
    }
  } catch (err) {
    console.error('Printer scan error:', err);
    toast(currentLang === 'ar' ? 'خطأ أثناء فحص الطابعات.' : 'Error scanning for printers.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🔍 ' + (currentLang === 'ar' ? 'فحص واكتشاف' : 'Scan Printers');
    }
  }
}

function renderPrintersList() {
  const tbody = document.getElementById('printers-config-tbody');
  if (!tbody) return;
  
  if (printersConfigList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-light);">' +
      '<div style="font-size:48px;margin-bottom:12px;">🖨️</div>' +
      '<div style="font-size:14px;">' + (currentLang === 'ar' ? 'لا توجد طابعات مضافة بعد' : 'No printers added yet') + '</div>' +
      '<div style="font-size:12px;margin-top:8px;">' + 
      (currentLang === 'ar' ? 'اضغط على "فحص واكتشاف" أعلاه للبدء' : 'Click "Scan Printers" above to start') + 
      '</div>' +
      '</td></tr>';
    return;
  }
  
  tbody.innerHTML = '';
  printersConfigList.forEach((p, idx) => {
    const tr = document.createElement('tr');
    
    // Printer type icon
    let deviceInfo = p.device || '';
    let typeIcon = '🖨️';
    let deviceDisplay = deviceInfo;
    
    try {
      const parsed = JSON.parse(deviceInfo);
      if (parsed.type === 'system') {
        typeIcon = '🖥️';
        deviceDisplay = parsed.name || deviceInfo;
      } else if (parsed.type === 'network') {
        typeIcon = '🌐';
        deviceDisplay = parsed.address || deviceInfo;
      } else if (parsed.type === 'usb') {
        typeIcon = '🔌';
        deviceDisplay = `USB (${parsed.vendorId}:${parsed.productId})`;
      } else if (parsed.type === 'bluetooth') {
        typeIcon = '📶';
        deviceDisplay = parsed.address || deviceInfo;
      }
    } catch (e) {
      // Keep default display
    }
    
    tr.innerHTML = 
      '<td><strong>' + typeIcon + ' ' + escapeHtml(p.name || '-') + '</strong></td>' +
      '<td><code style="font-size:11px;background:#f5f5f5;padding:2px 6px;border-radius:3px;display:inline-block;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escapeHtml(deviceDisplay) + '">' + 
      escapeHtml(deviceDisplay) + '</code></td>' +
      '<td style="font-size:12px;">' + escapeHtml(getPrinterCategoryNames(p.category_ids).join('، ') || (currentLang === 'ar' ? 'الكل' : 'All')) + '</td>' +
      '<td><span class="status-badge ' + (p.auto_print ? 'status-active' : 'status-inactive') + '">' +
      (p.auto_print ? (currentLang === 'ar' ? 'تلقائي ✓' : 'Auto ✓') : (currentLang === 'ar' ? 'يدوي' : 'Manual')) + '</span></td>' +
      '<td style="white-space:nowrap;">' +
      '<button class="btn btn-save" style="padding:6px 10px;font-size:12px;margin:0 2px;" onclick="testPrintSpecific(' + idx + ')" title="' + 
      (currentLang === 'ar' ? 'طباعة تجريبية' : 'Test print') + '">🖨️</button> ' +
      '<button class="btn btn-primary" style="padding:6px 10px;font-size:12px;margin:0 2px;" onclick="openPrinterModal(' + idx + ')" title="' + 
      (currentLang === 'ar' ? 'تعديل' : 'Edit') + '">✏️</button> ' +
      '<button class="btn" style="background:#e74c3c;color:#fff;padding:6px 10px;font-size:12px;margin:0 2px;" onclick="deletePrinterConfig(' + idx + ')" title="' + 
      (currentLang === 'ar' ? 'حذف' : 'Delete') + '">🗑️</button>' +
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
    document.getElementById('printer-modal-auto').checked = p.auto_print !== false; // Default true
    renderPrinterCategoryChoices(p.category_ids || []);
  } else {
    // New printer - set defaults
    document.getElementById('printer-modal-name').value = '';
    document.getElementById('printer-modal-device').value = '';
    document.getElementById('printer-modal-auto').checked = true;
    renderPrinterCategoryChoices([]);
    
    // Auto-run detection if no printers in list yet
    if (detectedPrintersList.length === 0) {
      setTimeout(() => detectLocalPrinters(), 300);
    }
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
  
  if (!name) {
    toast(currentLang === 'ar' ? 'الرجاء إدخال اسم الطابعة' : 'Please enter printer name', 'error');
    return;
  }
  
  if (!device || device === '') {
    toast(currentLang === 'ar' ? 'الرجاء اختيار طابعة من القائمة' : 'Please select a printer', 'error');
    return;
  }
  
  const config = { name, device, auto_print, category_ids };
  
  if (index >= 0) {
    printersConfigList[index] = config;
    toast(currentLang === 'ar' ? '✅ تم تحديث إعدادات الطابعة' : '✅ Printer updated', 'success');
  } else {
    printersConfigList.push(config);
    toast(currentLang === 'ar' ? '✅ تم إضافة الطابعة' : '✅ Printer added', 'success');
  }
  
  document.getElementById('printer-modal').classList.remove('open');
  renderPrintersList();
  saveSettings();
}

function deletePrinterConfig(index) {
  const p = printersConfigList[index];
  const confirmMsg = currentLang === 'ar' 
    ? `هل أنت متأكد من حذف الطابعة "${p.name}"؟` 
    : `Delete printer "${p.name}"?`;
  
  if (!confirm(confirmMsg)) return;
  
  printersConfigList.splice(index, 1);
  renderPrintersList();
  saveSettings();
  toast(currentLang === 'ar' ? '✅ تم حذف الطابعة' : '✅ Printer deleted', 'success');
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
