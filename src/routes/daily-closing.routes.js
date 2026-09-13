const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { logAudit } = require('../middleware/audit.middleware');
const { getRequesterInfo, requireAdmin } = require('../middleware/auth.middleware');
const { requireAuthenticated } = require('../middleware/auth.middleware');
const config = require('../config/app.config');
const path = require('path');
const { createDatabaseBackup } = require('../services/automatic-backup');
router.use(requireAuthenticated);
const {dayOf,range,validDay}=require('../services/business-time');
const { platformBreakdown } = require('../services/delivery-closing');
const { forDay: shopExpensesForDay } = require('../services/expenses.service');

router.post('/:id/approve', (req, res) => {
  if (req.currentUser.role !== 'admin') return res.status(403).json({ error: 'للمدير فقط / Administrator only' });
  const row = db.prepare('SELECT * FROM daily_closings WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'الإغلاق غير موجود / Closing not found' });
  db.prepare("UPDATE daily_closings SET approved_by=?, approved_at=datetime('now') WHERE id=?").run(req.currentUser.id, row.id);
  logAudit(req.currentUser.id, req.currentUser.name, 'approve_closing', 'daily_closing', row.id, 'Approved daily closing');
  res.json({ ok: true });
});

router.post('/:id/reopen', (req, res) => {
  if (req.currentUser.role !== 'admin') return res.status(403).json({ error: 'للمدير فقط / Administrator only' });
  const row = db.prepare('SELECT id, employee_id, date FROM daily_closings WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'الإغلاق غير موجود / Closing not found' });
  db.prepare("UPDATE daily_closings SET is_closed=0, approved_by=NULL, approved_at=NULL, notes=COALESCE(notes,'') || ' | Reopened by manager' WHERE id=?").run(row.id);
  // Reopen the employee's corresponding shift so the cashier can correct it and close again.
  db.prepare("UPDATE shifts SET status='open', closed_at=NULL WHERE employee_id=? AND status='closed' AND date(?)=date(COALESCE(closed_at, opened_at))").run(row.employee_id, row.date);
  logAudit(req.currentUser.id, req.currentUser.name, 'reopen_closing', 'daily_closing', row.id, 'Reopened daily closing');
  res.json({ ok: true });
});

router.get('/', (req, res) => {
  const requester = getRequesterInfo(req);
  if (!requester) return res.status(401).json({ error: 'Unauthorized' });

  let { date, employee_id } = req.query;

  // Strict Data Isolation: If not admin and doesn't have daily_closing permission, can only view own closing
  if (requester.role !== 'admin' && !requester.permissions.daily_closing) {
    employee_id = requester.id;
  }

  let sql = 'SELECT d.*, e.cashier_code FROM daily_closings d LEFT JOIN employees e ON e.id=d.employee_id WHERE 1=1';
  const p = [];
  if (date) { sql += ' AND date=?'; p.push(date); }
  if (employee_id) { sql += ' AND employee_id=?'; p.push(employee_id); }
  sql += ' ORDER BY id DESC';
  res.json(db.prepare(sql).all(...p));
});

// Check if current employee has an active open shift today
router.get('/current-shift', (req, res) => {
  const requester = getRequesterInfo(req);
  if (!requester) return res.status(401).json({ error: 'Unauthorized' });

  const date = req.query.date || dayOf();
  validDay(date || dayOf());
  const empId = requester.id;

  const closing = db.prepare('SELECT * FROM daily_closings WHERE employee_id=? AND date=?').get(empId, date);
  const cashSupplierExpenses = db.prepare("SELECT COALESCE(SUM(amount),0) total FROM supplier_transactions WHERE transaction_type='payment' AND payment_method='cash' AND transaction_date=? AND created_by=?").get(date, empId).total;
  const cashShopExpenses = shopExpensesForDay(date, empId).cash;
  
  res.json({
    date,
    employee_id: empId,
    has_shift: !!closing,
    is_closed: closing ? (closing.is_closed === 1) : false,
    opening_cash: closing ? (closing.opening_cash || 0) : 0,
    cash_supplier_expenses: cashSupplierExpenses,
    cash_shop_expenses: cashShopExpenses,
    opened_at: closing ? closing.opened_at : null,
    closing_data: closing || null
  });
});

// Open / Start a shift for the employee with opening cash float
router.post('/open', requireAdmin, (req, res) => {
  const requester = getRequesterInfo(req);
  if (!requester) return res.status(401).json({ error: 'Unauthorized' });

  const { opening_cash, notes, date } = req.body;
  const d = date || dayOf();
  const empId = requester.id;
  const floatAmt = parseFloat(opening_cash) || 0;

  const existing = db.prepare('SELECT id, is_closed FROM daily_closings WHERE employee_id=? AND date=?').get([empId, d]);
  if (existing) {
    if (existing.is_closed === 1) {
      return res.status(400).json({ error: 'تم إغلاق وردية هذا اليوم مسبقاً لهذا الموظف.' });
    }
    // Update opening cash if already opened
    db.prepare('UPDATE daily_closings SET opening_cash=?, notes=? WHERE id=?').run([floatAmt, notes || '', existing.id]);
    logAudit(empId, requester.name, 'update_shift_opening', 'daily_closing', existing.id, `Updated shift opening cash for ${d}: ${floatAmt.toFixed(2)}`);
    return res.json({ ok: true, id: existing.id, opening_cash: floatAmt, date: d });
  }

  // Create new active shift
  const info = db.prepare(`
    INSERT INTO daily_closings (employee_id, employee_name, date, opening_cash, is_closed, opened_at, notes)
    VALUES (?, ?, ?, ?, 0, datetime(\'now\'), ?)
  `).run([empId, requester.name, d, floatAmt, notes || 'بدء الوردية واستلام الصندوق']);

  logAudit(empId, requester.name, 'open_shift', 'daily_closing', info.lastInsertRowid, `Opened Shift for ${d} with Float: ${floatAmt.toFixed(2)}`);
  res.json({ ok: true, id: info.lastInsertRowid, opening_cash: floatAmt, date: d });
});

router.post('/close', (req, res) => {
  const { employee_id, date, notes, close_all } = req.body;
  if (typeof notes === 'string' && notes.length > 1000) return res.status(400).json({ error: 'ملاحظات الإغلاق طويلة جداً / Closing notes are too long' });
  const countedCash = req.body.counted_cash === '' || req.body.counted_cash == null ? null : Number(req.body.counted_cash);
  if (countedCash !== null && (!Number.isFinite(countedCash) || countedCash < 0)) return res.status(400).json({ error: 'الجرد النقدي غير صحيح / Invalid cash count' });
  const d = date || dayOf();
  const requester = getRequesterInfo(req);

  // If close_all is requested by admin: close all open employees for the day
  if (close_all && requester.role === 'admin') {
    const activeEmployees = db.prepare(`
      SELECT DISTINCT 
        COALESCE(employee_id, 1) as employee_id, 
        COALESCE(NULLIF(employee_name, ''), 'المدير') as employee_name 
      FROM orders 
      WHERE (julianday(completed_at)>=julianday(?) AND julianday(completed_at)<julianday(?) AND status='completed' AND is_deleted=0)
    `).all(range(d).start, range(d).end);
    
    let grandTotalRevenue = 0, grandTotalOrders = 0, grandCash = 0, grandPromptpay = 0, grandCard = 0, grandTruemoney = 0, grandPlatform = 0;
    const grandApps = {};
    
    for (const emp of activeEmployees) {
      const orders = db.prepare(`
        SELECT * FROM orders 
        WHERE (employee_id=? OR (employee_id IS NULL AND ?=1)) 
          AND (julianday(completed_at)>=julianday(?) AND julianday(completed_at)<julianday(?) AND status='completed' AND is_deleted=0)
      `).all(emp.employee_id, emp.employee_id, range(d).start, range(d).end);
      
      const platform = platformBreakdown(orders);
      grandPlatform += platform.total;
      for (const [app, value] of Object.entries(platform.byApp)) grandApps[app] = Math.round(((grandApps[app] || 0) + value) * 100) / 100;
      let rev = 0, csh = 0, pp = 0, crd = 0, tm = 0;
      orders.forEach(o => {
        rev += o.total || 0;
        if (o.payment_method === 'cash') csh += o.total || 0;
        else if (o.payment_method === 'promptpay') pp += o.total || 0;
        else if (o.payment_method === 'card') crd += o.total || 0;
        else if (o.payment_method === 'truemoney') tm += o.total || 0;
      });
      rev = Math.round(rev * 100) / 100;
      csh = Math.round(csh * 100) / 100;
      pp = Math.round(pp * 100) / 100;
      crd = Math.round(crd * 100) / 100;
      tm = Math.round(tm * 100) / 100;

      grandTotalRevenue += rev;
      grandTotalRevenue = Math.round(grandTotalRevenue * 100) / 100;
      grandTotalOrders += orders.length;
      grandCash += csh;
      grandCash = Math.round(grandCash * 100) / 100;
      grandPromptpay += pp;
      grandPromptpay = Math.round(grandPromptpay * 100) / 100;
      grandCard += crd;
      grandCard = Math.round(grandCard * 100) / 100;
      grandTruemoney += tm;
      grandTruemoney = Math.round(grandTruemoney * 100) / 100;

      const existing = db.prepare('SELECT id FROM daily_closings WHERE employee_id=? AND date=?').get([emp.employee_id, d]);
      if (existing) {
        db.prepare(`
          UPDATE daily_closings 
          SET total_orders=?, total_revenue=?, cash_total=?, promptpay_total=?, card_total=?, truemoney_total=?, platform_total=?, platform_breakdown=?, is_closed=1, closed_at=datetime(\'now\'), notes=?
          WHERE id=?
        `).run([orders.length, rev, csh, pp, crd, tm, platform.total, JSON.stringify(platform.byApp), notes || 'إغلاق كلي عبر الإدارة', existing.id]);
      } else {
        db.prepare(`
          INSERT INTO daily_closings (employee_id, employee_name, date, total_orders, total_revenue, cash_total, promptpay_total, card_total, truemoney_total, platform_total, platform_breakdown, is_closed, closed_at, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime(\'now\'), ?)
        `).run([emp.employee_id, emp.employee_name, d, orders.length, rev, csh, pp, crd, tm, platform.total, JSON.stringify(platform.byApp), notes || 'إغلاق كلي عبر الإدارة']);
      }
    }

    logAudit(requester.id, requester.name, 'daily_closing_all', 'daily_closing', 0, `Grand Daily closing for ${d}: ${grandTotalOrders} orders, ${grandTotalRevenue.toFixed(2)}`);
    let backupFile = null;
    let backupError = null;
    if (config.dbPath !== ':memory:') {
      try {
        backupFile = createDatabaseBackup(
          db.getRawDb(),
          path.join(config.dbDir, 'backups', 'daily-closing'),
          { prefix: `nokta-pos-closing-${d}-` }
        );
        logAudit(requester.id, requester.name, 'backup_daily_closing', 'backup', 0, `Created full database backup after grand closing for ${d}`);
      } catch (error) {
        backupError = error.message;
        console.error('Daily closing backup failed:', error);
      }
    }
    return res.json({
      ok: true,
      is_grand: true,
      total_orders: grandTotalOrders,
      total_revenue: grandTotalRevenue,
      cash_total: grandCash,
      promptpay_total: grandPromptpay,
      card_total: grandCard,
      truemoney_total: grandTruemoney,
      platform_total: grandPlatform,
      platform_breakdown: grandApps,
      employee_count: activeEmployees.length,
      backup_created: config.dbPath === ':memory:' ? null : Boolean(backupFile),
      backup_file: backupFile ? path.basename(backupFile) : null,
      backup_error: backupError
    });
  }

  // Single employee closing
  const empId = employee_id || requester.id;
  if (requester.role !== 'admin' && Number(empId) !== requester.id) return res.status(403).json({ error: 'You can only close your own shift' });

  const emp = db.prepare('SELECT id, name FROM employees WHERE id=?').get(empId);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  // Calculate stats
  const orders = db.prepare("SELECT * FROM orders WHERE employee_id=? AND (julianday(completed_at)>=julianday(?) AND julianday(completed_at)<julianday(?) AND status='completed' AND is_deleted=0)").all(empId, range(d).start, range(d).end);
  const platform = platformBreakdown(orders);
  let totalRevenue = 0, cashTotal = 0, promptpayTotal = 0, cardTotal = 0, truemoneyTotal = 0;
  orders.forEach(o => {
    totalRevenue += o.total || 0;
    if (o.payment_method === 'cash') cashTotal += o.total || 0;
    else if (o.payment_method === 'promptpay') promptpayTotal += o.total || 0;
    else if (o.payment_method === 'card') cardTotal += o.total || 0;
    else if (o.payment_method === 'truemoney') truemoneyTotal += o.total || 0;
  });
  totalRevenue = Math.round(totalRevenue * 100) / 100;
  cashTotal = Math.round(cashTotal * 100) / 100;
  promptpayTotal = Math.round(promptpayTotal * 100) / 100;
  cardTotal = Math.round(cardTotal * 100) / 100;
  truemoneyTotal = Math.round(truemoneyTotal * 100) / 100;

  const existing = db.prepare('SELECT id FROM daily_closings WHERE employee_id=? AND date=? AND is_closed=1').get(empId, d);
  if (existing) return res.status(400).json({ error: 'Already closed today' });

  const existingOpen = db.prepare('SELECT id FROM daily_closings WHERE employee_id=? AND date=?').get(empId, d);
  if (existingOpen) {
    db.prepare(`
      UPDATE daily_closings 
      SET total_orders=?, total_revenue=?, cash_total=?, promptpay_total=?, card_total=?, truemoney_total=?, platform_total=?, platform_breakdown=?, counted_cash=?, is_closed=1, closed_at=datetime(\'now\'), notes=?
      WHERE id=?
    `).run(orders.length, totalRevenue, cashTotal, promptpayTotal, cardTotal, truemoneyTotal, platform.total, JSON.stringify(platform.byApp), countedCash, notes || '', existingOpen.id);
  } else {
    db.prepare(`
      INSERT INTO daily_closings (employee_id, employee_name, date, total_orders, total_revenue, cash_total, promptpay_total, card_total, truemoney_total, platform_total, platform_breakdown, counted_cash, is_closed, closed_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime(\'now\'), ?)
    `).run(empId, emp.name, d, orders.length, totalRevenue, cashTotal, promptpayTotal, cardTotal, truemoneyTotal, platform.total, JSON.stringify(platform.byApp), countedCash, notes || '');
  }

  logAudit(empId, emp.name, 'daily_closing', 'daily_closing', 0, `Daily closing for ${d}: ${orders.length} orders, ${totalRevenue.toFixed(2)}`);
  res.json({ ok: true, total_orders: orders.length, total_revenue: totalRevenue, cash_total: cashTotal, promptpay_total: promptpayTotal, card_total: cardTotal, truemoney_total: truemoneyTotal, platform_total: platform.total, platform_breakdown: platform.byApp, counted_cash: countedCash });
});

module.exports = router;
