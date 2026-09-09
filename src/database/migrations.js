// Database Migrations & Version Tracking

function addColumnIfNotExists(db, table, column, type) {
  try {
    const columns = db.prepare(`PRAGMA table_info("${table}")`).all();
    const exists = columns.some(row => row.name === column);
    if (!exists) {
      db.prepare(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}`).run();
    }
  } catch (e) {
    if (!e.message.includes('duplicate column name')) {
      console.warn(`Migration warning for ${table}.${column}:`, e.message);
    }
  }
}

function runMigrations(db) {
  // New HR/attendance tables are created by schema.js. Keep this migration
  // marker for installations upgraded from a pre-attendance database.
  db.prepare(`CREATE TABLE IF NOT EXISTS hr_employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT, employee_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL, name_en TEXT DEFAULT '', phone TEXT DEFAULT '',
    department TEXT DEFAULT '', job_title TEXT DEFAULT '', employment_type TEXT DEFAULT 'full_time',
    active INTEGER DEFAULT 1, hire_date TEXT, attributes TEXT DEFAULT '{}', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT, hr_employee_id INTEGER NOT NULL, attendance_date TEXT NOT NULL,
    check_in TEXT, check_out TEXT, status TEXT DEFAULT 'present', source TEXT DEFAULT 'manual',
    device_id INTEGER, note TEXT DEFAULT '', approved_by INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(hr_employee_id, attendance_date)
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS biometric_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, provider TEXT NOT NULL,
    host TEXT DEFAULT '', port INTEGER DEFAULT 0, active INTEGER DEFAULT 1, last_sync_at DATETIME,
    attributes TEXT DEFAULT '{}', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  // Ensure table columns for backward compatibility & extensibility
  const columnsToAdd = [
    // Orders
    ['orders', 'version', 'INTEGER NOT NULL DEFAULT 1'],
    ['orders', 'invoice_number', 'INTEGER DEFAULT 0'],
    ['orders', 'employee_name', "TEXT DEFAULT ''"],
    ['orders', 'employee_id', 'INTEGER DEFAULT 1'],
    ['orders', 'customer_id', 'INTEGER'],
    ['orders', 'shift_id', 'INTEGER'],
    ['orders', 'payment_method', "TEXT DEFAULT 'cash'"],
    ['orders', 'subtotal', 'REAL DEFAULT 0'],
    ['orders', 'discount_percent', 'REAL DEFAULT 0'],
    ['orders', 'discount_amount', 'REAL DEFAULT 0'],
    ['orders', 'tax_percent', 'REAL DEFAULT 0'],
    ['orders', 'tax_amount', 'REAL DEFAULT 0'],
    ['orders', 'total', 'REAL DEFAULT 0'],
    ['orders', 'paid_amount', 'REAL DEFAULT 0'],
    ['orders', 'change_amount', 'REAL DEFAULT 0'],
    ['orders', 'note', "TEXT DEFAULT ''"],
    ['orders', 'synced', 'INTEGER DEFAULT 0'],
    ['orders', 'is_deleted', 'INTEGER DEFAULT 0'],
    ['orders', 'attributes', "TEXT DEFAULT '{}'"],
    ['orders', 'completed_at', 'DATETIME'],

    // Order Items
    ['order_items', 'cost_price', 'REAL DEFAULT 0'],
    ['order_items', 'discount_amount', 'REAL DEFAULT 0'],
    ['order_items', 'selected_modifiers', "TEXT DEFAULT '[]'"],
    ['order_items', 'attributes', "TEXT DEFAULT '{}'"],

    // Items
    ['items', 'image', "TEXT DEFAULT ''"],
    ['items', 'name_en', "TEXT DEFAULT ''"],
    ['items', 'cost_price', 'REAL DEFAULT 0'],
    ['items', 'barcode', "TEXT DEFAULT ''"],
    ['items', 'sku', "TEXT DEFAULT ''"],
    ['items', 'has_modifiers', 'INTEGER DEFAULT 0'],
    ['items', 'attributes', "TEXT DEFAULT '{}'"],

    // Categories
    ['categories', 'name_en', "TEXT DEFAULT ''"],
    ['categories', 'active', 'INTEGER DEFAULT 1'],
    ['categories', 'attributes', "TEXT DEFAULT '{}'"],

    // Employees
    ['employees', 'username', 'TEXT'],
    ['employees', 'token_rev', 'INTEGER NOT NULL DEFAULT 0'],
    ['employees', 'password_hash', 'TEXT'],
    ['employees', 'name_en', "TEXT DEFAULT ''"],
    ['employees', 'phone', "TEXT DEFAULT ''"],
    ['employees', 'default_floor', "INTEGER DEFAULT 1"],
    ['employees', 'default_station', "TEXT DEFAULT 'cashier_floor1'"],
    ['employees', 'attributes', "TEXT DEFAULT '{}'"],
    ['employees', 'max_discount', 'REAL DEFAULT 100'],

    // Tables
    ['tables', 'zone_id', 'INTEGER'],
    ['tables', 'current_order_id', 'INTEGER'],
    ['tables', 'attributes', "TEXT DEFAULT '{}'"],

    // Daily Closings
    ['daily_closings', 'opening_cash', 'REAL DEFAULT 0'],
    ['daily_closings', 'opened_at', "DATETIME"],
    ['daily_closings', 'attributes', "TEXT DEFAULT '{}'"],

    // Audit Log
    ['audit_log', 'ip_address', "TEXT DEFAULT ''"],

    // Station & Floor identification for orders
    ['orders', 'station_id', "TEXT DEFAULT 'cashier_main'"],
    ['orders', 'floor', "INTEGER DEFAULT 1"],
    ['orders', 'offline_id', "TEXT DEFAULT ''"],
    ['orders', 'sync_status', "TEXT DEFAULT 'synced'"]
  ];

  columnsToAdd.forEach(([table, col, type]) => {
    addColumnIfNotExists(db, table, col, type);
  });
  try { db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_username ON employees(username) WHERE username IS NOT NULL').run(); } catch (e) { console.warn('Migration warning for employee usernames:', e.message); }
}

module.exports = { runMigrations, addColumnIfNotExists };
