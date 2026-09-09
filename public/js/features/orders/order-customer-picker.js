// Customer selection and quick customer creation for orders.
// ===== Customer Loyalty & CRM =====
async function loadCustomersDropdown() {
  try {
    const customers = await api('/api/customers');
    const select = document.getElementById('customer-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- اختيار عميل --</option>';
    customers.forEach(c => {
      select.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.phone)}) - ${c.points || 0} pts</option>`;
    });
  } catch (err) {
    console.error('Failed to load customers:', err);
  }
}

function openCustomerModal() {
  document.getElementById('customer-modal').style.display = 'flex';
  document.getElementById('cust-name').value = '';
  document.getElementById('cust-phone').value = '';
  document.getElementById('cust-email').value = '';
}

function closeCustomerModal() {
  document.getElementById('customer-modal').style.display = 'none';
}

async function saveCustomer() {
  const name = document.getElementById('cust-name').value;
  const phone = document.getElementById('cust-phone').value;
  const email = document.getElementById('cust-email').value;

  if (!name || !phone) return alert('الاسم ورقم الجوال مطلوبان (Name & Phone required)');

  try {
    const res = await api('/api/customers', 'POST', { name, phone, email });
    if (res.id) {
      closeCustomerModal();
      toast('تم حفظ العميل بنجاح (Customer saved)', 'success');
      loadCustomersDropdown();
      // Auto-select the newly created customer
      setTimeout(() => {
        const select = document.getElementById('customer-select');
        if (select) {
          select.value = res.id;
          currentOrder.customer_id = res.id;
        }
      }, 500);
    }
  } catch (err) {
    console.error(err);
    toast('خطأ في حفظ العميل (Error saving customer)', 'error');
  }
}
