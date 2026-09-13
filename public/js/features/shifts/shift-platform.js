function platformBreakdownFromOrders(orders) {
  const cents = {};
  for (const order of orders) {
    if (order.payment_method !== 'platform') continue;
    let attributes = {};
    try { attributes = typeof order.attributes === 'string' ? JSON.parse(order.attributes) : (order.attributes || {}); } catch {}
    const app = String(attributes.delivery_app || attributes.delivery_app_id || 'Unassigned');
    cents[app] = (cents[app] || 0) + Math.round(Number(order.total || 0) * 100);
  }
  return Object.fromEntries(Object.entries(cents).map(([app, value]) => [app, value / 100]));
}

function readPlatformBreakdown(value) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value || '{}'); } catch { return {}; }
}

function deliveryAppName(id) {
  const method = (typeof deliveryMethodsList !== 'undefined' ? deliveryMethodsList : []).find(item => item.id === id);
  return method?.name || id;
}
