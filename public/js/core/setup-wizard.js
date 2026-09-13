// Initial setup wizard, header tools menu, and setup status check.
// Extracted from authentication.js.

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
    if (loginInteractionStarted || pinBuffer.length > 0) return;
    if (!status.setup_required && !status.recovery_required && !status.migration_required) return;
    const recovery = status.recovery_required && !status.migration_required;
    document.getElementById('login-screen').dataset.setupMode = status.migration_required ? 'migration' : 'initial';
    document.getElementById('login-subtitle').textContent = status.migration_required ? t('migrate_admin_login') : (recovery ? t('recover_admin_login') : t('setup_first_admin'));
    document.querySelector('.pin-display').style.display = 'none';
    document.querySelector('.pin-pad').style.display = 'none';
    document.getElementById('show-admin-login').style.display = 'none';
    if (status.migration_required) document.getElementById('setup-current-pin').style.display = 'block';
    document.getElementById('initial-admin-form').style.display = 'block';
  } catch (e) { console.error('Setup status check failed:', e); }
}
