// DOM startup wiring, connectivity events, and device identity.
// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
  if (checkNativeSetup()) return; // Halt init if setup is required
  // Initialize login controls immediately; a slow or unavailable view fragment
  // must never leave the PIN pad inert.
  setupLogin();
  // Bind the primary navigation immediately as well; view loading is asynchronous.
  setupNavigation();
  await loadPrimaryViews();
  setupAttendanceAdmin();
  updateHeaderRestaurantName();
  applyTranslations();
  checkInitialSetup();
  setupModals();
  setupTime();
  document.getElementById('lang-toggle-login').onclick = () => toggleLanguage();
  const topLangBtn = document.getElementById('lang-toggle-top');
  if (topLangBtn) topLangBtn.onclick = () => toggleLanguage();
  const kitchenLink = document.getElementById('nav-kds');
  if (kitchenLink) kitchenLink.onclick = event => {
    if (!currentUser?.token) return;
    event.preventDefault();
    if (CapDetect.isCapacitorNative()) {
      sessionStorage.setItem('pos_kitchen_token', currentUser.token || '');
      window.location.href = 'kds.html';
      return;
    }
    const kitchenWindow = window.open('kds.html', '_blank');
    if (!kitchenWindow) return toast(currentLang === 'ar' ? 'تعذر فتح شاشة المطبخ؛ اسمح بالنوافذ المنبثقة.' : 'Could not open KDS; allow pop-ups.');
    const transferKitchenSession = message => {
      if (message.origin !== window.location.origin || message.source !== kitchenWindow || message.data?.type !== 'nokta-kds:ready') return;
      kitchenWindow.postMessage({ type: 'nokta-kds:session', token: currentUser.token }, window.location.origin);
      window.removeEventListener('message', transferKitchenSession);
    };
    window.addEventListener('message', transferKitchenSession);
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

function checkNativeSetup() {
  if (!CapDetect.isCapacitorNative()) return false;
  const serverUrl = CapDetect.getServerUrl();
  if (serverUrl) return false;

  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('native-setup-screen').classList.remove('hidden');

  document.getElementById('save-native-url-btn').onclick = async () => {
    const urlInput = document.getElementById('native-server-url');
    const errEl = document.getElementById('native-url-error');
    const btn = document.getElementById('save-native-url-btn');
    let url = urlInput.value.trim();
    if (!url) {
      errEl.textContent = currentLang === 'ar' ? 'يرجى إدخال رابط الخادم' : 'Please enter the server URL';
      errEl.style.display = 'block';
      return;
    }
    if (!/^https?:\/\/.+/.test(url)) {
      errEl.textContent = currentLang === 'ar' ? 'الرابط يجب أن يبدأ بـ http:// أو https://' : 'URL must start with http:// or https://';
      errEl.style.display = 'block';
      return;
    }
    if (url.endsWith('/')) url = url.slice(0, -1);
    errEl.style.display = 'none';

    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = currentLang === 'ar' ? 'جارٍ فحص الاتصال...' : 'Testing connection...';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url + '/api/auth/setup-status', {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeout);
      if (!res.ok && res.status !== 401) throw new Error('status ' + res.status);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = origText;
      errEl.textContent = currentLang === 'ar'
        ? 'تعذر الاتصال بالخادم. تأكد من أن الجهاز والخادم على نفس الشبكة وأن الخادم يعمل.'
        : 'Cannot reach the server. Make sure the device and server are on the same network.';
      errEl.style.display = 'block';
      return;
    }

    await CapDetect.requestStoragePermission();
    CapDetect.setServerUrl(url);
    window.location.reload();
  };
  return true;
}
