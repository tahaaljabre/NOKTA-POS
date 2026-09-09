// Login, logout, application initialization, and permission visibility.
// ===== Login =====
function setupLogin() {
  document.querySelectorAll('.pin-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const num = btn.dataset.num;
      loginInteractionStarted = true;
      if (num === 'clear') {
        pinBuffer = '';
      } else if (num === 'ok') {
        attemptLogin();
        return;
      } else {
        if (pinBuffer.length < 6) pinBuffer += num;
      }
      updatePinDisplay();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (document.getElementById('login-screen').classList.contains('hidden')) return;
    if (e.key === 'Enter') {
      loginInteractionStarted = true;
      attemptLogin();
    } else if (e.key === 'Backspace') {
      pinBuffer = pinBuffer.slice(0, -1);
      updatePinDisplay();
    } else if (/^[0-9]$/.test(e.key)) {
      loginInteractionStarted = true;
      if (pinBuffer.length < 6) pinBuffer += e.key;
      updatePinDisplay();
    }
  });
  document.getElementById('show-admin-login').onclick = () => {
    const form = document.getElementById('admin-login-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  };
  const passwordToggle = document.getElementById('toggle-admin-password');
  const passwordInput = document.getElementById('admin-password');
  if (passwordToggle && passwordInput) {
    passwordToggle.onclick = () => {
      const visible = passwordInput.type === 'text';
      passwordInput.type = visible ? 'password' : 'text';
      passwordToggle.textContent = visible ? '👁' : '🙈';
      passwordToggle.setAttribute('data-i18n-title', visible ? 'show_password' : 'hide_password');
      passwordToggle.title = t(visible ? 'show_password' : 'hide_password');
      passwordToggle.setAttribute('aria-label', t(visible ? 'show_password' : 'hide_password'));
    };
  }
  document.getElementById('admin-login-form').onsubmit = async e => {
    e.preventDefault();
    await attemptPasswordLogin(document.getElementById('admin-username').value, document.getElementById('admin-password').value);
  };
  document.getElementById('initial-admin-form').onsubmit = async e => {
    e.preventDefault();
    const password = document.getElementById('setup-password').value;
    const confirm = document.getElementById('setup-password-confirm').value;
    const error = document.getElementById('login-error');
    if (password !== confirm) { error.textContent = t('passwords_mismatch'); return; }
    try {
      await api('/api/auth/setup-admin', 'POST', { name: document.getElementById('setup-name').value, username: document.getElementById('setup-username').value, password, current_pin: document.getElementById('setup-current-pin').value });
      error.textContent = t('admin_created');
      document.getElementById('initial-admin-form').style.display = 'none';
      document.getElementById('admin-login-form').style.display = 'block';
    } catch (err) { error.textContent = err.message; }
  };
}

function setupHeaderToolsMenu() {
  const toggle = document.getElementById('header-tools-toggle');
  const tools = document.getElementById('header-tools');
  const shiftButton = document.getElementById('btn-shift-close');
  if (shiftButton) shiftButton.onclick = () => {
    if (typeof openEmployeeClosingModal === 'function') openEmployeeClosingModal();
  };
  if (!toggle || !tools) return;
  toggle.onclick = event => {
    event.stopPropagation();
    if (!document.getElementById('header-tools-user')?.textContent.trim() && currentUser?.name) updateHeaderUser();
    const open = tools.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  };
  document.addEventListener('click', event => {
    if (!tools.contains(event.target) && !toggle.contains(event.target)) {
      tools.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

async function checkInitialSetup() {
  try {
    const status = await fetch((API_BASE || '') + '/api/auth/setup-status').then(r => r.json());
    // The initial-setup page is only for a truly new installation. Never let
    // it interrupt a PIN entry or a failed login on an existing system.
    if (loginInteractionStarted || pinBuffer.length > 0) return;
    if (!status.setup_required && !status.migration_required) return;
    document.getElementById('login-screen').dataset.setupMode = status.migration_required ? 'migration' : 'initial';
    document.getElementById('login-subtitle').textContent = status.migration_required ? t('migrate_admin_login') : t('setup_first_admin');
    document.querySelector('.pin-display').style.display = 'none';
    document.querySelector('.pin-pad').style.display = 'none';
    document.getElementById('show-admin-login').style.display = 'none';
    if (status.migration_required) document.getElementById('setup-current-pin').style.display = 'block';
    document.getElementById('initial-admin-form').style.display = 'block';
  } catch (e) { console.error('Setup status check failed:', e); }
}

function updatePinDisplay() {
  const display = document.getElementById('pin-display');
  if (!display) return;
  let text = '';
  for (let i = 0; i < 4; i++) {
    text += i < pinBuffer.length ? '● ' : '_ ';
  }
  display.textContent = text.trim();
}

async function attemptLogin() {
  if (pinBuffer.length === 0) return;
  loginInteractionStarted = true;
  const loginError = document.getElementById('login-error');
  loginError.textContent = '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch((API_BASE || '') + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language':currentLang },
      body: JSON.stringify({ pin: pinBuffer }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (res.ok && data.id) {
      currentUser = data;
      // The kitchen display opens in a separate tab and needs this session to
      // retrieve active orders from the protected API.
      localStorage.setItem('pos_kitchen_token', data.token || '');
      socket.auth = { token: data.token };
      socket.connect();
      await cacheData('employees', [data]);
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      
      // Auto-identify Employee Role, Floor, and Station
      const roleIcon = data.role === 'admin' ? '👑' : (data.role === 'waiter' ? '🤵' : '💵');
      const roleText = data.role === 'admin' ? t('emp_role_admin') : (data.role === 'waiter' ? t('emp_role_waiter') : t('emp_role_cashier'));
      const floorText = data.role === 'waiter' ? (currentLang === 'ar' ? 'نادل متنقل' : 'Mobile Waiter') : (currentLang === 'ar' ? `الدور ${data.default_floor || 1}` : `Floor ${data.default_floor || 1}`);

      const userBadgeEl = document.getElementById('current-user');
      if (userBadgeEl) {
        userBadgeEl.innerHTML = `${roleIcon} <strong>${escapeHtml(data.name)}</strong> <span class="header-floor-pill">(${roleText} - ${floorText})</span>`;
      }
      const menuUserEl = document.getElementById('header-tools-user');
      if (menuUserEl) {
        menuUserEl.innerHTML = `${roleIcon} <strong>${escapeHtml(data.name)}</strong><br><small>${roleText} — ${floorText}</small>`;
      }

      // Auto-set station selector in POS view to match employee's floor/station
      const autoStation = data.default_station || (data.role === 'waiter' ? 'waiter_mobile' : `cashier_floor${data.default_floor || 1}`);
      localStorage.setItem('pos_current_station', autoStation);
      const stationSel = document.getElementById('pos-station-select');
      if (stationSel) stationSel.value = autoStation;

      currentUserMaxDiscount = typeof data.max_discount === 'number' ? data.max_discount : 100;
      toast(currentLang === 'ar' ? `مرحباً ${escapeHtml(data.name)} (${roleText} - ${floorText})` : `Welcome ${escapeHtml(data.name)} (${roleText} - ${floorText})`, 'success');

      loginError.textContent = '';
      pinBuffer = '';
      updatePinDisplay();
      initApp();
      if (typeof checkShiftOnLogin === 'function') {
        setTimeout(checkShiftOnLogin, 600);
      }
      return;
    } else {
      loginError.textContent = t('login_error');
      pinBuffer = '';
      updatePinDisplay();
      return;
    }
  } catch (e) {
    loginError.textContent = currentLang === 'ar' ? 'تعذر الدخول؛ تحقق من اتصال الخادم' : 'Cannot sign in; check the server connection';
    pinBuffer = ''; updatePinDisplay();
  }
}

async function attemptPasswordLogin(username, password) {
  const loginError = document.getElementById('login-error');
  try {
    const res = await fetch((API_BASE || '') + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language':currentLang }, body: JSON.stringify({ username, password }) });
    const data = await res.json();
    if (!res.ok || !data.id) throw new Error(data.error || t('login_error'));
    currentUser = data;
    currentUserMaxDiscount = typeof data.max_discount === 'number' ? data.max_discount : 100;
    localStorage.setItem('pos_kitchen_token', data.token || '');
    socket.auth = { token: data.token }; socket.connect();
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    updateHeaderUser();
    initApp();
  } catch (err) { loginError.textContent = err.message; }
}

function initApp() {
  syncPendingOrders();
  loadCategories();
  loadItems();
  loadTables();
  loadSettings();
  setupPOS();
  setupAdmin();
  applyTranslations();
  checkPermissions();
  applyDiscountPermissions();
  if (typeof switchMobilePosTab === 'function') {
    switchMobilePosTab('menu');
  }
}

function checkPermissions() {
  if (!currentUser) return;
  const p = typeof currentUser.permissions === 'string' ? JSON.parse(currentUser.permissions) : (currentUser.permissions || {});
  const isAdmin = currentUser.role === 'admin';
  
  // Top Nav Buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const view = btn.dataset.view;
    let show = true;
    if (view === 'admin' && !isAdmin && !p.settings && !p.menu && !p.audit && !p.employees && !p.inventory && !p.tables) show = false;
    if (view === 'invoices' && !isAdmin && !p.view_invoices && !p.reports) show = false;
    if (view === 'dashboard' && !isAdmin && !p.dashboard && !p.reports) show = false;
    btn.style.display = show ? '' : 'none';
  });
  const discountRows = document.querySelectorAll('.discount-row');
  discountRows.forEach(row => {
    const maxDisc = currentUser && currentUser.max_discount !== null && currentUser.max_discount !== undefined ? Number(currentUser.max_discount) : 100;
    row.style.display = ((isAdmin || p.discount_orders) && maxDisc > 0) ? 'flex' : 'none';
  });

  // Admin Sidebar Tabs
  document.querySelectorAll('.admin-tab').forEach(tab => {
    const adminView = tab.dataset.admin;
    let show = true;
    if (adminView === 'menu-admin' && !isAdmin && !p.menu) show = false;
    if (adminView === 'modifiers-admin' && !isAdmin && !p.menu) show = false;
    if (adminView === 'inventory-admin' && !isAdmin && !p.inventory) show = false;
    if (adminView === 'employees-admin' && !isAdmin && !p.employees) show = false;
    if (adminView === 'tables-admin' && !isAdmin && !p.tables) show = false;
    if (adminView === 'daily-closing-admin' && !isAdmin && !p.daily_closing) show = false;
    if (adminView === 'audit-admin' && !isAdmin && !p.audit) show = false;
    if (adminView === 'settings-admin' && !isAdmin && !p.settings) show = false;
    if (adminView === 'reports-admin' && !isAdmin && !p.reports) show = false;
    tab.style.display = show ? '' : 'none';
  });
}

document.getElementById('btn-logout').onclick = () => {
  currentUser = null;
  localStorage.removeItem('pos_kitchen_token');
  socket.auth = {};
  socket.disconnect();
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  pinBuffer = '';
  updatePinDisplay();
  document.getElementById('login-error').textContent = '';
};
