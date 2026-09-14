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

// ===== Menu Export/Import =====
async function exportMenuExcel() {
  try {
    toast(currentLang === 'ar' ? 'جاري تصدير المنيو...' : 'Exporting menu...', 'info');
    const response = await fetch(`${API_BASE}/api/menu/export`, {
      headers: { Authorization: `Bearer ${currentUser?.token || ''}` },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || `nokta-menu-${new Date().toISOString().slice(0,10)}.xlsx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(currentLang === 'ar' ? '✅ تم تصدير المنيو' : '✅ Menu exported', 'success');
  } catch (e) {
    toast(currentLang === 'ar' ? 'خطأ في تصدير المنيو' : 'Menu export failed', 'error');
  }
}

async function importMenuExcel(input) {
  const file = input.files[0];
  if (!file) return;
  const confirmMsg = currentLang === 'ar'
    ? '⚠️ سيتم استيراد الأصناف والأقسام من الملف. هل تريد المتابعة؟'
    : '⚠️ Items and categories will be imported from the file. Continue?';
  if (!confirm(confirmMsg)) { input.value = ''; return; }

  const resultDiv = document.getElementById('menu-import-result');
  try {
    toast(currentLang === 'ar' ? 'جاري الاستيراد...' : 'Importing...', 'info');
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/api/menu/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentUser?.token || ''}` },
      body: formData
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Import failed');

    const parts = [];
    if (result.categories) parts.push(`${currentLang === 'ar' ? 'أقسام' : 'Categories'}: ${result.categories}`);
    if (result.items) parts.push(`${currentLang === 'ar' ? 'أصناف' : 'Items'}: ${result.items}`);
    if (result.modifiers) parts.push(`${currentLang === 'ar' ? 'إضافات' : 'Modifiers'}: ${result.modifiers}`);

    let html = `<strong style="color:#27ae60;">✅ ${currentLang === 'ar' ? 'تم الاستيراد بنجاح' : 'Import successful'}</strong><br>${parts.join(' | ')}`;
    if (result.errors && result.errors.length) {
      html += `<br><span style="color:#e74c3c;">⚠️ ${result.errors.length} ${currentLang === 'ar' ? 'أخطاء' : 'errors'}:</span><br>`;
      html += result.errors.slice(0, 5).map(e => `• ${escapeHtml(e)}`).join('<br>');
      if (result.errors.length > 5) html += `<br>... +${result.errors.length - 5}`;
    }
    resultDiv.innerHTML = html;
    resultDiv.style.display = 'block';
    resultDiv.style.background = result.errors?.length ? '#fff3cd' : '#d4edda';
    resultDiv.style.border = `1px solid ${result.errors?.length ? '#ffc107' : '#28a745'}`;
    toast(currentLang === 'ar' ? '✅ تم استيراد المنيو' : '✅ Menu imported', 'success');
  } catch (e) {
    console.error('[Menu Import Error]', e);
    resultDiv.innerHTML = `<strong style="color:#e74c3c;">❌ ${escapeHtml(e.message || String(e))}</strong>`;
    resultDiv.style.display = 'block';
    resultDiv.style.background = '#f8d7da';
    resultDiv.style.border = '1px solid #f5c6cb';
    toast(currentLang === 'ar' ? `خطأ في الاستيراد: ${e.message}` : `Import failed: ${e.message}`, 'error');
  }
  input.value = '';
}
