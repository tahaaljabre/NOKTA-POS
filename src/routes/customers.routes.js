const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { logAudit } = require('../middleware/audit.middleware');
const { requireAuthenticated, requirePermission } = require('../middleware/auth.middleware');
router.use(requireAuthenticated);

router.get('/', (req, res) => {
  const { search } = req.query;
  let sql = 'SELECT * FROM customers WHERE 1=1';
  const p = [];
  if (search) {
    sql += ' AND (name LIKE ? OR phone LIKE ?)';
    p.push(`%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY id DESC LIMIT 100';
  res.json(db.prepare(sql).all(...p));
});

router.get('/phone/:phone', (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE phone=?').get(req.params.phone);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json(customer);
});

router.post('/', requirePermission('customers'), (req, res) => {
  const { name, phone, email, address, delivery_notes, attributes } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and Phone required' });

  const existing = db.prepare('SELECT id FROM customers WHERE phone=?').get(phone);
  if (existing) {
    return res.status(400).json({ error: 'Customer with this phone already exists', id: existing.id });
  }

  const attrStr = typeof attributes === 'object' ? JSON.stringify(attributes) : (attributes || '{}');
  const info = db.prepare(`
    INSERT INTO customers (name, phone, email, address, delivery_notes, attributes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, phone, email || '', address || '', delivery_notes || '', attrStr);

  logAudit(req.headers['x-employee-id'], req.headers['x-employee-name'], 'create', 'customer', info.lastInsertRowid, `Created Customer: ${name} (${phone})`);
  res.json({ id: info.lastInsertRowid });
});

router.put('/:id', requirePermission('customers'), (req, res) => {
  const { name, phone, email, address, delivery_notes, attributes } = req.body;
  const attrStr = attributes !== undefined ? (typeof attributes === 'object' ? JSON.stringify(attributes) : attributes) : null;
  db.prepare(`
    UPDATE customers
    SET name=COALESCE(?, name),
        phone=COALESCE(?, phone),
        email=COALESCE(?, email),
        address=COALESCE(?, address),
        delivery_notes=COALESCE(?, delivery_notes),
        attributes=COALESCE(?, attributes)
    WHERE id=?
  `).run(name, phone, email, address, delivery_notes, attrStr, req.params.id);

  res.json({ ok: true });
});

module.exports = router;
