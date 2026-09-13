const { start } = require('./support.cjs');
(async () => {
  const { db, assert, close } = await start();
  try {
    db.prepare('ALTER TABLE daily_closings DROP COLUMN platform_total').run();
    db.prepare('ALTER TABLE daily_closings DROP COLUMN platform_breakdown').run();
    db.prepare('ALTER TABLE daily_closings DROP COLUMN counted_cash').run();
    db.prepare("INSERT INTO daily_closings(employee_id,employee_name,date,cash_total,total_revenue) VALUES (1,'Legacy','2026-09-01',12,12)").run();
    require('../src/database/migrations').runMigrations(db);
    const columns = db.prepare('PRAGMA table_info(daily_closings)').all().map(row => row.name);
    assert(columns.includes('platform_total'));
    assert(columns.includes('platform_breakdown'));
    assert(columns.includes('counted_cash'));
    const old = db.prepare("SELECT cash_total,total_revenue,platform_total FROM daily_closings WHERE date='2026-09-01'").get();
    assert.equal(old.cash_total, 12);
    assert.equal(old.total_revenue, 12);
    assert.equal(old.platform_total, 0);
    assert.equal(db.prepare("SELECT counted_cash FROM daily_closings WHERE date='2026-09-01'").get().counted_cash, null);
    console.log('PASS 32: older closing table gains platform columns without changing existing data');
  } finally { await close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
