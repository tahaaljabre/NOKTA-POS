const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { logAudit } = require('../middleware/audit.middleware');
const { requireAuthenticated } = require('../middleware/auth.middleware');
router.use(requireAuthenticated);

router.get('/current', (req, res) => {
  const empId = req.currentUser.id;
  let sql = "SELECT * FROM shifts WHERE status='open'";
  const p = [];
  if (empId) {
    sql += ' AND employee_id=?';
    p.push(empId);
  }
  sql += ' ORDER BY id DESC LIMIT 1';
  const shift = db.prepare(sql).get(...p);
  res.json(shift || null);
});

router.post('/open', (req, res) => {
  const { opening_cash, notes } = req.body;
  const empId = req.currentUser.id;
  const empName = req.currentUser.name;

  const existing = db.prepare("SELECT id FROM shifts WHERE employee_id=? AND status='open'").get(empId);
  if (existing) {
    return res.status(400).json({ error: 'Shift already open', shift_id: existing.id });
  }

  const info = db.prepare(`
    INSERT INTO shifts (employee_id, employee_name, opening_cash, status, notes)
    VALUES (?, ?, ?, 'open', ?)
  `).run(empId, empName, parseFloat(opening_cash) || 0, notes || '');

  logAudit(empId, empName, 'open_shift', 'shift', info.lastInsertRowid, `Opened shift with cash: ${opening_cash || 0}`);
  res.json({ id: info.lastInsertRowid });
});

router.post('/:id/close', (req, res) => {
  const { closing_cash, notes } = req.body;
  const shift = db.prepare('SELECT * FROM shifts WHERE id=?').get(req.params.id);
  if (!shift) return res.status(404).json({ error: 'Shift not found' });
  if (req.currentUser.role !== 'admin' && shift.employee_id !== req.currentUser.id) return res.status(403).json({ error: 'You can only close your own shift' });

  if(shift.status!=='open') return res.status(409).json({error:'الوردية مغلقة بالفعل / Shift already closed'});
  // Compute sales during shift
  const sales = db.prepare(`
    SELECT COUNT(*) as count, SUM(total) as revenue,
           SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END) as cash_sales
    FROM orders 
    WHERE employee_id=? AND (shift_id=? OR (shift_id IS NULL AND julianday(completed_at)>=julianday(?))) AND julianday(completed_at)<=julianday('now') AND status='completed' AND is_deleted=0
  `).get(shift.employee_id, shift.id, shift.opened_at);

  const totalSales = sales ? (sales.revenue || 0) : 0;
  const cashSales = sales ? (sales.cash_sales || 0) : 0;
  const expectedCash = (shift.opening_cash || 0) + cashSales;
  const actualCash = parseFloat(closing_cash) || 0;
  const diff = actualCash - expectedCash;

  db.prepare(`
    UPDATE shifts 
    SET closing_cash=?, expected_cash=?, cash_difference=?, total_sales=?, total_orders=?, status='closed', closed_at=datetime('now'), notes=?
    WHERE id=?
  `).run(actualCash, expectedCash, diff, totalSales, sales ? sales.count : 0, notes || '', req.params.id);

  logAudit(shift.employee_id, shift.employee_name, 'close_shift', 'shift', req.params.id, `Closed shift. Cash diff: ${diff}`);
  res.json({ ok: true, expected_cash: expectedCash, closing_cash: actualCash, cash_difference: diff, total_sales: totalSales });
});

module.exports = router;
