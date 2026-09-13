const { start } = require('./support.cjs');
(async () => {
  const { api, db, assert, close } = await start();
  try {
    const cashier = await api('/api/cashiers', 'POST', { code: 'SUPC', name: 'Supplier cashier' });
    assert.equal(cashier.status, 200);
    const created = await api('/api/suppliers', 'POST', {
      code: 'SUP-0001', name: 'Test supplier', phone: '0500000000',
      tax_number: '123456789', address: 'Test address', cashier_id: cashier.data.id
    });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const supplier = await api(`/api/suppliers/${created.data.id}`);
    assert.equal(supplier.data.cashier_id, cashier.data.id);
    assert.equal(supplier.data.tax_number, '123456789');
    assert.equal((await api('/api/suppliers/stats/summary')).status, 200);
    const quick = await api(`/api/suppliers/${created.data.id}/purchases`, 'POST', {
      mode: 'quick', purchase_date: '2026-09-12', quick_description: 'Supplies', quick_total: 50,
      paid_amount: 20, payment_method: 'cash'
    });
    assert.equal(quick.status, 200, JSON.stringify(quick.data));
    const detailed = await api(`/api/suppliers/${created.data.id}/purchases`, 'POST', {
      mode: 'detailed', purchase_date: '2026-09-12', items: [{ name: 'Oil', quantity: 2, unit_price: 10, total: 900 }],
      tax_amount: 1, discount_amount: 2, shipping_cost: 3, total_amount: 900, paid_amount: 0
    });
    assert.equal(detailed.status, 200, JSON.stringify(detailed.data));
    assert.equal(db.prepare('SELECT total_amount FROM supplier_purchases WHERE id=?').get(detailed.data.id).total_amount, 22);
    assert.equal(db.prepare('SELECT total_amount FROM supplier_purchases WHERE id=?').get(quick.data.id).total_amount, 50);
    const overpayment = await api(`/api/suppliers/${created.data.id}/purchases`, 'POST', {
      mode: 'quick', purchase_date: '2026-09-12', quick_description: 'Invalid', quick_total: 10, paid_amount: 11
    });
    assert.equal(overpayment.status, 400);
    const payment = await api(`/api/suppliers/${created.data.id}/payments`, 'POST', {
      payment_date: '2026-09-12', amount: 10, payment_method: 'cash'
    });
    assert.equal(payment.status, 200, JSON.stringify(payment.data));
    assert.equal(db.prepare('SELECT cashier_id FROM suppliers WHERE id=?').get(created.data.id).cashier_id, cashier.data.id);
    console.log('PASS 28: supplier create, cashier assignment, payment and statistics');
  } finally { await close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
