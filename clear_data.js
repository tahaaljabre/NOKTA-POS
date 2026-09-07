const Database = require('better-sqlite3');
const config = require('./src/config/app.config');
const db = new Database(config.dbPath);

console.log('Clearing experimental data...');

const tablesToClear = [
  'items',
  'categories',
  'orders',
  'order_items',
  'customers',
  'inventory',
  'stock_logs',
  'modifiers',
  'item_modifiers',
  'audit_log',
  'shifts',
  'daily_closings'
];

db.transaction(() => {
  for (const table of tablesToClear) {
    db.prepare(`DELETE FROM "${table}"`).run();
    // reset sqlite sequence for the table if it exists
    try {
      db.prepare(`DELETE FROM sqlite_sequence WHERE name='${table}'`).run();
    } catch(e) {}
  }
  
  // reset table statuses
  db.prepare(`UPDATE "tables" SET status='empty', current_order_id=NULL`).run();
})();

console.log('Data cleared successfully.');
