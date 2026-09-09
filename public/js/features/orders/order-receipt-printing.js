// Customer receipt preview and printing.
async function printOrder() {
  if (!currentOrder.items.length) {
    toast(currentLang === 'ar' ? 'أضف صنفاً قبل الطباعة' : 'Add items before printing', 'error');
    return;
  }
  await generateReceipt({
    ...currentOrder,
    total: getOrderTotal(),
    discount_percent: currentOrder.discount || 0,
    employee_name: currentUser?.name || '',
    created_at: new Date().toISOString()
  });
}

async function generateReceipt(order, targetPrinterType = 'cashier') {
  let s = {};
  try { s = await api('/api/settings'); } catch(e) {}
  const currency = getCurrency();
  const name = currentLang === 'ar' ? (s.restaurant_name || appRestaurantName || 'اسم المنشأة') : (s.restaurant_name_en || appRestaurantNameEn || s.restaurant_name || 'Your Business');
  const addr = s.restaurant_address || '';
  const phone = s.restaurant_phone || '';
  const taxNo = s.tax_number || '';
  const taxRate = parseFloat(s.tax_rate) || 0;
  const taxType = s.tax_type || 'exclusive';
  
  const paymentLabels = {
    cash: currentLang === 'ar' ? '💵 نقداً (Cash)' : '💵 Cash',
    promptpay: '📱 PromptPay QR',
    truemoney: '💳 TrueMoney',
    card: currentLang === 'ar' ? '💳 بطاقة (Card)' : '💳 Card'
  };
  const payMethod = order.payment_method || 'cash';
  const payList = (typeof paymentMethodsList !== 'undefined') ? paymentMethodsList : [];
  const foundPay = payList.find(x => x.id === payMethod);
  const payLabel = foundPay ? foundPay.name : payMethod;

  const typeLabels = {
    dine_in: currentLang === 'ar' ? 'محلي / جلوس' : 'Dine In',
    takeaway: currentLang === 'ar' ? 'سفري / Takeaway' : 'Takeaway',
    delivery: currentLang === 'ar' ? 'توصيل / Delivery' : 'Delivery'
  };

  const invoiceNo = order.invoice_number || order.id || '-';
  let orderType = typeLabels[order.type] || order.type || '';
  if (order.type === 'delivery') {
    let attrs = {};
    if (typeof order.attributes === 'string') {
      try { attrs = JSON.parse(order.attributes); } catch(e) {}
    } else if (order.attributes) {
      attrs = order.attributes;
    }
    if (attrs.delivery_app) {
      orderType += ' - ' + attrs.delivery_app;
    }
  }
  const stationName = order.station_id === 'cashier_floor2' ? (currentLang === 'ar' ? 'كاشير الدور 2' : 'Floor 2 Cashier') : (currentLang === 'ar' ? 'كاشير الدور 1' : 'Floor 1 Cashier');

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;

  const html = `<!DOCTYPE html>
<html lang="${currentLang}" dir="${currentLang === 'ar' ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <title>Receipt #${escapeHtml(invoiceNo)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      width: 76mm;
      margin: 0 auto;
      padding: 4mm 2mm;
      font-family: 'Readex Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif;
      font-size: 11px;
      color: #000;
      background: #fff;
      line-height: 1.3;
      text-align: center;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .restaurant-title {
      font-size: 14px;
      font-weight: 800;
      color: #000;
      margin-bottom: 3px;
      line-height: 1.25;
      text-transform: uppercase;
    }
    .header-info {
      font-size: 9.5px;
      font-weight: 500;
      color: #333;
      margin-bottom: 2px;
      line-height: 1.25;
    }
    .tax-badge {
      font-size: 9.5px;
      font-weight: 600;
      color: #000;
      margin-top: 2px;
      margin-bottom: 2px;
    }
    .dash-line {
      border-top: 1px dashed #000;
      margin: 5px 0;
    }
    .double-line {
      border-top: 2px solid #000;
      margin: 5px 0;
    }
    .bill-info {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      font-weight: 600;
      margin: 2px 0;
      text-align: right;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
      font-size: 10.5px;
    }
    .items-table th {
      border-bottom: 1px solid #000;
      padding: 3px 0;
      font-weight: 700;
    }
    .items-table td {
      padding: 3px 0;
      vertical-align: top;
    }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .text-center { text-align: center; }
    .total-section {
      margin-top: 4px;
      font-size: 11.5px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
    }
    .grand-total-row {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      font-weight: 800;
      padding: 3px 0;
      border-top: 1.5px solid #000;
      border-bottom: 1.5px solid #000;
      margin: 3px 0;
    }
    .payment-highlight {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 700;
      background: #f0f0f0;
      padding: 3px 6px;
      border-radius: 4px;
      margin: 3px 0;
    }
    .footer-text {
      margin-top: 6px;
      font-size: 9.5px;
      color: #333;
    }
    .drawer-kick {
      display: none;
    }
  </style>
</head>
<body>
  <div class="restaurant-title">${escapeHtml(name)}</div>
  ${addr ? `<div class="header-info">📍 ${escapeHtml(addr)}</div>` : ''}
  ${phone ? `<div class="header-info">📞 ${escapeHtml(phone)}</div>` : ''}
  ${taxNo ? `<div class="tax-badge">${currentLang === 'ar' ? 'Tax Invoice / ใบกำกับภาษีอย่างย่อ' : 'Tax Invoice / ใบกำกับภาษีอย่างย่อ'}<br>🏛️ ${currentLang === 'ar' ? 'الرقم الضريبي' : 'Tax ID'}: <strong>${escapeHtml(taxNo)}</strong></div>` : ''}
  
  <div class="dash-line"></div>
  
  <div class="bill-info">
    <span>${currentLang === 'ar' ? 'رقم الفاتورة' : 'Invoice #'}: <strong>${escapeHtml(invoiceNo)}</strong></span>
    <span>${escapeHtml(orderType)}</span>
  </div>
  <div class="bill-info">
    <span>${escapeHtml(stationName)}</span>
    <span>${order.table_number ? `${currentLang === 'ar' ? 'طاولة' : 'Table'}: <strong>${order.table_number}</strong>` : ''}</span>
  </div>
  <div class="bill-info">
    <span>${currentLang === 'ar' ? 'الكاشير' : 'Cashier'}: ${escapeHtml(order.employee_name || 'System')}</span>
    <span>${new Date(order.created_at || Date.now()).toLocaleTimeString(currentLang === 'ar' ? 'ar-SA' : 'en-US')}</span>
  </div>
  
  <div class="double-line"></div>
  
  <table class="items-table">
    <thead>
      <tr>
        <th class="text-right">${currentLang === 'ar' ? 'الصنف' : 'Item'}</th>
        <th class="text-center">${currentLang === 'ar' ? 'الكمية' : 'Qty'}</th>
        <th class="text-left">${currentLang === 'ar' ? 'الإجمالي' : 'Total'}</th>
      </tr>
    </thead>
    <tbody>
      ${(order.items || []).map(i => `
        <tr>
          <td class="text-right">
            <div><strong>${escapeHtml(currentLang === 'ar' ? (i.item_name || i.name) : (i.item_name_en || i.name_en || i.item_name || i.name))}</strong></div>
            <div style="font-size:9px;color:#555;">${i.price} ${escapeHtml(currency)}</div>
          </td>
          <td class="text-center" style="font-size:12px;font-weight:bold;">${i.quantity}</td>
          <td class="text-left" style="font-weight:bold;">${(i.price * i.quantity).toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <div class="double-line"></div>
  
  <div class="total-section">
    ${(() => {
      let html = '';
      const total = order.total || 0;
      let subtotal = order.subtotal || ((order.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0));
      let taxAmt = order.tax_amount || 0;
      if (!order.tax_amount && taxRate > 0) {
         if (taxType === 'inclusive') {
           taxAmt = subtotal - (subtotal / (1 + (taxRate/100)));
         } else {
           taxAmt = subtotal * (taxRate/100);
         }
      }

      if (order.discount_percent > 0) {
        html += `<div class="total-row"><span>${t('subtotal')}</span><span>${subtotal.toFixed(2)} ${escapeHtml(currency)}</span></div>`;
        html += `<div class="total-row"><span>${t('discount')} (${order.discount_percent}%)</span><span>-${(subtotal * (order.discount_percent/100)).toFixed(2)} ${escapeHtml(currency)}</span></div>`;
        subtotal = subtotal - (subtotal * (order.discount_percent/100));
      }

      html += `<div class="total-row"><span>${currentLang === 'ar' ? (taxType === 'inclusive' ? 'الإجمالي قبل الضريبة' : 'المجموع') : (taxType === 'inclusive' ? 'Subtotal (Before Tax)' : 'Subtotal')}</span><span>${(subtotal - (taxType === 'inclusive' ? taxAmt : 0)).toFixed(2)} ${escapeHtml(currency)}</span></div>`;
      
      if (taxRate > 0 || taxAmt > 0) {
        html += `<div class="total-row"><span>${currentLang === 'ar' ? 'الضريبة' : 'VAT'} (${taxRate}%) ${taxType==='inclusive'?(currentLang==='ar'?'(مشمولة)':'(Incl)'):''}</span><span>${taxAmt.toFixed(2)} ${escapeHtml(currency)}</span></div>`;
      }
      return html;
    })()}
    
    <div class="grand-total-row">
      <span>${currentLang === 'ar' ? 'الإجمالي النهائي' : 'TOTAL'}</span>
      <span>${(order.total || 0).toFixed(2)} ${escapeHtml(currency)}</span>
    </div>
    
    <div class="payment-highlight">
      <span>${currentLang === 'ar' ? 'طريقة الدفع' : 'Payment'}</span>
      <span>${escapeHtml(payLabel)}</span>
    </div>
    ${(payMethod === 'cash' && order.cash_received && order.cash_received >= (order.total || 0)) ? `
      <div class="total-row" style="font-size:10px;margin-top:2px;">
        <span>${currentLang === 'ar' ? 'المبلغ المدفوع' : 'Cash Tendered'}</span>
        <span>${parseFloat(order.cash_received).toFixed(2)} ${escapeHtml(currency)}</span>
      </div>
      <div class="total-row" style="font-size:10.5px;font-weight:700;color:#000;">
        <span>${currentLang === 'ar' ? 'المتبقي (الباقي)' : 'Change Return'}</span>
        <span>${(parseFloat(order.cash_received) - (order.total || 0)).toFixed(2)} ${escapeHtml(currency)}</span>
      </div>
    ` : ''}
  </div>
  
  <div class="dash-line"></div>
  <div class="footer-text">${s.receipt_footer || t('receipt_thank')}</div>
  <div style="font-size:9px;color:#888;margin-top:4px;">*** نظام نقاط البيع ***</div>
</body>
</html>`;

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.error('Print iframe error:', err);
    }
    setTimeout(() => { document.body.removeChild(iframe); }, 4000);
  }, 400);
}
