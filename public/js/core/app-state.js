// Service-worker refresh plus shared application state and header helpers.
// ===== Force SW update =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.update());
  });
}

// ===== State =====
let categories = [];
let items = [];
let tables = [];
let currentOrder = { items: [], table_id: null, type: 'dine_in', discount: 0, note: '' };
let currentUserMaxDiscount = 100;
let activeCategoryId = null;
let currentUser = null;
let pinBuffer = '';
// Prevent a delayed setup-status response from replacing an active login
// attempt. A wrong PIN must always remain a wrong-PIN message.
let loginInteractionStarted = false;
let isOnline = navigator.onLine;
let appCurrency = localStorage.getItem('pos_currency') || '฿';
let appRestaurantName = localStorage.getItem('pos_restaurant_name') || 'اسم المنشأة';
let appRestaurantNameEn = localStorage.getItem('pos_restaurant_name_en') || 'Your Business';
let appTaxRate = parseFloat(localStorage.getItem('pos_tax_rate')) || 0;

function getCurrency() {
  return appCurrency || '฿';
}

function getRestaurantName() {
  if (currentLang === 'ar') {
    return appRestaurantName || 'اسم المنشأة';
  }
  return appRestaurantNameEn || appRestaurantName || 'Your Business';
}

function updateHeaderRestaurantName() {
  const name = getRestaurantName();
  const titleEl = document.getElementById('restaurant-name');
  if (titleEl) titleEl.textContent = `🍽️ ${escapeHtml(name)}`;
  const loginTitleEl = document.getElementById('login-title');
  if (loginTitleEl) loginTitleEl.textContent = `🍽️ ${escapeHtml(name)}`;
  document.title = `NOKTA POS - ${escapeHtml(name)}`;
}

function updateHeaderUser() {
  const name = currentUser?.name || '';
  const main = document.getElementById('current-user');
  const menu = document.getElementById('header-tools-user');
  if (main) main.textContent = name;
  if (menu) menu.textContent = name ? `👤 ${escapeHtml(name)}` : '';
}

function applyDiscountPermissions() {
  const discountRow = document.querySelector('.discount-row');
  const discountInput = document.getElementById('discount-input');
  if (!discountRow || !discountInput) return;
  const isAdmin = currentUser && currentUser.role === 'admin';
  const hasDiscountPerm = isAdmin || !!(currentUser && currentUser.permissions && currentUser.permissions.discount_orders);
  // مصدر الحقيقة الوحيد: currentUser.max_discount القادم من الخادم عند تسجيل الدخول
  const maxDisc = currentUser && currentUser.max_discount !== null && currentUser.max_discount !== undefined ? Number(currentUser.max_discount) : 100;
  
  // Only show if they have permission AND max discount is greater than 0
  discountRow.style.display = (hasDiscountPerm && maxDisc > 0) ? '' : 'none';
  if (hasDiscountPerm && maxDisc > 0) {
    discountInput.max = maxDisc;
    discountInput.min = '0';
    discountInput.title = currentLang === 'ar' ? `الحد الأقصى للخصم: ${maxDisc}%` : `Max discount: ${maxDisc}%`;
    if (parseFloat(discountInput.value) > maxDisc) {
      discountInput.value = String(maxDisc);
      currentOrder.discount = maxDisc;
      if (typeof updateOrderTotals === 'function') updateOrderTotals();
    }
    // منع التجاوز عند كل ضغطة مفتاح
    discountInput.oninput = (e) => {
      let val = parseFloat(e.target.value) || 0;
      if (val > maxDisc) { val = maxDisc; e.target.value = String(maxDisc); }
      if (val < 0) { val = 0; e.target.value = '0'; }
      currentOrder.discount = val;
      if (typeof updateOrderTotals === 'function') updateOrderTotals();
    };
  } else {
    currentOrder.discount = 0;
    discountInput.value = '0';
    discountInput.oninput = null;
    if (typeof updateOrderTotals === 'function') updateOrderTotals();
  }
}
