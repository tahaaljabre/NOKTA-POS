// ===== Menu State =====
let menuSearchQuery = '';

// ===== Categories =====
async function loadCategories() {
  if (isOnline) {
    categories = await api(`/api/categories?refresh=${Date.now()}`);
    await cacheData('categories', categories);
  } else {
    categories = await getCachedData('categories');
  }
  renderCategoryTabs();
}

function renderCategoryTabs() {
  const container = document.getElementById('category-tabs');
  if (!container) return;
  container.innerHTML = `<button class="cat-tab ${activeCategoryId === null ? 'active' : ''}" data-id="all"><span class="cat-icon">📋</span> ${currentLang === 'ar' ? 'الكل' : 'All'}</button>` +
    categories.map(c => `<button class="cat-tab ${activeCategoryId === c.id ? 'active' : ''}" data-id="${c.id}"><span class="cat-icon">${escapeHtml(c.icon || '📁')}</span> ${escapeHtml(currentLang === 'ar' ? c.name : (c.name_en || c.name))}</button>`).join('');
  container.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategoryId = tab.dataset.id === 'all' ? null : parseInt(tab.dataset.id);
      loadMenuGrid();
    });
  });
}

// ===== Menu Grid (Optimized for 400+ items) =====
async function loadItems() {
  if (isOnline) {
    items = await api('/api/items');
    await cacheData('items', items);
  } else {
    items = await getCachedData('items');
  }
  setupMenuSearch();
  loadMenuGrid();
}

function setupMenuSearch() {
  const searchInput = document.getElementById('menu-search-input');
  const clearBtn = document.getElementById('menu-search-clear');
  if (!searchInput) return;

  searchInput.oninput = (e) => {
    menuSearchQuery = (e.target.value || '').trim().toLowerCase();
    if (clearBtn) {
      if (menuSearchQuery.length > 0) clearBtn.classList.remove('hidden');
      else clearBtn.classList.add('hidden');
    }
    loadMenuGrid();
  };

  if (clearBtn) {
    clearBtn.onclick = () => {
      searchInput.value = '';
      menuSearchQuery = '';
      clearBtn.classList.add('hidden');
      loadMenuGrid();
      searchInput.focus();
    };
  }

  // Station selector handler
  const stationSel = document.getElementById('pos-station-select');
  if (stationSel) {
    const savedStation = localStorage.getItem('pos_current_station') || 'cashier_floor1';
    stationSel.value = savedStation;
    stationSel.onchange = (e) => {
      localStorage.setItem('pos_current_station', e.target.value);
      toast(currentLang === 'ar' ? `تم تحويل المحطة إلى: ${e.target.options[e.target.selectedIndex].text}` : `Station switched to: ${e.target.value}`, 'info');
    };
  }
}

