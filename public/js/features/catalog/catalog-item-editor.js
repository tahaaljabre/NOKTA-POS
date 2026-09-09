// Product create, edit, image upload, and delete.
async function openItemModal(itemId = null) {
  let item = null;
  if (itemId) { const all = await api('/api/items/all'); item = all.find(i => i.id === itemId); }
  
  const currentImage = (item && item.image) ? item.image : '';
  
  openModal(item ? (currentLang === 'ar' ? 'تعديل الصنف' : 'Edit Item') : t('add_item'), `
    <label>${t('item_name_ar')}</label><input type="text" id="modal-item-name" value="${escapeHtml(item ? item.name : '')}">
    <label>${t('item_name_en')}</label><input type="text" id="modal-item-name-en" value="${escapeHtml(item ? item.name_en : '')}">
    <label>${t('item_category')}</label><select id="modal-item-category">${categories.map(c => `<option value="${c.id}" ${item && item.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.icon)} ${escapeHtml(c.name)}</option>`).join('')}</select>
    <label>${t('item_price')}</label><input type="number" id="modal-item-price" value="${item ? item.price : ''}" step="0.01">
    <label>${t('item_price2')}</label><input type="number" id="modal-item-price2" value="${item && item.price2 ? item.price2 : ''}" step="0.01">
    <label>${currentLang === 'ar' ? 'صورة الصنف' : 'Item Image'}</label>
    <div class="image-upload-area" id="image-upload-area">
      <div id="image-preview" class="image-preview">${currentImage ? `<img src="${currentImage}" alt="item">` : `<span>${currentLang === 'ar' ? 'اضغط لاختيار صورة' : 'Click to choose image'}</span>`}</div>
      <input type="file" id="modal-item-image" accept="image/*" class="hidden">
      <input type="hidden" id="modal-item-image-data" value="${currentImage}">
    </div>
    <label>${t('item_sort')}</label><input type="number" id="modal-item-sort" value="${item ? item.sort_order : 0}">
  `, async () => {
    const imageData = document.getElementById('modal-item-image-data').value;
    const data = { name: document.getElementById('modal-item-name').value.trim(), name_en: document.getElementById('modal-item-name-en').value.trim(), category_id: parseInt(document.getElementById('modal-item-category').value), price: Math.round((parseFloat(document.getElementById('modal-item-price').value) || 0) * 100) / 100, price2: parseFloat(document.getElementById('modal-item-price2').value) || null, sort_order: parseInt(document.getElementById('modal-item-sort').value) || 0, image: imageData };
    if (!data.name) { toast(t('name_required'), 'error'); return false; }
    if (!Number.isInteger(data.category_id)) { toast(currentLang === 'ar' ? 'اختر قسماً للصنف' : 'Choose an item category', 'error'); return false; }
    const saved = item ? await api(`/api/items/${item.id}`, 'PUT', { ...data, active: 1 }) : await api('/api/items', 'POST', data);
    if (!item && !saved?.id) throw new Error(currentLang === 'ar' ? 'لم يؤكد الخادم حفظ الصنف' : 'Server did not confirm the item');
    await Promise.all([loadCategories(), loadItems()]);
    await loadMenuAdmin();
    toast(t('saved'), 'success');
  });
  
  const uploadArea = document.getElementById('image-upload-area');
  const fileInput = document.getElementById('modal-item-image');
  const preview = document.getElementById('image-preview');
  const hiddenInput = document.getElementById('modal-item-image-data');
  
  uploadArea.onclick = () => fileInput.click();
  
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500000) { toast(currentLang === 'ar' ? 'الصورة كبيرة جداً (حد أقصى 500KB)' : 'Image too large (max 500KB)', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      preview.innerHTML = `<img src="${ev.target.result}" alt="item">`;
      hiddenInput.value = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
}

async function deleteItem(id) {
  if (!confirm(t('confirm_delete'))) return;
  await api(`/api/items/${id}`, 'DELETE');
  toast(t('deleted'), 'success');
  await loadItems();
  loadMenuAdmin();
}
