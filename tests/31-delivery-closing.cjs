const { start } = require('./support.cjs');
(async () => {
  const { api, db, assert, close, id } = await start();
  try {
    const date = require('../src/services/business-time').dayOf();
    const base = { status: 'completed', items: [{ item_id: 1, quantity: 1 }] };
    const grab = await api('/api/orders', 'POST', { ...base, type: 'delivery', payment_method: 'platform', attributes: { delivery_app_id: 'grab' } });
    const line = await api('/api/orders', 'POST', { ...base, type: 'delivery', payment_method: 'platform', attributes: { delivery_app_id: 'lineman' } });
    const cash = await api('/api/orders', 'POST', { ...base, type: 'takeaway', payment_method: 'cash' });
    const closeResult = await api('/api/daily-closings/close', 'POST', { date });
    assert.equal(closeResult.status, 200, JSON.stringify(closeResult.data));
    const closing = db.prepare('SELECT * FROM daily_closings WHERE employee_id=? AND date=?').get(id, date);
    assert.equal(closing.cash_total, cash.data.total);
    assert.equal(closing.platform_total, grab.data.total + line.data.total);
    const apps = JSON.parse(closing.platform_breakdown);
    assert.equal(apps.grab, grab.data.total);
    assert.equal(apps.lineman, line.data.total);
    assert.equal(closing.total_revenue, cash.data.total + grab.data.total + line.data.total);
    console.log('PASS 31: closing separates each platform from cash and preserves total revenue');
  } finally { await close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
