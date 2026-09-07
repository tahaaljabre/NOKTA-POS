const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { logAudit } = require('../middleware/audit.middleware');
const { requireAuthenticated, requirePermission } = require('../middleware/auth.middleware');
router.use(requireAuthenticated);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM categories WHERE active=1 OR active IS NULL ORDER BY sort_order, id').all();
  res.json(rows);
});

router.post('/', requirePermission('menu'), (req, res) => {
  const { name, name_en, icon, sort_order, attributes } = req.body || {};
  const cleanName = String(name || '').trim();
  if (!cleanName) return res.status(400).json({ error: 'Category name is required' });
  const attrStr = typeof attributes === 'object' ? JSON.stringify(attributes) : (attributes || '{}');
  const info = db.prepare('INSERT INTO categories (name, name_en, icon, sort_order, attributes) VALUES (?, ?, ?, ?, ?)').run(
    cleanName, String(name_en || '').trim(), icon || '', Number(sort_order) || 0, attrStr
  );
  const category = db.prepare('SELECT * FROM categories WHERE id=?').get(info.lastInsertRowid);
  logAudit(req.currentUser.id, req.currentUser.name, 'create', 'category', info.lastInsertRowid, `Created: ${cleanName}`);
  res.status(201).json(category);
});

router.put('/:id', requirePermission('menu'), (req, res) => {
  const { name, name_en, icon, sort_order, active, attributes } = req.body;
  if (name !== undefined && !String(name).trim()) return res.status(400).json({ error: 'Category name is required' });
  const attrStr = attributes !== undefined ? (typeof attributes === 'object' ? JSON.stringify(attributes) : attributes) : null;
  db.prepare(`
    UPDATE categories 
    SET name=COALESCE(?, name), 
        name_en=COALESCE(?, name_en), 
        icon=COALESCE(?, icon), 
        sort_order=COALESCE(?, sort_order),
        active=COALESCE(?, active),
        attributes=COALESCE(?, attributes)
    WHERE id=?
  `).run(name, name_en, icon, sort_order, active, attrStr, req.params.id);
  
  const category = db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  logAudit(req.currentUser.id, req.currentUser.name, 'update', 'category', req.params.id, `Updated: ${name || req.params.id}`);
  res.json(category);
});

router.delete('/:id', requirePermission('menu'), (req, res) => {
  db.prepare('UPDATE categories SET active=0 WHERE id=?').run(req.params.id);
  logAudit(req.headers['x-employee-id'], req.headers['x-employee-name'], 'delete', 'category', req.params.id, `Deactivated category #${req.params.id}`);
  res.json({ ok: true });
});

module.exports = router;
