// Flexible & Extensible Database Schema Definitions - Index definitions.
const schemaQueries = [
  // 19. Performance Indexes for High-Speed Queries across Multi-Stations
  `CREATE INDEX IF NOT EXISTS idx_items_cat_active ON items(category_id, active, sort_order)`,
  `CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, is_deleted, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_invoice ON orders(invoice_number)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_cashier_code ON orders(cashier_code)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_emp_date ON orders(employee_id, completed_at)`,
  `CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_log_emp_action ON audit_log(employee_id, action, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(attendance_date, hr_employee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_hr_employees_active ON hr_employees(active, employee_code)`
];
module.exports = { schemaQueries };
