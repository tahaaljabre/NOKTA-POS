const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { logAudit } = require('../middleware/audit.middleware');
const { requireAuthenticated, requirePermission } = require('../middleware/auth.middleware');
router.use(requireAuthenticated);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM modifiers WHERE active=1 ORDER BY group_name, sort_order, id').all();
  res.json(rows);
});

router.get('/item/:itemId', (req, res) => {
  const sql = `
    SELECT m.* 
    FROM modifiers m
    JOIN item_modifiers im ON m.id = im.modifier_id
    WHERE im.item_id = ? AND m.active = 1
    ORDER BY m.group_name, m.sort_order
  `;
  const rows = db.prepare(sql).all(req.params.itemId);
  res.json(rows);
});

router.post('/', requirePermission('menu'), (req, res) => {
  const { group_name, group_name_en, name, name_en, price_extra, is_required, is_multiple, sort_order } = req.body;
  const info = db.prepare(`
    INSERT INTO modifiers (group_name, group_name_en, name, name_en, price_extra, is_required, is_multiple, sort_order, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    group_name || 'General', group_name_en || '', name, name_en || '', price_extra || 0, is_required || 0, is_multiple || 0, sort_order || 0
  );
  logAudit(req.headers['x-employee-id'], req.headers['x-employee-name'], 'create', 'modifier', info.lastInsertRowid, `Created modifier: ${name}`);
  res.json({ id: info.lastInsertRowid });
});

router.post('/assign', requirePermission('menu'), (req, res) => {
  const { item_id, modifier_ids } = req.body;
  if (!item_id) return res.status(400).json({ error: 'item_id required' });

  if(!Array.isArray(modifier_ids)||new Set(modifier_ids).size!==modifier_ids.length||!db.prepare('SELECT id FROM items WHERE id=?').get(item_id)||modifier_ids.some(id=>!db.prepare('SELECT id FROM modifiers WHERE id=? AND active=1').get(id)))return res.status(400).json({error:'ربط إضافات غير صالح / Invalid modifier assignment'});
  db.transaction(()=>{
  db.prepare('DELETE FROM item_modifiers WHERE item_id=?').run(item_id);
  if (Array.isArray(modifier_ids)) {
    for (const modId of modifier_ids) {
      db.prepare('INSERT INTO item_modifiers (item_id, modifier_id) VALUES (?, ?)').run(item_id, modId);
    }
  }
  db.prepare('UPDATE items SET has_modifiers=? WHERE id=?').run((modifier_ids && modifier_ids.length > 0) ? 1 : 0, item_id);
  })();
  res.json({ ok: true });
});

router.delete('/:id', requirePermission('menu'), (req, res) => {
  db.prepare('UPDATE modifiers SET active=0 WHERE id=?').run(req.params.id);
  db.prepare('DELETE FROM item_modifiers WHERE modifier_id=?').run(req.params.id);
  logAudit(req.headers['x-employee-id'], req.headers['x-employee-name'], 'delete', 'modifier', req.params.id, `Deactivated modifier #${req.params.id}`);
  res.json({ ok: true });
});

module.exports = router;
