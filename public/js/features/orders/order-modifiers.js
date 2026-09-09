// Modifier selection state and modal rendering.
let pendingModifierItem = null;
let currentModifiers = [];

async function addToOrder(itemId) {
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  
  if (item.has_modifiers === 1) {
    pendingModifierItem = item;
    openModifierModal(item);
    return;
  }

  const existing = currentOrder.items.find(i => i.item_id === itemId && (!i.selected_modifiers || i.selected_modifiers === '[]'));
  if (existing) { existing.quantity++; }
  else { currentOrder.items.push({ item_id: itemId, category_id: item.category_id, name: item.name, name_en: item.name_en, price: item.price, quantity: 1, note: '', selected_modifiers: '[]' }); }
  renderOrderItems();
  updateOrderTotals();
}

async function openModifierModal(item) {
  document.getElementById('modifier-item-name').textContent = currentLang === 'ar' ? item.name : (item.name_en || item.name);
  document.getElementById('modifier-total-price').textContent = item.price.toFixed(2);
  document.getElementById('modifier-groups-container').innerHTML = `<div style="padding:20px;text-align:center;">${t("loading_modifiers")}</div>`;
  document.getElementById('modifier-modal').classList.add('open');
  
  try {
    const mods = await api("/api/modifiers/item/" + item.id);
    currentModifiers = mods;
    renderModifiers(mods, item.price);
  } catch (e) {
    document.getElementById('modifier-groups-container').innerHTML = `<div style="padding:20px;color:red;">${t("modifiers_failed")}</div>`;
  }
}

function renderModifiers(mods, basePrice) {
  const container = document.getElementById('modifier-groups-container');
  if (mods.length === 0) {
    container.innerHTML = `<div style="padding:20px;text-align:center;">${t("no_modifiers")}</div>`;
    return;
  }
  
  // Group by group_name
  const groups = {};
  mods.forEach(m => {
    const gName = currentLang === 'ar' ? m.group_name : (m.group_name_en || m.group_name);
    if (!groups[gName]) groups[gName] = { is_multiple: m.is_multiple, is_required: m.is_required, items: [] };
    groups[gName].items.push(m);
  });
  
  let html = '';
  for (const [gName, g] of Object.entries(groups)) {
    const inputType = g.is_multiple ? 'checkbox' : 'radio';
    const reqText = g.is_required ? `<span style="color:red;font-size:0.8rem;">*${t("modifier_required")}</span>` : '';
    html += `
      <div class="modifier-group" style="margin-bottom: 15px; border: 1px solid #ddd; border-radius: 8px; padding: 10px;">
        <h4 style="margin-top:0; border-bottom: 1px solid #eee; padding-bottom: 5px;">${escapeHtml(gName)} ${reqText}</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
    `;
    g.items.forEach(m => {
      const name = currentLang === 'ar' ? m.name : (m.name_en || m.name);
      const priceText = m.price_extra > 0 ? `(+${m.price_extra})` : '';
      html += `
        <label style="display:flex; justify-content:space-between; cursor:pointer;">
          <span>
            <input type="${inputType}" name="modgroup_${escapeHtml(gName)}" value="${m.id}" data-price="${m.price_extra}" onchange="updateModifierTotal(${basePrice})">
            ${escapeHtml(name)}
          </span>
          <span style="color:var(--primary-color);font-weight:bold;">${priceText}</span>
        </label>
      `;
    });
    html += `</div></div>`;
  }
  
  container.innerHTML = html;
  
  document.getElementById('btn-add-modifier-item').onclick = () => {
    // Validate required
    let valid = true;
    for (const [gName, g] of Object.entries(groups)) {
      if (g.is_required) {
        const checked = container.querySelectorAll(`input[name="modgroup_${escapeHtml(gName)}"]:checked`);
        if (checked.length === 0) {
          valid = false;
          toast((currentLang === "ar" ? "يرجى اختيار من: " : "Please choose from: ") + gName, 'error');
          break;
        }
      }
    }
    if (!valid) return;
    
    const selected = [];
    let extraPrice = 0;
    container.querySelectorAll('input:checked').forEach(input => {
      const mod = currentModifiers.find(m => m.id === parseInt(input.value));
      if (mod) {
        selected.push({
          id: mod.id,
          name: mod.name,
          name_en: mod.name_en,
          price_extra: mod.price_extra
        });
        extraPrice += mod.price_extra;
      }
    });
    
    const finalPrice = basePrice + extraPrice;
    const modStr = JSON.stringify(selected);
    
    // Check if same item with SAME exact modifiers exists
    const existing = currentOrder.items.find(i => i.item_id === pendingModifierItem.id && i.selected_modifiers === modStr);
    if (existing) {
      existing.quantity++;
    } else {
      currentOrder.items.push({
        item_id: pendingModifierItem.id,
        category_id: pendingModifierItem.category_id,
        name: pendingModifierItem.name,
        name_en: pendingModifierItem.name_en,
        price: finalPrice,
        quantity: 1,
        note: '',
        selected_modifiers: modStr
      });
    }
    
    document.getElementById('modifier-modal').classList.remove('open');
    renderOrderItems();
    updateOrderTotals();
  };
}

function updateModifierTotal(basePrice) {
  let extra = 0;
  document.getElementById('modifier-groups-container').querySelectorAll('input:checked').forEach(input => {
    extra += parseFloat(input.dataset.price) || 0;
  });
  document.getElementById('modifier-total-price').textContent = (basePrice + extra).toFixed(2);
}
