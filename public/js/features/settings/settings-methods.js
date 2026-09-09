// Delivery and payment method administration.
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
