const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { logAudit } = require('../middleware/audit.middleware');
const { requirePermission } = require('../middleware/auth.middleware');
const { requireAuthenticated } = require('../middleware/auth.middleware');
const {number,error,text} = require('../services/orders.service');
router.use(requireAuthenticated);

router.get('/', requirePermission('inventory'), (req, res) => {
  const rows = db.prepare(`
    SELECT inv.*, i.name as menu_item_name, i.price as menu_item_price
    FROM inventory inv
    LEFT JOIN items i ON inv.item_id = i.id
    ORDER BY inv.id DESC
  `).all();
  res.json(rows);
});

router.get('/alerts', requirePermission('inventory'), (req, res) => {
  const rows = db.prepare('SELECT * FROM inventory WHERE quantity <= min_alert_level').all();
  res.json(rows);
});

router.post('/', requirePermission('inventory'), (req, res) => {
  const { item_id, item_name, quantity, unit, min_alert_level, cost_unit } = req.body;
  if(item_id && !db.prepare('SELECT id FROM items WHERE id=?').get(item_id)) throw error('الصنف غير موجود / Item not found');
  const safeQty=number(quantity??0,'quantity'),safeAlert=number(min_alert_level??5,'alert'),safeCost=number(cost_unit??0,'cost');
  const safeName=text(item_name,200).trim();if(!safeName)throw error('اسم المخزون مطلوب / Stock name required');
  const info = db.prepare(`
    INSERT INTO inventory (item_id, item_name, quantity, unit, min_alert_level, cost_unit, last_restocked_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(item_id || null, safeName, safeQty, text(unit||'pcs',30), safeAlert, safeCost);

  logAudit(req.headers['x-employee-id'], req.headers['x-employee-name'], 'create', 'inventory', info.lastInsertRowid, `Added Stock: ${item_name} (${quantity} ${unit || 'pcs'})`);
  res.json({ id: info.lastInsertRowid });
});

router.post('/:id/adjust', requirePermission('inventory'), (req, res) => {
  const { quantity_change, type, notes } = req.body;
  const inv = db.prepare('SELECT * FROM inventory WHERE id=?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Inventory record not found' });

  const prevQty = parseFloat(inv.quantity) || 0;
  const change = number(quantity_change, 'stock change', -1000000, 1000000);
  const newQty = prevQty + change;
  if(newQty<0) throw error('المخزون لا يقبل قيمة سالبة / Stock cannot be negative');

  db.transaction(()=>{
  db.prepare('UPDATE inventory SET quantity=?, last_restocked_at=datetime(\'now\') WHERE id=?').run(newQty, req.params.id);
  db.prepare('INSERT INTO stock_logs (inventory_id, type, quantity, previous_qty, new_qty, employee_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    req.params.id, type || 'adjustment', change, prevQty, newQty, req.headers['x-employee-id'] || null, notes || ''
  );
  logAudit(req.currentUser.id,req.currentUser.name,'adjust','inventory',inv.id,text(notes),prevQty,newQty);
  })();

  res.json({ ok: true, previous_qty: prevQty, new_qty: newQty });
});

router.get('/:id/logs', requirePermission('inventory'), (req,res)=>{
  if(!db.prepare('SELECT id FROM inventory WHERE id=?').get(req.params.id)) throw error('السجل غير موجود / Inventory not found',404);
  res.json(db.prepare('SELECT * FROM stock_logs WHERE inventory_id=? ORDER BY id DESC LIMIT 200').all(req.params.id));
});

module.exports = router;
