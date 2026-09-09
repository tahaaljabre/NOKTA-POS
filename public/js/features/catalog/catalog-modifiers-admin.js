// Modifier administration list, editor, save, and delete.
// ===== Modifiers Admin =====
let allModifiers = [];

async function loadModifiersAdmin() {
  allModifiers = await api('/api/modifiers');
  renderModifiersAdminTable();
  const table = document.getElementById('modifiers-admin-table');
  if (table && !table._delegationAdded) {
    table._delegationAdded = true;
    table.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="edit-modifier"]');
      if (!btn) return;
      const modId = parseInt(btn.dataset.modifierId);
      const mod = allModifiers.find(m => m.id === modId);
      if (mod) openModifierAdminModal(mod);
    });
  }
}

function renderModifiersAdminTable() {
  const tbody = document.querySelector('#modifiers-admin-table tbody');
  if (!tbody) return;
  tbody.innerHTML = allModifiers.map(m => `
    <tr>
      <td>${escapeHtml(currentLang === 'ar' ? m.name : (m.name_en || m.name))}</td>
      <td>${escapeHtml(currentLang === 'ar' ? m.group_name : (m.group_name_en || m.group_name))}</td>
      <td>${escapeHtml(items.find(i => i.id === m.item_id)?.name || m.item_id)}</td>
      <td>${m.price_extra}</td>
      <td>${m.is_multiple ? (currentLang === 'ar' ? 'متعدد' : 'Multiple') : (currentLang === 'ar' ? 'فردي' : 'Single')} / ${m.is_required ? `<span style="color:red">${currentLang === 'ar' ? 'إجباري' : 'Required'}</span>` : (currentLang === 'ar' ? 'اختياري' : 'Optional')}</td>
      <td>
        <button class="btn" style="padding:4px 8px;" data-action="edit-modifier" data-modifier-id="${m.id}">${currentLang === 'ar' ? 'تعديل' : 'Edit'}</button>
        <button class="btn btn-danger" style="padding:4px 8px;" onclick="deleteModifier(${m.id})">${currentLang === 'ar' ? 'حذف' : 'Delete'}</button>
      </td>
    </tr>
  `).join('');
}

function openModifierAdminModal(mod = null) {
  const isEdit = !!mod;
  const title = isEdit ? 'تعديل إضافة' : 'إضافة جديدة';
  
  const itemOptions = items.map(i => `<option value="${i.id}" ${mod && mod.item_id === i.id ? 'selected' : ''}>${escapeHtml(i.name)}</option>`).join('');

  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = `
    <form id="modifier-form" onsubmit="saveModifier(event, ${mod ? mod.id : null})">
      <label>اسم الإضافة (عربي) *</label>
      <input type="text" id="mod-name" value="${escapeHtml(mod ? mod.name : '')}" required>
      
      <label>اسم الإضافة (إنجليزي)</label>
      <input type="text" id="mod-name-en" value="${escapeHtml(mod && mod.name_en ? mod.name_en : '')}">
      
      <label>اسم المجموعة (عربي) * (مثال: حجم، إضافات الجبن)</label>
      <input type="text" id="mod-group" value="${escapeHtml(mod ? mod.group_name : '')}" required>
      
      <label>اسم المجموعة (إنجليزي)</label>
      <input type="text" id="mod-group-en" value="${escapeHtml(mod && mod.group_name_en ? mod.group_name_en : '')}">
      
      <label>الصنف المرتبط *</label>
      <select id="mod-item-id" required>
        <option value="">-- اختر الصنف --</option>
        ${itemOptions}
      </select>
      
      <label>السعر الإضافي</label>
      <input type="number" step="0.01" id="mod-price" value="${mod ? mod.price_extra : 0}">
      
      <div style="display:flex; gap: 20px; margin: 15px 0;">
        <label style="display:flex; align-items:center; gap:5px; margin:0; cursor:pointer;">
          <input type="checkbox" id="mod-multiple" ${mod && mod.is_multiple ? 'checked' : ''}>
          يمكن اختيار أكثر من خيار في هذه المجموعة
        </label>
      </div>
      
      <div style="display:flex; gap: 20px; margin: 15px 0;">
        <label style="display:flex; align-items:center; gap:5px; margin:0; cursor:pointer;">
          <input type="checkbox" id="mod-required" ${mod && mod.is_required ? 'checked' : ''}>
          اختيار إجباري من هذه المجموعة
        </label>
      </div>
      
      <button type="submit" class="btn btn-save" style="width:100%;">حفظ</button>
    </form>
  `;
  document.getElementById('modal-overlay').classList.add('open');
}

async function saveModifier(e, id) {
  e.preventDefault();
  const data = {
    item_id: parseInt(document.getElementById('mod-item-id').value),
    name: document.getElementById('mod-name').value,
    name_en: document.getElementById('mod-name-en').value,
    group_name: document.getElementById('mod-group').value,
    group_name_en: document.getElementById('mod-group-en').value,
    price_extra: parseFloat(document.getElementById('mod-price').value) || 0,
    is_multiple: document.getElementById('mod-multiple').checked ? 1 : 0,
    is_required: document.getElementById('mod-required').checked ? 1 : 0,
  };
  
  if (id) {
    await api(`/api/modifiers/${id}`, 'PUT', data);
    showToast('تم تعديل الإضافة بنجاح', 'success');
  } else {
    await api('/api/modifiers', 'POST', data);
    showToast('تم إضافة الخيار بنجاح', 'success');
  }
  
  closeModal();
  loadModifiersAdmin();
  
  await api(`/api/items/${data.item_id}`, 'PUT', { has_modifiers: 1 });
  loadItems();
}

async function deleteModifier(id) {
  if (confirm('هل أنت متأكد من الحذف؟')) {
    await api(`/api/modifiers/${id}`, 'DELETE');
    showToast('تم الحذف', 'success');
    loadModifiersAdmin();
  }
}
