const { start } = require('./support.cjs');
(async () => {
  const { api, db, assert, close } = await start();
  try {
    const date = require('../src/services/business-time').dayOf();
    const input = { type: 'delivery', status: 'completed', items: [{ item_id: 1, quantity: 1 }],
      payment_method: 'platform', attributes: { delivery_app_id: 'grab' } };
    const grab = await api('/api/orders', 'POST', input);
    assert.equal(grab.status, 200, JSON.stringify(grab.data));
    assert.equal(grab.data.payment_method, 'platform');
    assert.equal(JSON.parse(grab.data.attributes).delivery_app_id, 'grab');
    assert.equal((await api(`/api/orders/${grab.data.id}`, 'PUT', { version: grab.data.version, payment_method: 'cash' })).status, 400);
    assert.equal((await api('/api/orders', 'POST', { ...input, payment_method: 'cash' })).status, 400);
    assert.equal((await api('/api/orders', 'POST', { ...input, attributes: { delivery_app_id: 'unknown' } })).status, 400);
    const line = await api('/api/orders', 'POST', { ...input, attributes: { delivery_app_id: 'lineman' } });
    assert.equal(line.status, 200, JSON.stringify(line.data));
    const report = await api(`/api/reports/sales?from=${date}&to=${date}`);
    assert.equal(report.status, 200);
    assert.equal(report.data.by_delivery_app.length, 2);
    assert.equal(report.data.by_payment.find(x => x.payment_method === 'platform').count, 2);
    assert.equal(report.data.by_payment.some(x => x.payment_method === 'cash'), false);
    assert.equal(report.data.by_channel.find(x => x.channel === 'platform').count, 2);
    assert.equal(report.data.totals.platform_receivable, grab.data.total + line.data.total);
    const workbook = await require('../src/services/sales-report-excel.service').createSalesReportWorkbook(report.data, { language: 'ar' });
    assert.equal(workbook.getWorksheet('تطبيقات التوصيل').rowCount, 5);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM orders WHERE payment_method='platform'").get().n, 2);
    console.log('PASS 30: platform invoices stay separate from cash and are reported per application');
  } finally { await close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
