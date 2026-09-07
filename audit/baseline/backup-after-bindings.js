const express = require("express");
const router = express.Router();
const { db } = require("../database/db");
const { requirePermission } = require("../middleware/auth.middleware");

// GET /api/backup/export?type=orders|all
router.get("/export", requirePermission("settings"), (req, res) => {
  try {
    const type = req.query.type || "all";
    const exportedAt = new Date().toISOString();

    const orders = db.prepare("SELECT * FROM orders WHERE is_deleted=0 ORDER BY id").all();
    const orderItems = db.prepare("SELECT * FROM order_items").all();

    if (type === "orders") {
      return res.json({ exported_at: exportedAt, type: "orders", orders, order_items: orderItems });
    }

    const items = db.prepare("SELECT * FROM items").all();
    const categories = db.prepare("SELECT * FROM categories").all();
    const employees = db.prepare("SELECT id, name, name_en, role, permissions, phone, default_floor, default_station, active, attributes, created_at FROM employees").all();
    const tables = db.prepare(`SELECT * FROM "tables"`).all();
    const settings = db.prepare("SELECT * FROM settings").all();
    const customers = db.prepare("SELECT * FROM customers").all();

    res.json({
      exported_at: exportedAt,
      type: "full",
      orders,
      order_items: orderItems,
      items,
      categories,
      employees,
      tables,
      settings,
      customers
    });
  } catch (err) {
    console.error("Backup export error:", err);
    res.status(500).json({ error: "Export failed: " + err.message });
  }
});

// POST /api/backup/restore
router.post("/restore", requirePermission("settings"), (req, res) => {
  try {
    const data = req.body;
    if (!data || !['orders', 'full'].includes(data.type) || !Array.isArray(data.orders)) return res.status(400).json({ error: "Invalid backup file" });
    if (data.orders.length > 50000) return res.status(400).json({ error: "Backup is too large" });

    if (Array.isArray(data.orders)) {
      const insertOrder = db.prepare(`
        INSERT OR REPLACE INTO orders
        (id, invoice_number, table_id, customer_id, type, status, total, discount_percent, discount_amount,
         payment_method, note, employee_id, employee_name, attributes, station_id, floor, offline_id,
         completed_at, created_at, is_deleted, paid_amount, change_amount)
        VALUES (@id, @invoice_number, @table_id, @customer_id, @type, @status, @total, @discount_percent,
         @discount_amount, @payment_method, @note, @employee_id, @employee_name, @attributes,
         @station_id, @floor, @offline_id, @completed_at, @created_at, @is_deleted, @paid_amount, @change_amount)
      `);
      const insertItem = db.prepare(`
        INSERT OR REPLACE INTO order_items (id, order_id, item_id, quantity, price, cost_price, discount_amount, note, selected_modifiers, attributes, created_at)
        VALUES (@id, @order_id, @item_id, @quantity, @price, @cost_price, @discount_amount, @note, @selected_modifiers, @attributes, @created_at)
      `);
      db.transaction(() => {
        db.prepare("DELETE FROM order_items").run();
        db.prepare("DELETE FROM orders").run();
        data.orders.forEach(o => insertOrder.run(o));
        if (Array.isArray(data.order_items)) data.order_items.forEach(i => insertItem.run(i));
      })();
    }

    if (data.type === "full") {
      if (Array.isArray(data.items) && data.items.length > 0) {
        db.prepare("DELETE FROM items").run();
        const ins = db.prepare("INSERT OR REPLACE INTO items (id, category_id, name, name_en, price, price2, image, sort_order, active) VALUES (@id, @category_id, @name, @name_en, @price, @price2, @image, @sort_order, @active)");
        data.items.forEach(i => ins.run(i));
      }
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        db.prepare("DELETE FROM categories").run();
        const ins = db.prepare("INSERT OR REPLACE INTO categories (id, name, name_en, icon, sort_order, active) VALUES (@id, @name, @name_en, @icon, @sort_order, @active)");
        data.categories.forEach(c => ins.run(c));
      }
      if (Array.isArray(data.settings) && data.settings.length > 0) {
        const ins = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)");
        data.settings.forEach(s => ins.run(s));
      }
      if (Array.isArray(data.customers) && data.customers.length > 0) {
        const ins = db.prepare("INSERT OR REPLACE INTO customers (id, name, phone, email, address, delivery_notes, points, total_spent, total_orders, attributes, created_at) VALUES (@id, @name, @phone, @email, @address, @delivery_notes, @points, @total_spent, @total_orders, @attributes, @created_at)");
        data.customers.forEach(c => ins.run(c));
      }
    }

    res.json({ success: true, message: "Restore completed successfully" });
  } catch (err) {
    console.error("Backup restore error:", err);
    res.status(500).json({ error: "Restore failed: " + err.message });
  }
});

module.exports = router;
