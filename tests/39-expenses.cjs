const { start } = require('./support.cjs');

(async () => {
  const { api, db, id, assert, close } = await start();
  try {
    const date = require('../src/services/business-time').dayOf();
    const cashier = await api('/api/cashiers', 'POST', { code: 'EXPA', name: 'Expense cashier' });
    assert.equal(cashier.status, 200, JSON.stringify(cashier.data));
    const employeeId = Number(db.prepare('INSERT INTO employees (name,pin,role,permissions,cashier_code) VALUES (?,?,?,?,?)')
      .run('Expense employee', '1234', 'cashier', JSON.stringify({ manage_expenses: true }), 'EXPA').lastInsertRowid);
    const deniedId = Number(db.prepare('INSERT INTO employees (name,pin,role,permissions) VALUES (?,?,?,?)')
      .run('No expense access', '1234', 'cashier', '{}').lastInsertRowid);
    assert.equal((await api('/api/expenses', 'GET', undefined, deniedId)).status, 403);
    const base = { expense_date: date, title: 'Cleaning supplies', category: 'purchase', amount: 20,
      payment_method: 'cash', cashier_id: cashier.data.id, payee: 'Local shop', notes: 'Daily purchase' };
    assert.equal((await api('/api/expenses', 'POST', base, deniedId)).status, 403);
    assert.equal((await api('/api/expenses', 'POST', { ...base, amount: -2 }, employeeId)).status, 400);
    const cash = await api('/api/expenses', 'POST', base, employeeId);
    assert.equal(cash.status, 201, JSON.stringify(cash.data));
    const bank = await api('/api/expenses', 'POST', { ...base, title: 'Electricity', category: 'utilities', amount: 5,
      payment_method: 'bank_transfer' }, employeeId);
    assert.equal(bank.status, 201, JSON.stringify(bank.data));
    const list = await api(`/api/expenses?from=${date}&to=${date}`, 'GET', undefined, employeeId);
    assert.equal(list.status, 200);
    assert.equal(list.data.count, 2);
    assert.equal(list.data.total, 25);
    assert.equal(list.data.items[0].cashier_name, 'Expense cashier');
    assert.equal(db.prepare("SELECT COUNT(*) count FROM audit_log WHERE entity='shop_expense'").get().count, 2);
    const daily = await api(`/api/reports/daily?date=${date}`);
    assert.equal(daily.status, 200);
    assert.equal(daily.data.shop_expenses_total, 25);
    assert.equal(daily.data.expenses_total, 25);
    assert.equal(daily.data.cash_expenses, 20);
    assert.equal(daily.data.net_after_expenses, daily.data.total_revenue - 25);
    const shift = await api(`/api/daily-closings/current-shift?date=${date}`, 'GET', undefined, employeeId);
    assert.equal(shift.data.cash_shop_expenses, 20);
    console.log('PASS 39: permissioned shop expenses, audit, period report and daily closing');
  } finally { await close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
