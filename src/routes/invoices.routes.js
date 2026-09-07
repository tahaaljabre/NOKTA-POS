const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { requireAuthenticated, requirePermission } = require('../middleware/auth.middleware');
router.use(requireAuthenticated);

router.get('/', requirePermission('view_invoices'), (req, res) => {
  const { date, employee_id, search, page, limit } = req.query;
  let sql = `SELECT o.*, t.number as table_number, t.name as table_name, c.name as customer_name FROM orders o LEFT JOIN "tables" t ON o.table_id=t.id LEFT JOIN customers c ON o.customer_id=c.id WHERE o.is_deleted=0 AND o.status IN ('completed','cancelled')`;
  const p = [];
  if (date) { const r=require("../services/business-time").range(date);sql += " AND julianday(COALESCE(o.completed_at,o.created_at))>=julianday(?) AND julianday(COALESCE(o.completed_at,o.created_at))<julianday(?)";p.push(r.start,r.end); }
  if (employee_id) { sql += ' AND o.employee_id=?'; p.push(employee_id); }
  if (search) { sql += ' AND o.invoice_number=?'; p.push(parseInt(search)); }
  const total = db.prepare('SELECT COUNT(*) total FROM ('+sql+')').get(...p);
  sql += ' ORDER BY o.invoice_number DESC';
  
  const lim = Math.max(1,Math.min(200,parseInt(limit)||100));
  const off = (Math.max(1,parseInt(page)||1)-1)*lim;
  sql += ` LIMIT ${lim} OFFSET ${off}`;
  
  const rows = db.prepare(sql).all(...p);
  res.json({ orders: rows, total: total ? total.total : 0 });
});

module.exports = router;
