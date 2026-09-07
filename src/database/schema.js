// Flexible & Extensible Database Schema Definitions

const schemaQueries = [
  // 1. Employees & Roles
  `CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    name TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    pin TEXT NOT NULL,
    role TEXT DEFAULT 'cashier',
    permissions TEXT DEFAULT '{}',
    phone TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    attributes TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 2. Categories
  `CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    icon TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    attributes TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 3. Items & Products
  `CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    category_id INTEGER,
    price REAL NOT NULL DEFAULT 0,
    price2 REAL,
    cost_price REAL DEFAULT 0,
    image TEXT DEFAULT '',
    barcode TEXT DEFAULT '',
    sku TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    has_modifiers INTEGER DEFAULT 0,
    attributes TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 4. Modifiers & Options (e.g. Size, Spice level, Extra Cheese)
  `CREATE TABLE IF NOT EXISTS modifiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_name TEXT NOT NULL,
    group_name_en TEXT DEFAULT '',
    name TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    price_extra REAL DEFAULT 0,
    is_required INTEGER DEFAULT 0,
    is_multiple INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 5. Item-Modifier Associations
  `CREATE TABLE IF NOT EXISTS item_modifiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    modifier_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 6. Table Zones / Floor Sections (e.g. Main Hall, Family Section, VIP, Outdoor)
  `CREATE TABLE IF NOT EXISTS table_zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 7. Dining Tables
  `CREATE TABLE IF NOT EXISTS "tables" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id INTEGER,
    number INTEGER NOT NULL UNIQUE,
    name TEXT DEFAULT '',
    capacity INTEGER DEFAULT 4,
    status TEXT DEFAULT 'empty',
    current_order_id INTEGER,
    attributes TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 8. Customers & CRM / Delivery Addresses
  `CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    delivery_notes TEXT DEFAULT '',
    points INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    attributes TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 9. Orders Header
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number INTEGER DEFAULT 0,
    table_id INTEGER,
    customer_id INTEGER,
    type TEXT DEFAULT 'dine_in',
    status TEXT DEFAULT 'active',
    subtotal REAL DEFAULT 0,
    discount_percent REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    tax_percent REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    paid_amount REAL DEFAULT 0,
    change_amount REAL DEFAULT 0,
    payment_method TEXT DEFAULT 'cash',
    note TEXT DEFAULT '',
    employee_id INTEGER,
    employee_name TEXT DEFAULT '',
    shift_id INTEGER,
    synced INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    attributes TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  )`,

  // 10. Order Items Detail
  `CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    price REAL NOT NULL DEFAULT 0,
    cost_price REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    note TEXT DEFAULT '',
    selected_modifiers TEXT DEFAULT '[]',
    attributes TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 11. Shifts / Cash Drawer Management
  `CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    employee_name TEXT DEFAULT '',
    opening_cash REAL DEFAULT 0,
    closing_cash REAL DEFAULT 0,
    expected_cash REAL DEFAULT 0,
    cash_difference REAL DEFAULT 0,
    total_sales REAL DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    status TEXT DEFAULT 'open',
    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    notes TEXT DEFAULT ''
  )`,

  // 12. Inventory & Stock Management
  `CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER UNIQUE,
    item_name TEXT NOT NULL,
    quantity REAL DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    min_alert_level REAL DEFAULT 5,
    cost_unit REAL DEFAULT 0,
    last_restocked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 13. Stock Movement Logs
  `CREATE TABLE IF NOT EXISTS stock_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    quantity REAL NOT NULL,
    previous_qty REAL DEFAULT 0,
    new_qty REAL DEFAULT 0,
    reference_id TEXT DEFAULT '',
    employee_id INTEGER,
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 14. Daily Closings Summary
  `CREATE TABLE IF NOT EXISTS daily_closings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    employee_name TEXT DEFAULT '',
    date TEXT NOT NULL,
    opening_cash REAL DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_revenue REAL DEFAULT 0,
    cash_total REAL DEFAULT 0,
    promptpay_total REAL DEFAULT 0,
    card_total REAL DEFAULT 0,
    truemoney_total REAL DEFAULT 0,
    is_closed INTEGER DEFAULT 0,
    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    notes TEXT DEFAULT '',
    attributes TEXT DEFAULT '{}'
  )`,

  // 15. Discounts & Coupons
  `CREATE TABLE IF NOT EXISTS discounts_coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    discount_type TEXT DEFAULT 'percentage',
    discount_value REAL NOT NULL DEFAULT 0,
    min_order_amount REAL DEFAULT 0,
    max_discount_amount REAL DEFAULT 0,
    start_date DATE,
    end_date DATE,
    usage_limit INTEGER DEFAULT 0,
    times_used INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 16. Audit Log
  `CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    employee_name TEXT,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id INTEGER,
    details TEXT,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 17. System & Restaurant Settings
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,

  // 18. Sync Log
  `CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    last_sync DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 19. Performance Indexes for High-Speed Queries across Multi-Stations
  `CREATE INDEX IF NOT EXISTS idx_items_cat_active ON items(category_id, active, sort_order)`,
  `CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, is_deleted, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_invoice ON orders(invoice_number)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_emp_date ON orders(employee_id, completed_at)`,
  `CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_log_emp_action ON audit_log(employee_id, action, created_at)`
];

module.exports = { schemaQueries };
