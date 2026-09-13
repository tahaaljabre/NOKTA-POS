// Login handler: PIN pad, password login, and session initialization.
// Extracted from authentication.js.

function setupLogin() {
  document.querySelectorAll('.pin-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const num = btn.dataset.num;
      loginInteractionStarted = true;
      if (num === 'clear') { pinBuffer = ''; }
      else if (num === 'ok') { attemptLogin(); return; }
      else { if (pinBuffer.length < 6) pinBuffer += num; }
      updatePinDisplay();
    });
  });
  document.addEventListener('keydown', (e) => {
    if (document.getElementById('login-screen').classList.contains('hidden')) return;
    if (e.key === 'Enter') { loginInteractionStarted = true; attemptLogin(); }
    else if (e.key === 'Backspace') { pinBuffer = pinBuffer.slice(0, -1); updatePinDisplay(); }
    else if (/^[0-9]$/.test(e.key)) { loginInteractionStarted = true; if (pinBuffer.length < 6) pinBuffer += e.key; updatePinDisplay(); }
  });
  document.getElementById('show-admin-login').onclick = () => {
    const form = document.getElementById('admin-login-form');
    const open = form.style.display === 'none';
    form.style.display = open ? 'block' : 'none';
    document.querySelector('.login-box')?.classList.toggle('admin-login-open', open);
    if (open) document.getElementById('admin-username')?.focus();
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

function updatePinDisplay() {
  const display = document.getElementById('pin-display');
  if (!display) return;
  let text = '';
  for (let i = 0; i < 4; i++) { text += i < pinBuffer.length ? '● ' : '_ '; }
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
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language':currentLang },
      body: JSON.stringify({ pin: pinBuffer }), signal: controller.signal
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (res.ok && data.id) {
      currentUser = data;
      sessionStorage.setItem('pos_kitchen_token', data.token || '');
      socket.auth = { token: data.token };
      socket.connect();
      await cacheData('employees', [data]);
      const p = typeof data.permissions === 'string' ? JSON.parse(data.permissions) : (data.permissions || {});
      if (data.role === 'kitchen' || (p.kitchen && !p.pos && data.role !== 'admin')) {
        window.location.href = 'kds.html';
        return;
      }
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      const roleIcon = data.role === 'admin' ? '👑' : (data.role === 'waiter' ? '🤵' : '💵');
      const roleText = data.role === 'admin' ? t('emp_role_admin') : (data.role === 'waiter' ? t('emp_role_waiter') : t('emp_role_cashier'));
      const floorText = data.role === 'waiter' ? (currentLang === 'ar' ? 'نادل متنقل' : 'Mobile Waiter') : (currentLang === 'ar' ? `الدور ${data.default_floor || 1}` : `Floor ${data.default_floor || 1}`);
      const userBadgeEl = document.getElementById('current-user');
      if (userBadgeEl) { userBadgeEl.innerHTML = `${roleIcon} <strong>${escapeHtml(data.name)}</strong> <span class="header-floor-pill">(${roleText} - ${floorText})</span>`; }
      const menuUserEl = document.getElementById('header-tools-user');
      if (menuUserEl) { menuUserEl.innerHTML = `${roleIcon} <strong>${escapeHtml(data.name)}</strong><br><small>${roleText} — ${floorText}</small>`; }
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
      if (typeof checkShiftOnLogin === 'function') { setTimeout(checkShiftOnLogin, 600); }
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
    sessionStorage.setItem('pos_kitchen_token', data.token || '');
    socket.auth = { token: data.token }; socket.connect();
    const p = typeof data.permissions === 'string' ? JSON.parse(data.permissions) : (data.permissions || {});
    if (data.role === 'kitchen' || (p.kitchen && !p.pos && data.role !== 'admin')) {
      window.location.href = 'kds.html';
      return;
    }
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    updateHeaderUser();
    initApp();
  } catch (err) { loginError.textContent = err.message; }
}
