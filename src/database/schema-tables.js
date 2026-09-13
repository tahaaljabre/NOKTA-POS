// Flexible & Extensible Database Schema Definitions - Table definitions grouped by domain.
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
    max_discount REAL DEFAULT 100,
    cashier_code TEXT DEFAULT '',
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
    is_deleted INTEGER DEFAULT 0,
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
    counted_cash REAL,
    total_revenue REAL DEFAULT 0,
    cash_total REAL DEFAULT 0,
    promptpay_total REAL DEFAULT 0,
    card_total REAL DEFAULT 0,
    truemoney_total REAL DEFAULT 0,
    platform_total REAL DEFAULT 0,
    platform_breakdown TEXT DEFAULT '{}',
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

  // 20. HR employees are separate from POS cashier accounts.
  `CREATE TABLE IF NOT EXISTS hr_employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    department TEXT DEFAULT '',
    job_title TEXT DEFAULT '',
    employment_type TEXT DEFAULT 'full_time',
    active INTEGER DEFAULT 1,
    hire_date TEXT,
    attributes TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 21. Attendance events imported from manual entry or biometric devices.
  `CREATE TABLE IF NOT EXISTS attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hr_employee_id INTEGER NOT NULL,
    attendance_date TEXT NOT NULL,
    check_in TEXT,
    check_out TEXT,
    status TEXT DEFAULT 'present',
    source TEXT DEFAULT 'manual',
    device_id INTEGER,
    note TEXT DEFAULT '',
    approved_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hr_employee_id, attendance_date)
  )`,

  // 22. Registered biometric devices; templates remain on the device/provider.
  `CREATE TABLE IF NOT EXISTS biometric_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    host TEXT DEFAULT '',
    port INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    last_sync_at DATETIME,
    attributes TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 23. Cashier stations and ownership boundary for shifts/reports.
  `CREATE TABLE IF NOT EXISTS cashiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    attributes TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // ==================== SUPPLIERS MANAGEMENT (إدارة الموردين) ====================
  // 24. Suppliers - بيانات الموردين الأساسية
  `CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    company_name TEXT DEFAULT '',
    company_name_en TEXT DEFAULT '',
    tax_number TEXT DEFAULT '',
    commercial_registration TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    country TEXT DEFAULT 'Saudi Arabia',
    payment_terms INTEGER DEFAULT 30,
    credit_limit REAL DEFAULT 0,
    opening_balance REAL DEFAULT 0,
    current_balance REAL DEFAULT 0,
    total_purchases REAL DEFAULT 0,
    total_payments REAL DEFAULT 0,
    category TEXT DEFAULT 'general',
    contact_person TEXT DEFAULT '',
    contact_phone TEXT DEFAULT '',
    bank_name TEXT DEFAULT '',
    bank_account TEXT DEFAULT '',
    iban TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    cashier_id INTEGER REFERENCES cashiers(id),
    FOREIGN KEY(created_by) REFERENCES employees(id)
  )`,

  // 25. Supplier Transactions - حركات الموردين (مشتريات وسندات)
  `CREATE TABLE IF NOT EXISTS supplier_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    transaction_type TEXT NOT NULL,
    transaction_number TEXT UNIQUE NOT NULL,
    transaction_date TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'credit',
    reference_number TEXT DEFAULT '',
    description TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    invoice_date TEXT,
    due_date TEXT,
    status TEXT DEFAULT 'pending',
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES employees(id)
  )`,

  // 26. Supplier Purchases - فواتير المشتريات التفصيلية
  `CREATE TABLE IF NOT EXISTS supplier_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    purchase_number TEXT UNIQUE NOT NULL,
    purchase_date TEXT NOT NULL,
    invoice_number TEXT DEFAULT '',
    delivery_date TEXT,
    warehouse TEXT DEFAULT 'main',
    subtotal REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    shipping_cost REAL DEFAULT 0,
    total_amount REAL NOT NULL,
    paid_amount REAL DEFAULT 0,
    remaining_amount REAL DEFAULT 0,
    payment_status TEXT DEFAULT 'pending',
    items_json TEXT DEFAULT '[]',
    notes TEXT DEFAULT '',
    approved_by INTEGER,
    approved_at DATETIME,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES employees(id),
    FOREIGN KEY(approved_by) REFERENCES employees(id)
  )`,

  // 27. Supplier Payments - سندات الصرف للموردين
  `CREATE TABLE IF NOT EXISTS supplier_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    payment_number TEXT UNIQUE NOT NULL,
    payment_date TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    check_number TEXT DEFAULT '',
    bank_name TEXT DEFAULT '',
    reference_number TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    received_by TEXT DEFAULT '',
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES employees(id)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_supplier_transactions_supplier ON supplier_transactions(supplier_id)`,
  `CREATE INDEX IF NOT EXISTS idx_supplier_transactions_date ON supplier_transactions(transaction_date)`,
  `CREATE INDEX IF NOT EXISTS idx_supplier_purchases_supplier ON supplier_purchases(supplier_id)`,
  `CREATE INDEX IF NOT EXISTS idx_supplier_purchases_date ON supplier_purchases(purchase_date)`,
  `CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id)`,
  `CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON supplier_payments(payment_date)`,

  `CREATE TABLE IF NOT EXISTS shop_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_date TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'purchase',
    amount REAL NOT NULL CHECK(amount > 0),
    payment_method TEXT NOT NULL DEFAULT 'cash',
    cashier_id INTEGER NOT NULL REFERENCES cashiers(id),
    cashier_code TEXT NOT NULL,
    cashier_name TEXT NOT NULL,
    payee TEXT DEFAULT '',
    reference_number TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_by INTEGER NOT NULL REFERENCES employees(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_shop_expenses_date ON shop_expenses(expense_date)`,
  `CREATE INDEX IF NOT EXISTS idx_shop_expenses_cashier ON shop_expenses(cashier_id, expense_date)`,

  `CREATE INDEX IF NOT EXISTS idx_shifts_cashier_code ON shifts(cashier_code)`
];
module.exports = { schemaQueries };
