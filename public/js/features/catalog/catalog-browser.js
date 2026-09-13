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
    if (currentUser?.cashier_code) {
      stationSel.closest('.station-badge-wrap')?.style.setProperty('display', 'none');
      return;
    }
    const savedStation = localStorage.getItem('pos_current_station') || currentUser?.default_station || 'cashier_floor1';
    // Build the selector from configured cashiers so switching follows the
    // cashier code, not a hard-coded floor name.
    api('/api/cashiers').then(cashiers => {
      const active = (cashiers || []).filter(c => c.active && (!currentUser?.cashier_code || c.code === currentUser.cashier_code));
      if (active.length) stationSel.innerHTML = active.map(c => `<option value="cashier:${escapeHtml(c.code)}">📍 ${escapeHtml(currentLang === 'ar' ? c.name : (c.name_en || c.name))} (${escapeHtml(c.code)})</option>`).join('') + '<option value="waiter_mobile">🤵 نادل جوال / Mobile Waiter</option>';
      stationSel.value = currentUser?.cashier_code ? `cashier:${currentUser.cashier_code}` : (savedStation.startsWith('cashier:') ? savedStation : savedStation);
      if (currentUser?.cashier_code) stationSel.disabled = true;
    }).catch(() => { stationSel.value = savedStation; });
    stationSel.onchange = (e) => {
      if (currentUser?.cashier_code) { e.target.value = `cashier:${currentUser.cashier_code}`; return; }
      localStorage.setItem('pos_current_station', e.target.value);
      if (currentUser) currentUser.active_cashier_code = e.target.value.startsWith('cashier:') ? e.target.value.slice(8) : '';
      toast(currentLang === 'ar' ? `تم تحويل الكاشير إلى: ${e.target.options[e.target.selectedIndex].text}` : `Cashier switched to: ${e.target.options[e.target.selectedIndex].text}`, 'info');
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
