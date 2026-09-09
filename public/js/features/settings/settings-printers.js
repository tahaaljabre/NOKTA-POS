// Printer discovery, configuration, category routing, and test printing.
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
