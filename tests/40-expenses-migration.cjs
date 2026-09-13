const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { schemaQueries } = require('../src/database/schema');
const { runMigrations } = require('../src/database/migrations');

const db = new DatabaseSync(':memory:');
db.exec("CREATE TABLE daily_closings (id INTEGER PRIMARY KEY, employee_id INTEGER, date TEXT, total_revenue REAL); INSERT INTO daily_closings VALUES (1, 1, '2026-09-01', 75)");
for (const query of schemaQueries) { try { db.exec(query); } catch (_) {} }
const previousWarn = console.warn;
try { console.warn = () => {}; runMigrations(db); }
finally { console.warn = previousWarn; }
for (const query of schemaQueries) { try { db.exec(query); } catch (_) {} }
assert.equal(db.prepare("SELECT total_revenue FROM daily_closings WHERE id=1").get().total_revenue, 75);
assert(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='shop_expenses'").get());
assert(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_shop_expenses_date'").get());
db.close();
console.log('PASS 40: existing database gains expense table without changing old closing');
