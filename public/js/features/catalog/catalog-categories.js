// Shared catalog state plus category loading and POS category tabs.
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