function loadMenuGrid() {
  const container = document.getElementById('menu-grid');
  if (!container) return;

  let filtered = items;

  // 1. Filter by category
  if (activeCategoryId) {
    filtered = filtered.filter(i => i.category_id === activeCategoryId);
  }

  // 2. High-speed Instant Search Filter (Arabic name, English name, Barcode, SKU)
  if (menuSearchQuery) {
    filtered = filtered.filter(i => {
      const nameAr = (i.name || '').toLowerCase();
      const nameEn = (i.name_en || '').toLowerCase();
      const barcode = (i.barcode || '').toLowerCase();
      const sku = (i.sku || '').toLowerCase();
      return nameAr.includes(menuSearchQuery) || 
             nameEn.includes(menuSearchQuery) || 
             barcode.includes(menuSearchQuery) ||
             sku.includes(menuSearchQuery);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="menu-empty-state">
        <span style="font-size:36px;display:block;margin-bottom:8px;">🔍</span>
        <div>${currentLang === 'ar' ? 'لا توجد أصناف مطابقة للبحث' : 'No items match your search'}</div>
        <small style="color:var(--text-light);">${currentLang === 'ar' ? 'جرب البحث باسم آخر أو اختر قسماً مختلفاً' : 'Try searching with another name or category'}</small>
      </div>
    `;
    return;
  }

  const curr = getCurrency();

  // High-performance batch DOM generation
  const htmlBuffer = filtered.map(i => {
    const displayName = currentLang === 'ar' ? i.name : (i.name_en || i.name);
    return `
      <div class="menu-item ${i.image ? 'has-image' : ''}" data-id="${i.id}" tabindex="0" title="${escapeHtml(displayName)} - ${i.price} ${curr}">
        ${i.image ? `<div class="menu-item-img"><img src="${safeImageUrl(i.image)}" alt="${escapeHtml(displayName)}" loading="lazy"></div>` : ''}
        <div class="menu-item-name">${escapeHtml(displayName)}</div>
        <div class="menu-item-price">${i.price} ${curr}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = htmlBuffer;

  // Single delegated click listener or batch assignment
  container.querySelectorAll('.menu-item').forEach(el => {
    el.addEventListener('click', () => {
      addToOrder(parseInt(el.dataset.id));
    });
  });
}

// ===== Menu Admin Management =====
let adminMenuAllItems = [];
let adminSelectedCategoryId = 'all';

async function loadMenuAdmin() {
  try {
    const [allItems, allCats] = await Promise.all([
      api('/api/items/all'),
      api(`/api/categories?refresh=${Date.now()}`)
    ]);
    adminMenuAllItems = allItems || [];
    categories = allCats || [];

    renderCategoriesAdminTable();
    renderMenuAdminCategoryFilter();
    filterMenuAdminTable();
  } catch(e) {
    console.error('Error loading menu admin:', e);
  }
}

function renderCategoriesAdminTable() {
  const tbody = document.getElementById('categories-admin-tbody');
  if (!tbody) return;

  // Count items per category
  const counts = {};
  adminMenuAllItems.forEach(i => {
    const catId = i.category_id || 0;
    counts[catId] = (counts[catId] || 0) + 1;
  });

  tbody.innerHTML = categories.map(c => `
    <tr>
      <td style="font-size:20px;text-align:center;">${escapeHtml(c.icon || '📁')}</td>
      <td>${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.name_en || '-')}</td>
      <td>${c.sort_order || 0}</td>
      <td><strong>${counts[c.id] || 0}</strong></td>
      <td class="action-btns">
        <button class="btn-edit" onclick="openCategoryModalById(${c.id})">${currentLang === 'ar' ? 'تعديل' : 'Edit'}</button>
        <button class="btn-delete" onclick="deleteCategory(${c.id})">${currentLang === 'ar' ? 'حذف' : 'Delete'}</button>
      </td>
    </tr>
  `).join('');
}

function renderMenuAdminCategoryFilter() {
  const container = document.getElementById('menu-admin-cat-filter');
  if (!container) return;

  // Calculate count of items per category
  const counts = {};
  adminMenuAllItems.forEach(i => {
    const catId = i.category_id || 'none';
    counts[catId] = (counts[catId] || 0) + 1;
  });

  const totalCount = adminMenuAllItems.length;

  let html = `
    <button type="button" class="admin-cat-pill ${adminSelectedCategoryId === 'all' ? 'active' : ''}" onclick="selectAdminCategory('all')">
      <span>🍽️</span> ${currentLang === 'ar' ? 'جميع الأقسام' : 'All Categories'}
      <span class="cat-count-badge">${totalCount}</span>
    </button>
  `;

  categories.forEach(c => {
    const count = counts[c.id] || 0;
    const isSelected = String(adminSelectedCategoryId) === String(c.id);
    const catName = currentLang === 'ar' ? c.name : (c.name_en || c.name);
    html += `
      <div class="admin-cat-pill-wrapper">
        <button type="button" class="admin-cat-pill ${isSelected ? 'active' : ''}" onclick="selectAdminCategory(${c.id})">
          <span>${escapeHtml(c.icon || '📁')}</span> ${catName}
          <span class="cat-count-badge">${count}</span>
        </button>
        <button type="button" class="admin-cat-edit-btn" onclick="openCategoryModalById(${c.id})" title="تعديل القسم">
          ✏️
        </button>
      </div>
    `;
  });

  container.innerHTML = html;
}

function selectAdminCategory(catId) {
  adminSelectedCategoryId = catId;
  renderMenuAdminCategoryFilter();
  filterMenuAdminTable();
}

function filterMenuAdminTable() {
  const searchInput = document.getElementById('menu-admin-search');
  const clearBtn = document.getElementById('menu-admin-search-clear');
  const term = (searchInput ? searchInput.value : '').trim().toLowerCase();

  if (clearBtn) {
    clearBtn.style.display = term ? 'block' : 'none';
  }

  let filtered = adminMenuAllItems;

  if (adminSelectedCategoryId !== 'all') {
    filtered = filtered.filter(i => String(i.category_id) === String(adminSelectedCategoryId));
  }

  if (term) {
    filtered = filtered.filter(i => {
      const name = (i.name || '').toLowerCase();
      const nameEn = (i.name_en || '').toLowerCase();
      const cat = (i.category_name || '').toLowerCase();
      const catEn = (i.category_name_en || '').toLowerCase();
      const price = String(i.price || '');
      return name.includes(term) || nameEn.includes(term) || cat.includes(term) || catEn.includes(term) || price.includes(term);
    });
  }

  // Update count badge
  const countEl = document.getElementById('menu-admin-item-count');
  if (countEl) countEl.textContent = filtered.length;

  const tbody = document.querySelector('#menu-admin-table tbody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;padding:30px;color:var(--text-light);">
          🔍 ${currentLang === 'ar' ? 'لا توجد أصناف تطابق هذا القسم أو البحث' : 'No items match this category or search'}
        </td>
      </tr>
    `;
    return;
  }

  const curr = getCurrency();

  tbody.innerHTML = filtered.map(i => {
    const displayName = currentLang === 'ar' ? i.name : (i.name_en || i.name);
    const catName = currentLang === 'ar' ? (i.category_name || '-') : (i.category_name_en || i.category_name || '-');
    const imgHtml = i.image 
      ? `<img src="${safeImageUrl(i.image)}" alt="${escapeHtml(displayName)}" style="width:38px;height:38px;object-fit:cover;border-radius:6px;border:1px solid var(--border);">`
      : `<div style="width:38px;height:38px;background:var(--bg);border:1px dashed var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:18px;">🍽️</div>`;

    return `
      <tr id="item-row-${i.id}">
        <td style="text-align:center;">${imgHtml}</td>
        <td>
          <strong style="font-size:13.5px;">${escapeHtml(displayName)}</strong>
          ${i.name_en && currentLang === 'ar' ? `<div style="font-size:11px;color:var(--text-light);">${escapeHtml(i.name_en)}</div>` : ''}
        </td>
        <td>
          <span class="cat-badge-pill">${catName}</span>
        </td>
        <td>
          <div class="quick-price-wrap">
            <input type="number" step="0.5" min="0" value="${i.price}" class="quick-price-input" id="price-input-${i.id}" onchange="quickUpdatePrice(${i.id}, this.value)">
            <span class="curr-unit">${curr}</span>
          </div>
        </td>
        <td>
          <button type="button" class="btn-status-toggle ${i.active ? 'active' : 'inactive'}" onclick="toggleItemActive(${i.id}, ${i.active ? 0 : 1})" title="تغيير الحالة">
            ${i.active ? '✅ ' + t('active') : '⛔ ' + t('inactive')}
          </button>
        </td>
        <td class="action-btns">
          <button class="btn-edit" onclick="openItemModal(${i.id})">${currentLang === 'ar' ? '✏️ تعديل' : '✏️ Edit'}</button>
          <button class="btn-delete" onclick="deleteItem(${i.id})">${currentLang === 'ar' ? '🗑️ حذف' : '🗑️ Delete'}</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ===== Modifiers Admin =====
let allModifiers = [];

async function loadModifiersAdmin() {
  allModifiers = await api('/api/modifiers');
  renderModifiersAdminTable();
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
      <td>${m.is_multiple ? 'متعدد' : 'فردي'} / ${m.is_required ? '<span style="color:red">إجباري</span>' : 'اختياري'}</td>
      <td>
        <button class="btn" style="padding:4px 8px;" onclick='openModifierAdminModal(${JSON.stringify(m).replace(/'/g, "&apos;")})'>تعديل</button>
        <button class="btn btn-danger" style="padding:4px 8px;" onclick="deleteModifier(${m.id})">حذف</button>
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

function clearMenuAdminSearch() {
  const searchInput = document.getElementById('menu-admin-search');
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
  filterMenuAdminTable();
}

async function quickUpdatePrice(itemId, newPrice) {
  const val = Math.round(parseFloat(newPrice) * 100) / 100;
  if (isNaN(val) || val < 0) {
    toast(currentLang === 'ar' ? 'يرجى إدخال سعر صحيح' : 'Please enter a valid price', 'error');
    return;
  }

  const inputEl = document.getElementById(`price-input-${itemId}`);
  if (inputEl) {
    inputEl.style.borderColor = '#ffc107';
  }

  try {
    await api(`/api/items/${itemId}`, 'PUT', { price: val });
    const item = adminMenuAllItems.find(x => x.id === itemId);
    if (item) item.price = val;
    
    if (inputEl) {
      inputEl.style.borderColor = '#28a745';
      setTimeout(() => { inputEl.style.borderColor = ''; }, 1200);
    }
    toast(currentLang === 'ar' ? `✅ تم تعديل السعر إلى ${val} ${getCurrency()} بنجاح` : `Price updated to ${val} ${getCurrency()}`, 'success');
    if (typeof loadMenuGrid === 'function') loadMenuGrid();
  } catch(err) {
    if (inputEl) inputEl.style.borderColor = '#dc3545';
    toast(currentLang === 'ar' ? `خطأ: ${escapeHtml(err.message)}` : `Error: ${escapeHtml(err.message)}`, 'error');
  }
}

async function toggleItemActive(itemId, newActive) {
  try {
    await api(`/api/items/${itemId}`, 'PUT', { active: newActive });
    const item = adminMenuAllItems.find(x => x.id === itemId);
    if (item) item.active = newActive;
    
    toast(currentLang === 'ar' ? (newActive ? 'تم تفعيل الصنف' : 'تم تعطيل الصنف') : 'Item status updated', 'success');
    filterMenuAdminTable();
    if (typeof loadMenuGrid === 'function') loadMenuGrid();
  } catch(err) {
    toast(currentLang === 'ar' ? `خطأ: ${escapeHtml(err.message)}` : `Error: ${escapeHtml(err.message)}`, 'error');
  }
}

const ICON_LIST = [
  '🍽️','🥤','☕','🍕','🍔','🌮','🥗','🍰','🧁','🍩',
  '🍗','🥩','🍖','🐟','🦐','🍣','🥘','🍲','🍝','🍛',
  '🧀','🥚','🍞','🥖','🥯','🥞','🧇','🥓','🌭','🥪',
  '🍎','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🥝','🍑',
  '🥑','🥔','🌽','🥕','🧅','🧄','🌶️','🥒','🍆','🫑',
  '🥛','🍺','🍷','🍸','🍹','🧃','🍵','🫖','💧','🧋',
  '🍬','🍫','🍭','🍮','🍯','🥜','🌰','🫘','💐','🌸',
  '🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','💎',
  '⭐','❤️','🔥','❄️','☀️','🌙','✨','🎪','🎉','🎊',
  '💰','🏷️','📦','🎁','🎂','🎓','🏖️','🏔️','🌅','🎵'
];

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
