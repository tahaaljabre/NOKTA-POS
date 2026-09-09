// Catalog administration list, filters, and category selection.
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
