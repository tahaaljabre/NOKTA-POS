// POS catalog loading, search, and product grid rendering.
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
