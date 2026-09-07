// Inventory Management UI Logic

async function loadInventory() {
  try {
    const data = await api('/api/inventory');
    renderInventoryTable(data);
  } catch (err) {
    console.error('Error loading inventory:', err);
  }
}

function renderInventoryTable(data) {
  const tbody = document.getElementById('inventory-table-body');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  data.forEach(item => {
    const isLowStock = item.quantity <= item.min_alert_level;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.id}</td>
      <td>${escapeHtml(item.menu_item_name || '-')}</td>
      <td>${escapeHtml(item.item_name)}</td>
      <td style="color: ${isLowStock ? 'red' : 'inherit'}; font-weight: ${isLowStock ? 'bold' : 'normal'}">
        ${item.quantity}
      </td>
      <td>${escapeHtml(item.unit)}</td>
      <td>${item.min_alert_level}</td>
      <td>
        <button class="btn btn-secondary" onclick="openAdjustStockModal(${item.id}, '', ${item.quantity})">تعديل (Adjust)</button>
        <button class="btn btn-secondary" onclick="viewStockLogs(${item.id})">السجل (Logs)</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openInventoryModal() {
  document.getElementById('inventory-modal').style.display = 'flex';
  document.getElementById('inv-id').value = '';
  document.getElementById('inv-item-name').value = '';
  document.getElementById('inv-quantity').value = '';
  document.getElementById('inv-unit').value = 'pcs';
  document.getElementById('inv-min-alert').value = '5';
  loadMenuItemsForInventory();
}

function closeInventoryModal() {
  document.getElementById('inventory-modal').style.display = 'none';
}

async function loadMenuItemsForInventory() {
  try {
    const items = await api('/api/items');
    const select = document.getElementById('inv-menu-item-id');
    select.innerHTML = '<option value="">لا يوجد (Not linked to menu item)</option>';
    items.forEach(i => {
      select.innerHTML += `<option value="${i.id}">${escapeHtml(i.name)}</option>`;
    });
  } catch (err) {
    console.error(err);
  }
}

async function saveInventoryItem() {
  const payload = {
    item_id: document.getElementById('inv-menu-item-id').value || null,
    item_name: document.getElementById('inv-item-name').value,
    quantity: parseFloat(document.getElementById('inv-quantity').value),
    unit: document.getElementById('inv-unit').value,
    min_alert_level: parseFloat(document.getElementById('inv-min-alert').value)
  };
  
  try {
    await api("/api/inventory", "POST", payload);
    const res = {ok:true};
    if (res.ok) {
      closeInventoryModal();
      loadInventory();
      alert('تم الحفظ بنجاح (Saved successfully)');
    } else {
      alert('خطأ في الحفظ (Error saving)');
    }
  } catch (err) {
    console.error(err);
  }
}

function openAdjustStockModal(id, name, currentQty) {
  document.getElementById('adjust-stock-modal').style.display = 'flex';
  document.getElementById('adj-inv-id').value = id;
  document.getElementById('adj-item-name').innerText = name;
  document.getElementById('adj-current-qty').innerText = currentQty;
  document.getElementById('adj-change').value = '';
  document.getElementById('adj-notes').value = '';
}

function closeAdjustStockModal() {
  document.getElementById('adjust-stock-modal').style.display = 'none';
}

async function saveStockAdjustment() {
  const id = document.getElementById('adj-inv-id').value;
  const change = document.getElementById('adj-change').value;
  const notes = document.getElementById('adj-notes').value;
  
  try {
    await api("/api/inventory/"+id+"/adjust", "POST", { quantity_change: change, type: "adjustment", notes });
    const res = {ok:true};
    
    if (res.ok) {
      closeAdjustStockModal();
      loadInventory();
      alert('تم تعديل الرصيد بنجاح (Stock adjusted successfully)');
    } else {
      alert('خطأ في تعديل الرصيد (Error adjusting stock)');
    }
  } catch (err) {
    console.error(err);
  }
}

async function viewStockLogs(id) {
  // Simple implementation for MVP - you'd normally show this in a modal
  try {
    const logs = await api("/api/inventory/"+id+"/logs");
    let text = 'سجل الحركات (Stock Logs):\\n\\n';
    logs.forEach(l => {
      text += `[${parsePOSDate(l.created_at).toLocaleString()}] ${l.type}: ${l.quantity} (رصيد سابق: ${l.previous_qty} -> جديد: ${l.new_qty}) - ${escapeHtml(l.notes)}\n`;
    });
    alert(text);
  } catch(err) {
    console.error(err);
  }
}

// Ensure loadInventory is called when the inventory tab is clicked
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('admin-tab') && e.target.getAttribute('data-admin') === 'inventory-admin') {
      loadInventory();
    }
  });
});
