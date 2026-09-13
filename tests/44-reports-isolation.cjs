const { start } = require('./support.cjs');

(async () => {
  const { api, db, assert, close } = await start();
  try {
    const noCashier = (await api('/api/employees', 'POST', { name: 'Reports without cashier', pin: '9444', permissions: { reports: true } })).data.id;
    assert.equal((await api('/api/reports/sales', 'GET', undefined, noCashier)).status, 403);

    const cashier = (await api('/api/employees', 'POST', { name: 'Scoped cashier', pin: '9555', cashier_code: 'A', permissions: { reports: true } })).data.id;
    const otherOrder = await api('/api/orders', 'POST', { status: 'completed', items: [{ item_id: 1, quantity: 1 }] });
    assert.equal(otherOrder.status, 200);
    db.prepare("UPDATE orders SET cashier_code='B' WHERE id=?").run(otherOrder.data.id);
    const report = await api('/api/reports/sales?cashier_code=B', 'GET', undefined, cashier);
    assert.equal(report.status, 200);
    assert.equal(report.data.totals.total_orders, 0);
    assert.equal((await api('/api/reports/daily?employee_id=999', 'GET', undefined, cashier)).status, 200);
    console.log('PASS 44: reports require a cashier assignment and force non-admin cashier scope');
  } finally { await close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
