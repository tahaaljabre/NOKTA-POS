const router = require('express').Router();
const { db } = require('../database/db');
const { requirePermission } = require('../middleware/auth.middleware');
const { validDay, dayOf } = require('../services/business-time');

router.use(requirePermission('manage_expenses'));

function readRange(req) {
  const from = validDay(String(req.query.from || dayOf()));
  const to = validDay(String(req.query.to || from));
  if (from > to) { const error = new Error('نطاق التاريخ غير صالح / Invalid date range'); error.status = 400; throw error; }
  return { from, to };
}

router.get('/', (req, res, next) => {
  try {
    const { from, to } = readRange(req);
    const rows = db.prepare(`SELECT x.*, e.name created_by_name FROM shop_expenses x
      LEFT JOIN employees e ON e.id=x.created_by
      WHERE x.expense_date BETWEEN ? AND ? ORDER BY x.expense_date DESC, x.id DESC`).all(from, to);
    const totalCents = rows.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0);
    res.json({ from, to, total: totalCents / 100, count: rows.length, items: rows });
  } catch (error) { next(error); }
});

router.post('/', (req, res, next) => {
  try {
    const expenseDate = validDay(String(req.body.expense_date || ''));
    const title = String(req.body.title || '').trim();
    const category = String(req.body.category || 'purchase');
    const paymentMethod = String(req.body.payment_method || 'cash');
    const amount = Number(req.body.amount);
    const cashierId = Number(req.body.cashier_id);
    const payee = String(req.body.payee || '').trim();
    const reference = String(req.body.reference_number || '').trim();
    const notes = String(req.body.notes || '').trim();
    if (!title || title.length > 160 || !['purchase', 'operations', 'utilities', 'transport', 'other'].includes(category) ||
      !['cash', 'card', 'bank_transfer', 'other'].includes(paymentMethod) ||
      !Number.isFinite(amount) || amount <= 0 || amount > 100000000 || Math.round(amount * 100) / 100 !== amount ||
      !Number.isInteger(cashierId) || cashierId <= 0 || payee.length > 160 || reference.length > 100 || notes.length > 1000) {
      return res.status(400).json({ error: 'بيانات المصروف غير صحيحة / Invalid expense details' });
    }
    const cashier = db.prepare('SELECT id,code,name FROM cashiers WHERE id=? AND active=1').get(cashierId);
    if (!cashier) return res.status(400).json({ error: 'الكاشير غير صالح / Invalid cashier' });
    if (req.currentUser.role !== 'admin' && req.currentUser.cashier_code && req.currentUser.cashier_code !== cashier.code) {
      return res.status(403).json({ error: 'الكاشير غير مرتبط بهذا الموظف / Cashier is not assigned to this employee' });
    }
    const saved = db.transaction(() => {
      const result = db.prepare(`INSERT INTO shop_expenses
        (expense_date,title,category,amount,payment_method,cashier_id,cashier_code,cashier_name,payee,reference_number,notes,created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(expenseDate, title, category, amount, paymentMethod,
        cashier.id, cashier.code, cashier.name, payee, reference, notes, req.currentUser.id);
      const id = Number(result.lastInsertRowid);
      db.prepare(`INSERT INTO audit_log
        (employee_id,employee_name,action,entity,entity_id,details,old_value,new_value)
        VALUES (?,?,?,?,?,?,?,?)`).run(req.currentUser.id, req.currentUser.name, 'create_expense', 'shop_expense', id,
        `Expense ${id}: ${title}`, '', JSON.stringify({ expense_date: expenseDate, title, category, amount,
          payment_method: paymentMethod, cashier_id: cashier.id, cashier_code: cashier.code, payee, reference_number: reference, notes }));
      return db.prepare('SELECT * FROM shop_expenses WHERE id=?').get(id);
    })();
    res.status(201).json(saved);
  } catch (error) { next(error); }
});

module.exports = router;
