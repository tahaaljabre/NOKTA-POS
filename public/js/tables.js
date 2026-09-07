// ===== Tables =====
async function loadTables() {
  try {
    if (isOnline) {
      tables = await api('/api/tables');
      await cacheData('tables', tables);
    } else {
      tables = await getCachedData('tables');
    }
  } catch (error) {
    console.error('Load tables error:', error);
    tables = await getCachedData('tables');
  }
  renderTableSelect();
}

function renderTableSelect() {
  const sel = document.getElementById('table-select');
  sel.innerHTML = `<option value="">${currentLang === 'ar' ? 'بدون طاولة' : 'No table'}</option>` + tables.map(t => `<option value="${t.id}">${currentLang === 'ar' ? 'طاولة' : 'Table'} ${t.number}${escapeHtml(t.name ? ' - ' + t.name : '')}</option>`).join('');
}

// ===== Tables View =====
function renderTablesView() {
  const container = document.getElementById('tables-container');
  container.innerHTML = tables.map(tb => `
    <div class="table-card ${escapeHtml(tb.status === 'empty' ? 'empty' : 'occupied')}" data-id="${tb.id}">
      <div>🪑 ${tb.number}</div>
      <div class="table-status">${escapeHtml(tb.status === 'empty' ? t('table_empty') : t('table_occupied'))}</div>
      ${tb.name ? `<div style="font-size:12px;margin-top:2px;">${escapeHtml(tb.name)}</div>` : ''}
    </div>
  `).join('');
  container.querySelectorAll('.table-card').forEach(card => {
    card.onclick = () => {
      const id = parseInt(card.dataset.id);
      const tb = tables.find(t => t.id === id);
      if (tb.status === 'empty') {
        document.querySelector('.nav-btn[data-view="pos"]').click();
        document.getElementById('table-select').value = id;
        currentOrder.table_id = id;
      }
    };
  });
}

// ===== Tables Admin =====
async function loadTablesAdmin() {
  const body = document.querySelector('#tables-admin-table tbody');
  if (!body) return;
  const renderAdminRows = () => {
    if (!tables.length) {
      body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;">${currentLang === 'ar' ? 'لا توجد طاولات بعد' : 'No tables yet'}</td></tr>`;
      return;
    }
    body.innerHTML = tables.map(table => `
      <tr>
        <td>${table.number}</td>
        <td>${escapeHtml(table.name || '-')}</td>
        <td>${table.capacity}</td>
        <td class="${escapeHtml(table.status === 'empty' ? 'status-active' : 'status-inactive')}">${escapeHtml(table.status === 'empty' ? t('table_empty') : t('table_occupied'))}</td>
        <td class="action-btns">
          <button class="btn-edit" data-table-id="${table.id}">${currentLang === 'ar' ? 'تعديل' : 'Edit'}</button>
          <button class="btn-delete" data-table-id="${table.id}">${currentLang === 'ar' ? 'حذف' : 'Delete'}</button>
        </td>
      </tr>
    `).join('');
    body.querySelectorAll('.btn-edit').forEach(button => {
      button.onclick = () => openTableAdminModal(tables.find(table => table.id === Number(button.dataset.tableId)));
    });
    body.querySelectorAll('.btn-delete').forEach(button => {
      button.onclick = () => deleteTable(Number(button.dataset.tableId));
    });
  };

  // Show the already loaded list immediately; do not make the screen wait for a refresh.
  if (Array.isArray(tables) && tables.length) renderAdminRows();
  else body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;">${currentLang === 'ar' ? 'جاري تحميل الطاولات...' : 'Loading tables...'}</td></tr>`;
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Tables request timed out')), 6000));
    tables = await Promise.race([api('/api/tables'), timeout]);
    await cacheData('tables', tables);
    renderTableSelect();
  } catch (error) {
    console.error('Load tables admin error:', error);
    if (!tables.length) tables = await getCachedData('tables');
  }
  renderAdminRows();
}

function openTableAdminModal(table = null) {
  openModal(table ? (currentLang === 'ar' ? 'تعديل الطاولة' : 'Edit Table') : t('add_table'), `
    <label>${t('table_number')}</label><input type="number" id="modal-tbl-number" value="${table ? table.number : ''}">
    <label>${t('table_name')}</label><input type="text" id="modal-tbl-name" value="${escapeHtml(table ? table.name : '')}">
    <label>${t('table_capacity')}</label><input type="number" id="modal-tbl-capacity" value="${table ? table.capacity : 4}">
  `, async () => {
    const data = { number: parseInt(document.getElementById('modal-tbl-number').value), name: document.getElementById('modal-tbl-name').value, capacity: parseInt(document.getElementById('modal-tbl-capacity').value) || 4, status: table ? table.status : 'empty' };
    if (!data.number) return toast(t('error'), 'error');
    if (table) await api(`/api/tables/${table.id}`, 'PUT', data);
    else await api('/api/tables', 'POST', data);
    toast(t('saved'), 'success');
    await loadTables();
    loadTablesAdmin();
  });
}

async function deleteTable(id) {
  if (!confirm(t('confirm_delete'))) return;
  await api(`/api/tables/${id}`, 'DELETE');
  toast(t('deleted'), 'success');
  await loadTables();
  loadTablesAdmin();
}
