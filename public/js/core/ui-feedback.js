// Shared modal and toast UI.
// ===== Modal =====
function setupModals() {
  document.getElementById('modal-close').onclick = closeModal;
  document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
}

function openModal(title, bodyHtml, onConfirm = null, confirmText = null) {
  document.getElementById('modal-title').textContent = title;
  const btnLabel = confirmText || t('save');
  
  if (typeof onConfirm === 'function') {
    document.getElementById('modal-body').innerHTML = bodyHtml + `<div class="modal-actions"><button class="btn-confirm" id="modal-confirm-btn">${btnLabel}</button><button class="btn-cancel" id="modal-cancel-btn">${currentLang === 'ar' ? 'إلغاء' : 'Cancel'}</button></div>`;
    const confirmBtn = document.getElementById('modal-confirm-btn');
    confirmBtn.onclick = async () => {
      try {
        confirmBtn.disabled = true;
        confirmBtn.textContent = currentLang === 'ar' ? 'جاري المعالجة...' : 'Processing...';
        const result = await onConfirm();
        // A form can explicitly keep the dialog open (for validation failures).
        if (result !== false) closeModal();
      } catch (e) {
        console.error('Modal confirm error:', e);
        toast(t('error') + ': ' + e.message, 'error');
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = btnLabel;
      }
    };
    document.getElementById('modal-cancel-btn').onclick = closeModal;
  } else {
    document.getElementById('modal-body').innerHTML = bodyHtml;
  }

  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }

// ===== Toast =====
function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
