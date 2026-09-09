// Catalog search reset, inline pricing, and active-state actions.
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
