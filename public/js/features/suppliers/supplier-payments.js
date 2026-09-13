// ==================== SUPPLIER PAYMENTS - سندات الصرف للموردين ====================

let currentPaymentSupplier = null;

// ==================== OPEN PAYMENT FORM ====================

function openPaymentForm(supplierId) {
  currentPaymentSupplier = suppliersData.find(s => s.id === supplierId);
  
  if (!currentPaymentSupplier) {
    toast(t('supplier_not_found') || 'المورد غير موجود', 'error');
    return;
  }
  
  // Close any open details modal first
  const detailsModal = document.getElementById('modal-supplier-details');
  if (detailsModal) {
    hideSupplierModal('modal-supplier-details');
  }
  
  const modalHtml = `
    <div id="modal-payment-form" class="modal">
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <h3>
            <i class="fas fa-money-bill-wave"></i>
            <span data-i18n="payment_voucher">سند صرف</span>
          </h3>
          <button class="modal-close" onclick="closePaymentModal()">&times;</button>
        </div>
        
        <div class="modal-body">
          <!-- Supplier Info Card -->
          <div class="payment-supplier-card">
            <div class="supplier-card-content">
              <div class="supplier-avatar-large">
                <i class="fas fa-building"></i>
              </div>
              <div class="supplier-details">
                <h4>${escapeHtml(currentPaymentSupplier.name)}</h4>
                ${currentPaymentSupplier.name_en ? `<p class="text-muted">${escapeHtml(currentPaymentSupplier.name_en)}</p>` : ''}
                <div class="supplier-balance-info">
                  <span class="balance-label">${t('current_balance') || 'الرصيد الحالي'}:</span>
                  <span class="balance-value ${currentPaymentSupplier.current_balance > 0 ? 'text-success' : currentPaymentSupplier.current_balance < 0 ? 'text-danger' : ''}">
                    ${formatCurrency(Math.abs(currentPaymentSupplier.current_balance || 0))}
                    ${currentPaymentSupplier.current_balance > 0 ? '<small>(' + (t('we_owe') || 'لنا') + ')</small>' : 
                      currentPaymentSupplier.current_balance < 0 ? '<small>(' + (t('owe_us') || 'علينا') + ')</small>' : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <form id="form-payment">
            <!-- Payment Information -->
            <div class="form-section">
              <h4 class="section-title">
                <i class="fas fa-file-invoice-dollar"></i>
                <span data-i18n="payment_info">معلومات السند</span>
              </h4>
              <div class="form-grid-2">
                <div class="form-group">
                  <label data-i18n="payment_date">تاريخ الدفع *</label>
                  <input type="date" name="payment_date" required value="${getTodayDate()}">
                </div>
                <div class="form-group">
                  <label data-i18n="amount">المبلغ *</label>
                  <input type="number" name="amount" id="payment-amount" required min="0.01" step="0.01" placeholder="0.00">
                </div>
              </div>
            </div>
            
            <!-- Payment Method -->
            <div class="form-section">
              <h4 class="section-title">
                <i class="fas fa-credit-card"></i>
                <span data-i18n="payment_method">طريقة الدفع</span>
              </h4>
              <div class="payment-method-selector">
                <label class="payment-method-option">
                  <input type="radio" name="payment_method" value="cash" checked>
                  <div class="method-card">
                    <i class="fas fa-money-bill-wave"></i>
                    <span data-i18n="cash">نقدي</span>
                  </div>
                </label>
                <label class="payment-method-option">
                  <input type="radio" name="payment_method" value="check">
                  <div class="method-card">
                    <i class="fas fa-money-check"></i>
                    <span data-i18n="check">شيك</span>
                  </div>
                </label>
                <label class="payment-method-option">
                  <input type="radio" name="payment_method" value="bank_transfer">
                  <div class="method-card">
                    <i class="fas fa-university"></i>
                    <span data-i18n="bank_transfer">تحويل بنكي</span>
                  </div>
                </label>
              </div>
            </div>
            
            <!-- Payment Details -->
            <div class="form-section" id="payment-details-section">
              <h4 class="section-title">
                <i class="fas fa-info-circle"></i>
                <span data-i18n="additional_details">تفاصيل إضافية</span>
              </h4>
              <div class="form-grid-2">
                <div class="form-group" id="check-number-group" style="display: none;">
                  <label data-i18n="check_number">رقم الشيك</label>
                  <input type="text" name="check_number" placeholder="123456">
                </div>
                <div class="form-group" id="bank-name-group" style="display: none;">
                  <label data-i18n="bank_name">اسم البنك</label>
                  <input type="text" name="bank_name" placeholder="${currentPaymentSupplier.bank_name || ''}">
                </div>
                <div class="form-group form-group-full">
                  <label data-i18n="reference_number">رقم المرجع</label>
                  <input type="text" name="reference_number" placeholder="${t('reference_placeholder') || 'رقم مرجعي اختياري'}">
                </div>
                <div class="form-group form-group-full">
                  <label data-i18n="received_by">استلم بواسطة</label>
                  <input type="text" name="received_by" placeholder="${t('receiver_name') || 'اسم المستلم'}">
                </div>
              </div>
            </div>
            
            <!-- Notes -->
            <div class="form-section">
              <h4 class="section-title">
                <i class="fas fa-sticky-note"></i>
                <span data-i18n="notes">ملاحظات</span>
              </h4>
              <div class="form-group">
                <textarea name="notes" rows="3" data-i18n-placeholder="payment_notes_placeholder" placeholder="ملاحظات حول الدفعة..."></textarea>
              </div>
            </div>
            
            <!-- Payment Summary -->
            <div class="payment-summary-card">
              <div class="summary-row">
                <span data-i18n="current_balance">الرصيد الحالي:</span>
                <strong class="${currentPaymentSupplier.current_balance > 0 ? 'text-success' : currentPaymentSupplier.current_balance < 0 ? 'text-danger' : ''}">
                  ${formatCurrency(Math.abs(currentPaymentSupplier.current_balance || 0))}
                </strong>
              </div>
              <div class="summary-row">
                <span data-i18n="payment_amount">مبلغ الدفعة:</span>
                <strong id="summary-payment-amount" class="text-primary">0.00</strong>
              </div>
              <div class="summary-divider"></div>
              <div class="summary-row summary-total">
                <span data-i18n="balance_after_payment">الرصيد بعد الدفع:</span>
                <strong id="summary-new-balance">0.00</strong>
              </div>
            </div>
          </form>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="closePaymentModal()">
            <i class="fas fa-times"></i>
            <span data-i18n="cancel">إلغاء</span>
          </button>
          <button type="button" class="btn btn-primary btn-lg" onclick="savePayment(this)">
            <i class="fas fa-check"></i>
            <span data-i18n="confirm_payment">تأكيد الدفع</span>
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Inject modal
  let existingModal = document.getElementById('modal-payment-form');
  if (existingModal) {
    existingModal.remove();
  }
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Setup event listeners
  const modal = document.getElementById('modal-payment-form');
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closePaymentModal();
    }
  });
  
  // Prevent modal content clicks from closing
  modal.querySelector('.modal-content')?.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // Setup form listeners
  setupPaymentFormListeners();
  
  showSupplierModal('modal-payment-form');
}

// ==================== SETUP EVENT LISTENERS ====================

function setupPaymentFormListeners() {
  // Payment method change
  document.querySelectorAll('input[name="payment_method"]').forEach(radio => {
    radio.addEventListener('change', handlePaymentMethodChange);
  });
  
  // Amount change
  document.getElementById('payment-amount')?.addEventListener('input', updatePaymentSummary);
  
  // Initial setup
  handlePaymentMethodChange();
}

function handlePaymentMethodChange() {
  const method = document.querySelector('input[name="payment_method"]:checked')?.value;
  const checkNumberGroup = document.getElementById('check-number-group');
  const bankNameGroup = document.getElementById('bank-name-group');
  
  if (method === 'check') {
    checkNumberGroup.style.display = 'block';
    bankNameGroup.style.display = 'block';
  } else if (method === 'bank_transfer') {
    checkNumberGroup.style.display = 'none';
    bankNameGroup.style.display = 'block';
  } else {
    checkNumberGroup.style.display = 'none';
    bankNameGroup.style.display = 'none';
  }
}

function updatePaymentSummary() {
  const amount = parseFloat(document.getElementById('payment-amount')?.value || 0);
  const currentBalance = currentPaymentSupplier.current_balance || 0;
  const newBalance = currentBalance - amount;
  
  document.getElementById('summary-payment-amount').textContent = formatCurrency(amount);
  
  const newBalanceEl = document.getElementById('summary-new-balance');
  newBalanceEl.textContent = formatCurrency(Math.abs(newBalance));
  newBalanceEl.className = newBalance > 0 ? 'text-success' : newBalance < 0 ? 'text-danger' : '';
}

// ==================== SAVE PAYMENT ====================

async function savePayment(button) {
  const form = document.getElementById('form-payment');
  
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  
  const formData = new FormData(form);
  const amount = parseFloat(formData.get('amount'));
  
  if (amount <= 0) {
    toast(t('invalid_amount') || 'المبلغ غير صحيح', 'error');
    return;
  }
  
  const data = {
    payment_date: formData.get('payment_date'),
    amount: amount,
    payment_method: formData.get('payment_method'),
    check_number: formData.get('check_number'),
    bank_name: formData.get('bank_name'),
    reference_number: formData.get('reference_number'),
    notes: formData.get('notes'),
    received_by: formData.get('received_by')
  };
  
  try {
    const btn = button;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (t('processing') || 'جاري المعالجة...');
    
    const result = await api(`/api/suppliers/${currentPaymentSupplier.id}/payments`, 'POST', data);
    
    toast(t('payment_saved') || 'تم تسجيل سند الصرف بنجاح', 'success');
    closePaymentModal();
    
    // Refresh data
    await loadStatistics();
    await loadSuppliers();
    
    // If viewing supplier details, refresh
    if (currentSupplier && currentSupplier.id === currentPaymentSupplier.id) {
      viewSupplierDetails(currentSupplier.id);
    }
    
    // Offer to print
    if (confirm(t('print_payment_voucher') || 'هل تريد طباعة سند الصرف؟')) {
      printPaymentVoucher(result.id, result.payment_number);
    }
  } catch (error) {
    console.error('Error saving payment:', error);
    toast(error.message || t('error_saving_payment') || 'خطأ في حفظ سند الصرف', 'error');
    
    const btn = document.querySelector('#modal-payment-form .btn-primary');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> ' + (t('confirm_payment') || 'تأكيد الدفع');
  }
}

// ==================== PRINT PAYMENT VOUCHER ====================

async function printPaymentVoucher(paymentId, paymentNumber) {
  try {
    const payment = await api(`/api/suppliers/${currentPaymentSupplier.id}/payments`);
    const paymentData = payment.find(p => p.payment_number === paymentNumber);
    
    if (!paymentData) {
      toast(t('payment_not_found') || 'سند الصرف غير موجود', 'error');
      return;
    }
    
    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>${t('payment_voucher') || 'سند صرف'} - ${paymentNumber}</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            padding: 40px;
            direction: rtl;
          }
          .voucher-container {
            max-width: 800px;
            margin: 0 auto;
            border: 2px solid #333;
            padding: 30px;
          }
          .voucher-header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .voucher-header h1 {
            margin: 0;
            font-size: 32px;
          }
          .voucher-number {
            font-size: 18px;
            color: #666;
            margin-top: 10px;
          }
          .voucher-body {
            margin: 30px 0;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 15px 0;
            border-bottom: 1px solid #ddd;
          }
          .info-label {
            font-weight: bold;
            color: #333;
          }
          .info-value {
            color: #000;
          }
          .amount-box {
            background: #f5f5f5;
            border: 2px solid #333;
            padding: 20px;
            margin: 30px 0;
            text-align: center;
          }
          .amount-label {
            font-size: 16px;
            margin-bottom: 10px;
          }
          .amount-value {
            font-size: 36px;
            font-weight: bold;
            color: #2e7d32;
          }
          .signatures {
            display: flex;
            justify-content: space-around;
            margin-top: 60px;
          }
          .signature-box {
            text-align: center;
            min-width: 200px;
          }
          .signature-line {
            border-top: 2px solid #333;
            margin-top: 50px;
            padding-top: 10px;
          }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="voucher-container">
          <div class="voucher-header">
            <h1>سند صرف</h1>
            <h2 style="margin-top: 5px;">Payment Voucher</h2>
            <div class="voucher-number">${paymentNumber}</div>
          </div>
          
          <div class="voucher-body">
            <div class="info-row">
              <span class="info-label">التاريخ / Date:</span>
              <span class="info-value">${formatDate(paymentData.payment_date)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">المورد / Supplier:</span>
              <span class="info-value">${escapeHtml(currentPaymentSupplier.name)}</span>
            </div>
            ${currentPaymentSupplier.phone ? `
            <div class="info-row">
              <span class="info-label">الهاتف / Phone:</span>
              <span class="info-value">${escapeHtml(currentPaymentSupplier.phone)}</span>
            </div>
            ` : ''}
            <div class="info-row">
              <span class="info-label">طريقة الدفع / Payment Method:</span>
              <span class="info-value">${t(paymentData.payment_method) || paymentData.payment_method}</span>
            </div>
            ${paymentData.reference_number ? `
            <div class="info-row">
              <span class="info-label">رقم المرجع / Reference:</span>
              <span class="info-value">${escapeHtml(paymentData.reference_number)}</span>
            </div>
            ` : ''}
            ${paymentData.check_number ? `
            <div class="info-row">
              <span class="info-label">رقم الشيك / Check Number:</span>
              <span class="info-value">${escapeHtml(paymentData.check_number)}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="amount-box">
            <div class="amount-label">المبلغ المدفوع / Amount Paid</div>
            <div class="amount-value">${formatCurrency(paymentData.amount)}</div>
          </div>
          
          ${paymentData.notes ? `
          <div style="margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 8px;">
            <strong>ملاحظات / Notes:</strong>
            <p style="margin: 10px 0 0 0;">${escapeHtml(paymentData.notes)}</p>
          </div>
          ` : ''}
          
          <div class="signatures">
            <div class="signature-box">
              <div class="signature-line">
                ${paymentData.received_by ? escapeHtml(paymentData.received_by) : '____________________'}
                <div style="margin-top: 5px; font-size: 14px;">المستلم / Received By</div>
              </div>
            </div>
            <div class="signature-box">
              <div class="signature-line">
                ${escapeHtml(currentUser?.name || '____________________')}
                <div style="margin-top: 5px; font-size: 14px;">المسؤول / Authorized By</div>
              </div>
            </div>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <button onclick="window.print()" style="padding: 12px 24px; font-size: 16px; cursor: pointer; background: #4a90e2; color: white; border: none; border-radius: 6px;">
            🖨️ طباعة / Print
          </button>
        </div>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
  } catch (error) {
    console.error('Error printing voucher:', error);
    toast(t('error_printing') || 'خطأ في الطباعة', 'error');
  }
}

