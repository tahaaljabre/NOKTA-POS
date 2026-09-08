const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { logAudit } = require('../middleware/audit.middleware');
const { requireAuthenticated, requirePermission } = require('../middleware/auth.middleware');
router.use(requireAuthenticated);

router.get('/', (req, res) => {
  const { category_id } = req.query;
  let sql = 'SELECT i.*, c.name as category_name, c.name_en as category_name_en FROM items i LEFT JOIN categories c ON i.category_id=c.id WHERE i.active=1';
  const p = [];
  if (category_id) {
    sql += ' AND i.category_id=?';
    p.push(category_id);
  }
  sql += ' ORDER BY c.sort_order, i.sort_order, i.id';
  res.json(db.prepare(sql).all(...p));
});

router.get('/all', (req, res) => {
  const sql = 'SELECT i.*, c.name as category_name, c.name_en as category_name_en FROM items i LEFT JOIN categories c ON i.category_id=c.id ORDER BY i.id';
  res.json(db.prepare(sql).all());
});

router.post('/', requirePermission('menu'), (req, res) => {
  const { name, name_en, category_id, price, price2, cost_price, image, barcode, sku, sort_order, has_modifiers, attributes } = req.body;
  const cleanPrice = Number(price);
  const cleanPrice2 = price2 === null || price2 === undefined || price2 === '' ? null : Number(price2);
  if (!name || !Number.isFinite(cleanPrice) || cleanPrice < 0 || (cleanPrice2 !== null && (!Number.isFinite(cleanPrice2) || cleanPrice2 < 0))) {
    return res.status(400).json({ error: 'Name and valid non-negative prices are required' });
  }
  const roundedPrice = Math.round(cleanPrice * 100) / 100;
  const roundedPrice2 = cleanPrice2 === null ? null : Math.round(cleanPrice2 * 100) / 100;
  const attrStr = typeof attributes === 'object' ? JSON.stringify(attributes) : (attributes || '{}');
  const info = db.prepare(`
    INSERT INTO items (name, name_en, category_id, price, price2, cost_price, image, barcode, sku, sort_order, has_modifiers, attributes, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    String(name).trim(), name_en || '', category_id, roundedPrice, roundedPrice2, cost_price || 0, image || '', barcode || '', sku || '', sort_order || 0, has_modifiers || 0, attrStr
  );
  const created = db.prepare('SELECT id,name,name_en,category_id,price,price2,active,sort_order FROM items WHERE id=?').get(info.lastInsertRowid);
  logAudit(req.currentUser.id, req.currentUser.name, 'create', 'item', info.lastInsertRowid, `Created: ${name}`, '', created);
  res.json({ id: info.lastInsertRowid });
});

router.put('/:id', requirePermission('menu'), (req, res) => {
  const { name, name_en, category_id, price, price2, cost_price, image, barcode, sku, sort_order, active, has_modifiers, attributes } = req.body;
  const cleanPrice = price === undefined || price === null || price === '' ? null : Number(price);
  const cleanPrice2 = price2 === undefined || price2 === null || price2 === '' ? null : Number(price2);
  if ((cleanPrice !== null && (!Number.isFinite(cleanPrice) || cleanPrice < 0)) || (cleanPrice2 !== null && (!Number.isFinite(cleanPrice2) || cleanPrice2 < 0))) {
    return res.status(400).json({ error: 'Prices must be non-negative numbers' });
  }
  const roundedPrice = cleanPrice === null ? null : Math.round(cleanPrice * 100) / 100;
  const roundedPrice2 = cleanPrice2 === null ? null : Math.round(cleanPrice2 * 100) / 100;
  const attrStr = attributes !== undefined ? (typeof attributes === 'object' ? JSON.stringify(attributes) : attributes) : null;
  const before = db.prepare('SELECT id,name,name_en,category_id,price,price2,active,sort_order FROM items WHERE id=?').get(req.params.id);
  if (!before) return res.status(404).json({ error: 'Item not found' });
  db.prepare(`
    UPDATE items 
    SET name=COALESCE(?, name),
        name_en=COALESCE(?, name_en),
        category_id=COALESCE(?, category_id),
        price=COALESCE(?, price),
        price2=COALESCE(?, price2),
        cost_price=COALESCE(?, cost_price),
        image=COALESCE(?, image),
        barcode=COALESCE(?, barcode),
        sku=COALESCE(?, sku),
        sort_order=COALESCE(?, sort_order),
        active=COALESCE(?, active),
        has_modifiers=COALESCE(?, has_modifiers),
        attributes=COALESCE(?, attributes)
    WHERE id=?
  `).run(name, name_en, category_id, roundedPrice, roundedPrice2, cost_price, image, barcode, sku, sort_order, active, has_modifiers, attrStr, req.params.id);
  
  const after = db.prepare('SELECT id,name,name_en,category_id,price,price2,active,sort_order FROM items WHERE id=?').get(req.params.id);
  logAudit(req.currentUser.id, req.currentUser.name, 'update', 'item', req.params.id, `Updated: ${name || req.params.id}`, before, after);
  res.json({ ok: true });
});

router.delete('/:id', requirePermission('menu'), (req, res) => {
  const before = db.prepare('SELECT id,name,name_en,category_id,price,price2,active,sort_order FROM items WHERE id=?').get(req.params.id);
  db.prepare('UPDATE items SET active=0 WHERE id=?').run(req.params.id);
  const after = db.prepare('SELECT id,name,name_en,category_id,price,price2,active,sort_order FROM items WHERE id=?').get(req.params.id);
  logAudit(req.currentUser.id, req.currentUser.name, 'delete', 'item', req.params.id, `Deactivated item #${req.params.id}`, before, after);
  res.json({ ok: true });
});

module.exports = router;
