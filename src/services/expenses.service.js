const { db } = require('../database/db');

function forDay(date, employeeId = null) {
  let filter = '';
  let args = [date];
  if (employeeId) {
    const employee = db.prepare('SELECT cashier_code FROM employees WHERE id=?').get(employeeId);
    if (employee?.cashier_code) { filter = ' AND x.cashier_code=?'; args.push(employee.cashier_code); }
    else { filter = ' AND x.created_by=?'; args.push(employeeId); }
  }
  const rows = db.prepare(`SELECT x.*, e.name created_by_name FROM shop_expenses x
    LEFT JOIN employees e ON e.id=x.created_by WHERE x.expense_date=?${filter} ORDER BY x.id`).all(...args);
  const cents = rows.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0);
  const cashCents = rows.filter(row => row.payment_method === 'cash')
    .reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0);
  return { items: rows, total: cents / 100, cash: cashCents / 100 };
}

module.exports = { forDay };
