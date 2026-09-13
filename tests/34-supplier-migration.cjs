const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { runMigrations } = require('../src/database/migrations');

const db = new DatabaseSync(':memory:');
db.exec("CREATE TABLE suppliers (id INTEGER PRIMARY KEY, code TEXT, name TEXT); INSERT INTO suppliers VALUES (1, 'OLD-1', 'Existing supplier')");
db.exec("CREATE TABLE supplier_transactions (id INTEGER PRIMARY KEY, supplier_id INTEGER, transaction_type TEXT, transaction_date TEXT, amount REAL); INSERT INTO supplier_transactions VALUES (1, 1, 'payment', '2026-09-12', 12)");
const previousWarn = console.warn;
try {
  // This fixture deliberately contains only an old supplier table.
  console.warn = () => {};
  runMigrations(db);
} finally {
  console.warn = previousWarn;
}
const row = db.prepare('SELECT name, total_purchases, total_payments, current_balance, cashier_id FROM suppliers WHERE id=1').get();
assert.equal(row.name, 'Existing supplier');
assert.equal(row.total_purchases, 0);
assert.equal(row.total_payments, 0);
assert.equal(row.current_balance, 0);
assert.equal(row.cashier_id, null);
const legacyPayment = db.prepare("SELECT t.transaction_number,t.amount,t.payment_method,t.created_by,s.name supplier_name FROM supplier_transactions t JOIN suppliers s ON s.id=t.supplier_id WHERE t.transaction_type='payment' AND t.transaction_date='2026-09-12'").get();
assert.equal(legacyPayment.amount, 12);
assert.equal(legacyPayment.supplier_name, 'Existing supplier');
assert.equal(legacyPayment.transaction_number, null);
db.close();
console.log('PASS 34: legacy supplier fields migrate without changing existing rows');
