// Audit metadata, action types, and action icon mapping.
// Extracted from audit.js.

function auditActionMeta(action) {
  const colors = {
    login:          { icon: '🔑', color: '#2563eb', bg: '#eff6ff', key: 'audit_action_login' },
    create:         { icon: '➕', color: '#059669', bg: '#ecfdf5', key: 'audit_action_create' },
    update:         { icon: '✏️', color: '#d97706', bg: '#fffbeb', key: 'audit_action_update' },
    delete:         { icon: '🗑️', color: '#dc2626', bg: '#fef2f2', key: 'audit_action_delete' },
    create_order:   { icon: '🧾', color: '#059669', bg: '#ecfdf5', key: 'audit_action_create_order' },
    create_expense: { icon: '💸', color: '#b45309', bg: '#fffbeb', key: 'audit_action_create_expense' },
    update_order:   { icon: '📝', color: '#d97706', bg: '#fffbeb', key: 'audit_action_update_order' },
    delete_order:   { icon: '🗑️', color: '#dc2626', bg: '#fef2f2', key: 'audit_action_delete_order' },
    cancel_order:   { icon: '❌', color: '#dc2626', bg: '#fef2f2', key: 'audit_action_cancel_order' },
    complete_order: { icon: '✅', color: '#059669', bg: '#ecfdf5', key: 'audit_action_complete_order' },
    discount:       { icon: '🏷️', color: '#7c3aed', bg: '#f5f3ff', key: 'audit_action_discount' },
    deactivate:     { icon: '⛔', color: '#dc2626', bg: '#fef2f2', key: 'audit_action_deactivate' },
  };
  const m = colors[action];
  if (m) return { icon: m.icon, label: t(m.key), color: m.color, bg: m.bg };
  return { icon: '📌', label: t('audit_action_unknown') + ': ' + action, color: '#6b7280', bg: '#f9fafb' };
}

function parseOrderSnapshot(raw) {
  if (!raw || raw === 'DELETED' || raw === '""') return null;
  try {
    const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (d && (d.invoice_number !== undefined || d.total !== undefined || d.items !== undefined)) return d;
    if (d && d.order) return d.order;
    return null;
  } catch { return null; }
}

// Completing/payment updates are logged by the order service too, but they
// are not audit-worthy edits unless the invoice content actually changed.
function hasMeaningfulOrderChange(before, after, action) {
  if (!before || !after) return action === 'delete_order' || action === 'cancel_order';
  if (action === 'delete_order' || action === 'cancel_order') return true;
  const items = snap => JSON.stringify((snap.items || []).map(i => [
    i.item_id ?? i.id ?? i.item_name ?? i.name, i.item_name ?? i.name ?? i.item_name_en ?? i.name_en, Number(i.quantity), Number(i.price), Number(i.discount || 0)
  ]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  return items(before) !== items(after)
    || Number(before.discount_percent || 0) !== Number(after.discount_percent || 0)
    || Number(before.discount_amount || 0) !== Number(after.discount_amount || 0)
    || Number(before.subtotal || 0) !== Number(after.subtotal || 0)
    || Number(before.tax_percent || 0) !== Number(after.tax_percent || 0)
    || Number(before.tax_amount || 0) !== Number(after.tax_amount || 0)
    || Number(before.total || 0) !== Number(after.total || 0)
    || String(before.note || '') !== String(after.note || '');
}