// ==================== HELPER FUNCTIONS ====================

function closePaymentModal() {
  const modal = document.getElementById('modal-payment-form');
  if (modal) {
    hideSupplierModal('modal-payment-form');
    setTimeout(() => modal.remove(), 300);
  }
  currentPaymentSupplier = null;
}

// ==================== ADD CSS FOR PAYMENT FORM ====================

// Inject styles if not already present
if (!document.getElementById('payment-form-styles')) {
  const styles = document.createElement('style');
  styles.id = 'payment-form-styles';
  styles.textContent = `
    .payment-supplier-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    
    .supplier-card-content {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    
    .supplier-avatar-large {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
    }
    
    .supplier-details h4 {
      margin: 0 0 8px 0;
      font-size: 24px;
    }
    
    .supplier-details .text-muted {
      margin: 0 0 12px 0;
      opacity: 0.9;
    }
    
    .supplier-balance-info {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
    }
    
    .balance-value {
      font-weight: 700;
      font-size: 20px;
    }
    
    .payment-method-selector {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
    }
    
    .payment-method-option {
      cursor: pointer;
    }
    
    .payment-method-option input[type="radio"] {
      display: none;
    }
    
    .method-card {
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      padding: 24px 16px;
      text-align: center;
      transition: all 0.2s;
      background: white;
    }
    
    .method-card i {
      font-size: 32px;
      color: #666;
      margin-bottom: 8px;
      display: block;
    }
    
    .method-card span {
      font-weight: 500;
      color: #333;
    }
    
    .payment-method-option:hover .method-card {
      border-color: #4a90e2;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(74, 144, 226, 0.2);
    }
    
    .payment-method-option input[type="radio"]:checked + .method-card {
      border-color: #4a90e2;
      background: #e3f2fd;
      box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
    }
    
    .payment-method-option input[type="radio"]:checked + .method-card i {
      color: #4a90e2;
    }
    
    .payment-summary-card {
      background: #f5f5f5;
      border-radius: 12px;
      padding: 20px;
      margin-top: 24px;
    }
    
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      font-size: 16px;
    }
    
    .summary-divider {
      height: 2px;
      background: #ddd;
      margin: 12px 0;
    }
    
    .summary-total {
      font-size: 18px;
      font-weight: 700;
    }
    
    .text-primary {
      color: #4a90e2;
    }
    
    @media (max-width: 768px) {
      .supplier-card-content {
        flex-direction: column;
        text-align: center;
      }
      
      .payment-method-selector {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(styles);
}
