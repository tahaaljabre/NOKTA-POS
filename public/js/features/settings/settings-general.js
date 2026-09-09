// General business settings loading and saving.
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
  if (el('set-currency')) el('set-currency').value = s.currency || '?';
  if (el('set-tax-rate')) el('set-tax-rate').value = s.tax_rate || '0';
  if (el('set-tax-type')) el('set-tax-type').value = s.tax_type || 'exclusive';
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

  // Setup Live Preview listeners
  ['set-restaurant-name', 'set-restaurant-name-en', 'set-restaurant-address', 'set-restaurant-phone', 'set-tax-number', 'set-tax-rate', 'set-tax-type', 'set-receipt-footer', 'set-currency'].forEach(id => {
    const element = el(id);
    if(element) {
      element.addEventListener('input', updateReceiptPreview);
      if(element.tagName === 'SELECT') element.addEventListener('change', updateReceiptPreview);
    }
  });
  updateReceiptPreview(); // initial call
}

function updateReceiptPreview() {
  const frame = document.getElementById('receipt-preview-frame');
  if (!frame) return;
  const doc = frame.contentWindow.document;
  
  const el = id => document.getElementById(id);
  const name = el('set-restaurant-name')?.value || 'Restaurant Name';
  const nameEn = el('set-restaurant-name-en')?.value || 'Restaurant Name (EN)';
  const addr = el('set-restaurant-address')?.value || '';
  const phone = el('set-restaurant-phone')?.value || '';
  const taxNo = el('set-tax-number')?.value || '';
  const taxRate = parseFloat(el('set-tax-rate')?.value || '0');
  const taxType = el('set-tax-type')?.value || 'exclusive';
  const footer = el('set-receipt-footer')?.value || '';
  const currency = el('set-currency')?.value || '?';

  let subtotal = 100.00;
  let taxAmt = 0;
  let total = subtotal;

  if (taxType === 'inclusive') {
    taxAmt = subtotal - (subtotal / (1 + (taxRate/100)));
  } else {
    taxAmt = subtotal * (taxRate/100);
    total = subtotal + taxAmt;
  }
  
  const html = `<!DOCTYPE html>
<html lang="${currentLang}" dir="${currentLang === 'ar' ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, sans-serif; font-size: 11px; color: #000; padding: 10px; margin: 0; line-height: 1.3; text-align: center; }
    .restaurant-title { font-size: 14px; font-weight: 800; text-transform: uppercase; margin-bottom: 3px; }
    .header-info { font-size: 9.5px; font-weight: 500; }
    .tax-badge { font-size: 9.5px; font-weight: 600; margin: 2px 0; }
    .dash-line { border-top: 1px dashed #000; margin: 5px 0; }
    .double-line { border-top: 2px solid #000; margin: 5px 0; }
    .items-table { width: 100%; font-size: 10.5px; border-collapse: collapse; margin: 4px 0; }
    .items-table th { border-bottom: 1px solid #000; }
    .text-right { text-align: right; } .text-center { text-align: center; } .text-left { text-align: left; }
    .total-row { display: flex; justify-content: space-between; font-size: 11.5px; margin-top: 2px; }
    .grand-total { font-size: 14px; font-weight: 800; padding: 3px 0; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="restaurant-title">${escapeHtml(currentLang==='ar'?name:nameEn)}</div>
  ${addr ? `<div class="header-info">${escapeHtml(addr)}</div>` : ''}
  ${phone ? `<div class="header-info">${escapeHtml(phone)}</div>` : ''}
  ${taxNo ? `<div class="tax-badge">${currentLang==='ar'?'Tax Invoice / ใบกำกับภาษีอย่างย่อ':'Tax Invoice'}<br>${currentLang==='ar'?'الرقم الضريبي':'Tax ID'}: ${escapeHtml(taxNo)}</div>` : ''}
  <div class="dash-line"></div>
  <table class="items-table">
    <tr><th class="text-right">${currentLang==='ar'?'الصنف':'Item'}</th><th class="text-center">${currentLang==='ar'?'الكمية':'Qty'}</th><th class="text-left">${currentLang==='ar'?'المجموع':'Total'}</th></tr>
    <tr><td class="text-right">${currentLang==='ar'?'صنف تجريبي':'Sample Item'}<br><span style="font-size:9px;color:#555">100.00</span></td><td class="text-center">1</td><td class="text-left">100.00</td></tr>
  </table>
  <div class="double-line"></div>
  <div class="total-row"><span>${currentLang === 'ar' ? (taxType === 'inclusive' ? 'الإجمالي قبل الضريبة' : 'المجموع') : (taxType === 'inclusive' ? 'Subtotal (Before Tax)' : 'Subtotal')}</span><span>${(subtotal - (taxType === 'inclusive'?taxAmt:0)).toFixed(2)} ${escapeHtml(currency)}</span></div>
  ${taxRate > 0 ? `<div class="total-row"><span>${currentLang === 'ar' ? 'الضريبة' : 'VAT'} (${taxRate}%) ${taxType==='inclusive'?(currentLang==='ar'?'(مشمولة)':'(Incl)'):''}</span><span>${taxAmt.toFixed(2)} ${escapeHtml(currency)}</span></div>` : ''}
  <div class="total-row grand-total"><span>${currentLang === 'ar' ? 'الإجمالي النهائي' : 'TOTAL'}</span><span>${total.toFixed(2)} ${escapeHtml(currency)}</span></div>
  <div class="dash-line"></div>
  <div style="font-size:9.5px; margin-top:6px;">${escapeHtml(footer || (currentLang==='ar'?'شكراً لزيارتكم':'Thank you for visiting'))}</div>
</body>
</html>`;
  doc.open();
  doc.write(html);
  doc.close();
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
      tax_type: el('set-tax-type')?.value || 'exclusive',
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
