// Category create, edit, lookup, icon selection, and delete.
function openCategoryModal(cat = null) {
  if (cat instanceof Event) cat = null;

  if (cat !== null && typeof cat !== 'object') {
    const categoryId = Number(cat);
    cat = categories.find(category => Number(category.id) === categoryId) || null;
  }

  if (cat && !Number.isInteger(Number(cat.id))) {
    toast(currentLang === 'ar' ? 'بيانات القسم غير صالحة، أعد تحميل المنيو' : 'Invalid category data, reload the menu', 'error');
    return;
  }

  const selectedIcon = cat ? cat.icon : '🍽️';
  const iconGrid = ICON_LIST.map(icon =>
    `<button type="button" class="icon-pick ${icon === selectedIcon ? 'selected' : ''}" data-icon="${icon}">${icon}</button>`
  ).join('');
  
  openModal(cat ? (currentLang === 'ar' ? 'تعديل القسم' : 'Edit Category') : t('add_category'), `
    <label>${t('cat_name_ar')}</label><input type="text" id="modal-cat-name" value="${escapeHtml(cat ? cat.name : '')}">
    <label>${t('cat_name_en')}</label><input type="text" id="modal-cat-name-en" value="${escapeHtml(cat ? cat.name_en : '')}">
    <label>${t('cat_icon')}</label>
    <div class="icon-grid" id="icon-grid">${iconGrid}</div>
    <input type="hidden" id="modal-cat-icon" value="${selectedIcon}">
    <label>${t('cat_sort')}</label><input type="number" id="modal-cat-sort" value="${cat ? cat.sort_order : 0}">
  `, async () => {
    const data = { name: document.getElementById('modal-cat-name').value.trim(), name_en: document.getElementById('modal-cat-name-en').value.trim(), icon: document.getElementById('modal-cat-icon').value, sort_order: parseInt(document.getElementById('modal-cat-sort').value) || 0 };
    if (!data.name) { toast(t('name_required'), 'error'); return false; }
    const saved = cat ? await api(`/api/categories/${cat.id}`, 'PUT', data) : await api('/api/categories', 'POST', data);
    if (!saved || (!cat && !Number.isInteger(Number(saved.id)))) {
      throw new Error(currentLang === 'ar' ? 'لم يؤكد الخادم حفظ القسم' : 'Server did not confirm the category');
    }
    await Promise.all([loadItems(), loadMenuAdmin()]);
    toast(t('saved'), 'success');
  });
  
  document.querySelectorAll('.icon-pick').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.icon-pick').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('modal-cat-icon').value = btn.dataset.icon;
    };
  });
}

async function openCategoryModalById(categoryId) {
  let category = categories.find(item => Number(item.id) === Number(categoryId));
  if (!category) {
    await loadMenuAdmin();
    category = categories.find(item => Number(item.id) === Number(categoryId));
  }
  if (!category) {
    toast(currentLang === 'ar' ? 'القسم غير موجود، أعد تحميل المنيو' : 'Category not found, reload the menu', 'error');
    return;
  }
  openCategoryModal(category);
}

async function deleteCategory(id) {
  const cat = categories.find(c => c.id === id);
  const itemCount = adminMenuAllItems.filter(i => i.category_id === id).length;
  
  if (itemCount > 0) {
    toast(currentLang === 'ar' ? `لا يمكن حذف القسم - فيه ${itemCount} صنف` : `Cannot delete - ${itemCount} items in this category`, 'error');
    return;
  }
  
  if (!confirm(currentLang === 'ar' ? 'هل تريد حذف هذا القسم؟' : 'Delete this category?')) return;
  await api(`/api/categories/${id}`, 'DELETE');
  toast(t('deleted'), 'success');
  await loadCategories();
  loadMenuAdmin();
}
