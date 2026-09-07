const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { logAudit } = require('../middleware/audit.middleware');
const { requireAuthenticated, requirePermission } = require('../middleware/auth.middleware');
router.use(requireAuthenticated);

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT t.*, z.name as zone_name, z.name_en as zone_name_en 
    FROM "tables" t 
    LEFT JOIN table_zones z ON t.zone_id = z.id 
    ORDER BY t.number
  `).all();
  res.json(rows);
});

router.post('/', requirePermission('tables'), (req, res) => {
  const { number, name, capacity, zone_id, attributes } = req.body;
  const attrStr = typeof attributes === 'object' ? JSON.stringify(attributes) : (attributes || '{}');
  const info = db.prepare('INSERT INTO "tables" (number, name, capacity, zone_id, status, attributes) VALUES (?, ?, ?, ?, \'empty\', ?)').run(
    number, name || '', capacity || 4, zone_id || null, attrStr
  );
  logAudit(req.headers['x-employee-id'], req.headers['x-employee-name'], 'create', 'table', info.lastInsertRowid, `Created Table #${number}`);
  res.json({ id: info.lastInsertRowid });
});

router.put('/:id', requirePermission('tables'), (req, res) => {
  const { number, name, capacity, status, zone_id, current_order_id, attributes } = req.body;
  if(status!==undefined || current_order_id!==undefined) return res.status(400).json({error:'حالة الطاولة تُدار من الطلب / Table state is managed by orders'});
  const attrStr = attributes !== undefined ? (typeof attributes === 'object' ? JSON.stringify(attributes) : attributes) : null;
  db.prepare(`
    UPDATE "tables" 
    SET number=COALESCE(?, number),
        name=COALESCE(?, name),
        capacity=COALESCE(?, capacity),
        status=COALESCE(?, status),
        zone_id=COALESCE(?, zone_id),
        current_order_id=COALESCE(?, current_order_id),
        attributes=COALESCE(?, attributes)
    WHERE id=?
  `).run(number, name, capacity, status, zone_id, current_order_id, attrStr, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', requirePermission('tables'), (req, res) => {
  if(db.prepare("SELECT id FROM orders WHERE table_id=? AND status='active' AND is_deleted=0").get(req.params.id))return res.status(409).json({error:'الطاولة لها طلب نشط / Table has an active order'});
  db.prepare('DELETE FROM "tables" WHERE id=?').run(req.params.id);
  logAudit(req.headers['x-employee-id'], req.headers['x-employee-name'], 'delete', 'table', req.params.id, `Deleted table #${req.params.id}`);
  res.json({ ok: true });
});

module.exports = router;
