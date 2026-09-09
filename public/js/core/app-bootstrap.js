// DOM startup wiring, connectivity events, and device identity.
// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
  await loadPrimaryViews();
  setupAttendanceAdmin();
  updateHeaderRestaurantName();
  applyTranslations();
  setupLogin();
  checkInitialSetup();
  setupNavigation();
  setupModals();
  setupTime();
  document.getElementById('lang-toggle-login').onclick = () => toggleLanguage();
  const topLangBtn = document.getElementById('lang-toggle-top');
  if (topLangBtn) topLangBtn.onclick = () => toggleLanguage();
  const kitchenLink = document.getElementById('nav-kds');
  if (kitchenLink) kitchenLink.onclick = event => {
    if (!currentUser?.token) return;
    event.preventDefault();
    // The URL fragment stays in the browser and is never sent in the HTTP request.
    // It lets a separate Android WebView/new tab receive the already authenticated session.
    window.open(`kds.html#session=${encodeURIComponent(currentUser.token)}`, '_blank', 'noopener');
  };
  setupHeaderToolsMenu();
  
  window.addEventListener('online', () => {isOnline=true;syncPendingOrders();});
  setInterval(syncPendingOrders,15000);
  window.addEventListener('offline', () => {
    isOnline = false;
    document.getElementById('offline-bar').classList.remove('hidden');
    document.getElementById('sync-status').className = 'sync-status offline';
    toast(currentLang === 'ar' ? '⚡ تم التحويل لوضع العمل بدون إنترنت (أوفلاين)' : '⚡ Switched to offline mode', 'info');
  });
});

function getDeviceId() {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = 'device_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('device_id', id);
  }
  return id;
}
