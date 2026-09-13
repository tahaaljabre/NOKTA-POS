function platformBreakdown(orders) {
  const cents = {};
  let total = 0;
  for (const order of orders) {
    if (order.payment_method !== 'platform') continue;
    let attributes = {};
    try { attributes = JSON.parse(order.attributes || '{}'); } catch {}
    const id = String(attributes.delivery_app_id || 'unassigned');
    const amount = Math.round(Number(order.total || 0) * 100);
    cents[id] = (cents[id] || 0) + amount;
    total += amount;
  }
  return { total: total / 100, byApp: Object.fromEntries(Object.entries(cents).map(([id, amount]) => [id, amount / 100])) };
}
module.exports = { platformBreakdown };
