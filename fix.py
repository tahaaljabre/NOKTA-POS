import os

file_path = 'public/js/settings.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

start_str = 'async function detectLocalPrinters() {'
end_str = 'async function loadServerNetworkInfo() {'

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    replacement = '''async function detectLocalPrinters() {
  const btn = document.getElementById('btn-scan-printers');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ جاري فحص واكتشاف الطابعات...';
  }

  try {
    if ('navigator' in window && 'usb' in navigator) {
      try {
        const devices = await navigator.usb.getDevices();
        devices.forEach((d, idx) => {
          detectedPrintersList.push({
            id: web_usb_,
            name: ${d.productName || 'USB Printer'} (),
            type: 'usb',
            port: USB-
          });
        });
      } catch (e) {}
    }

    const selectEl = document.getElementById('printer-modal-device');
    if (selectEl) {
      selectEl.innerHTML = '<option value="">-- اختر طابعة من المكتشفة --</option>' +
        detectedPrintersList.map(p => <option value="" data-name="">🖨️  []</option>).join('');
    }

    toast(currentLang === 'ar' ? ✅ تم التعرف على  طابعات متصلة بنجاح! : ✅ Discovered  connected printers!, 'success');
  } catch (err) {
    console.error('Printer scan error:', err);
    toast(currentLang === 'ar' ? 'تم فحص المنافذ وجلب الطابعات المتاحة' : 'Scanned ports and loaded available printers', 'info');
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
      <td></td>
      <td></td>
      <td>
        <span class="status-badge ">
          
        </span>
      </td>
      <td>
        <button class="btn btn-save" style="padding:4px 8px;font-size:12px;" onclick="testPrintSpecific()">🖨️ تجربة</button>
        <button class="btn btn-primary" style="padding:4px 8px;font-size:12px;" onclick="openPrinterModal()">تعديل</button>
        <button class="btn" style="background:#e74c3c;color:#fff;padding:4px 8px;font-size:12px;" onclick="deletePrinterConfig()">حذف</button>
      </td>
    ;
    tbody.appendChild(tr);
  });
}

function openPrinterModal(index = -1) {
  document.getElementById('printer-modal').classList.add('open');
  document.getElementById('printer-modal-index').value = index;
  
  if (index >= 0 && printersConfigList[index]) {
    const p = printersConfigList[index];
    document.getElementById('printer-modal-name').value = p.name || '';
    document.getElementById('printer-modal-device').value = p.device || '';
    document.getElementById('printer-modal-auto').checked = p.auto_print || false;
  } else {
    document.getElementById('printer-modal-name').value = '';
    document.getElementById('printer-modal-device').value = '';
    document.getElementById('printer-modal-auto').checked = true;
  }
}

function savePrinterConfig() {
  const index = parseInt(document.getElementById('printer-modal-index').value);
  const name = document.getElementById('printer-modal-name').value.trim();
  const device = document.getElementById('printer-modal-device').value;
  const auto_print = document.getElementById('printer-modal-auto').checked;
  
  if (!name) return toast('الرجاء إدخال اسم القسم', 'error');
  
  const config = { name, device, auto_print };
  
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
      { item_name: 'طعام تجريبي 1 (Test Dish)', item_name_en: 'Test Dish 1', quantity: 2, price: 30 },
      { item_name: 'مشروب تجريبي 2 (Test Drink)', item_name_en: 'Test Drink 2', quantity: 1, price: 15 }
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

'''
    new_content = content[:start_idx] + replacement + content[end_idx:]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Fixed file!")
else:
    print("Could not find markers")
