// Full and orders-only backup download and verified JSON restore.
// ===== Backup & Restore =====
async function exportBackup() {
  try {
    toast(currentLang === 'ar' ? 'جاري التصدير...' : 'Exporting...', 'info');
    const data = await api('/api/backup/export');
    toast(t('backup_private'),'info');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `nokta-pos-backup-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(currentLang === 'ar' ? '✅ تم التصدير بنجاح' : '✅ Export successful', 'success');
  } catch (e) {
    toast(currentLang === 'ar' ? 'خطأ في التصدير' : 'Export failed', 'error');
  }
}

async function downloadFullDatabaseBackup() {
  try {
    toast(t('backup_database_exporting'), 'info');
    const response = await fetch(`${API_BASE}/api/backup/database`, {
      headers: {
        Authorization: `Bearer ${currentUser?.token || ''}`,
        'Accept-Language': currentLang
      },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Backup download failed (${response.status})`);
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const basicName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    const filename = encodedName ? decodeURIComponent(encodedName) : (basicName || `nokta-pos-full-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast(t('backup_database_success'), 'success');
  } catch (error) {
    toast(t('backup_database_failed'), 'error');
  }
}

async function exportOrdersOnly() {
  try {
    const data = await api('/api/backup/export?type=orders');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `nokta-pos-orders-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(currentLang === 'ar' ? '✅ تم تصدير الطلبات' : '✅ Orders exported', 'success');
  } catch (e) {
    toast(currentLang === 'ar' ? 'خطأ في التصدير' : 'Export failed', 'error');
  }
}

let _restoreData = null;

function previewRestoreFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      _restoreData = JSON.parse(e.target.result);
      const preview = document.getElementById('restore-preview');
      const btn = document.getElementById('btn-restore-backup');
      const info = [];
      if (_restoreData.orders) info.push(`${currentLang === 'ar' ? 'طلبات' : 'Orders'}: ${_restoreData.orders.length}`);
      if (_restoreData.items) info.push(`${currentLang === 'ar' ? 'أصناف' : 'Items'}: ${_restoreData.items.length}`);
      if (_restoreData.employees) info.push(`${currentLang === 'ar' ? 'موظفين' : 'Employees'}: ${_restoreData.employees.length}`);
      if (_restoreData.tables) info.push(`${currentLang === 'ar' ? 'طاولات' : 'Tables'}: ${_restoreData.tables.length}`);
      const dateLabel = currentLang === 'ar' ? 'تاريخ النسخة' : 'Backup Date';
      const contentsLabel = currentLang === 'ar' ? 'المحتويات' : 'Contents';
      preview.innerHTML = `<strong>📁 ${escapeHtml(file.name)}</strong><br><span style="color:#888;">${dateLabel}: ${escapeHtml(_restoreData.exported_at || '—')}</span><br>${contentsLabel}: ${info.join(' | ')}`;
      preview.style.display = 'block';
      btn.disabled = false;
    } catch (err) {
      toast(currentLang === 'ar' ? 'ملف غير صالح' : 'Invalid file', 'error');
      _restoreData = null;
    }
  };
  reader.readAsText(file);
}

async function restoreBackup() {
  if (!_restoreData) return;
  const confirmMsg = currentLang === 'ar'
    ? '⚠️ هذا سيحل محل البيانات الحالية. هل أنت متأكد تماماً؟'
    : '⚠️ This will overwrite current data. Are you absolutely sure?';
  if (!confirm(confirmMsg)) return;
  try {
    toast(currentLang === 'ar' ? 'جاري الاستعادة...' : 'Restoring...', 'info');
    await api('/api/backup/restore', 'POST', _restoreData);
    toast(currentLang === 'ar' ? '✅ تمت الاستعادة بنجاح. ستتم إعادة التحميل.' : '✅ Restore successful. Reloading.', 'success');
    setTimeout(() => location.reload(), 2000);
  } catch (e) {
    toast(currentLang === 'ar' ? 'خطأ في الاستعادة' : 'Restore failed', 'error');
  }
}
