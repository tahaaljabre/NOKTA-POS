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
