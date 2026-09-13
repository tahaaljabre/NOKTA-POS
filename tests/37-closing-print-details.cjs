const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

let html = '';
const doc = { open() {}, write(value) { html = value; }, close() {} };
const context = vm.createContext({
  document: {
    getElementById: id => id === 'closing-date' ? { value: '2026-09-12' } : null,
    createElement: () => ({ style: {}, contentWindow: { document: doc } }),
    body: { appendChild() {} }
  },
  api: async url => url === '/api/settings' ? {} : {
    date: '2026-09-12', total_orders: 4, total_revenue: 100,
    by_payment: [{ payment_method: 'cash', total: 20 }, { payment_method: 'card', total: 30 }, { payment_method: 'platform', total: 50 }],
    by_delivery_app: [{ app_id: 'grab', app_name: 'Grab', count: 1, total: 20 }, { app_id: 'lineman', app_name: 'LINE MAN', count: 1, total: 30 }],
    platform_receivable: 50, opening_cash: 10, cash_discount: 2,
    cash_expenses: 5, expected_cash: 25, counted_cash: 24, cash_count_complete: true, cash_difference: -1,
    supplier_expenses: [{ supplier_name: 'Oil Supplier', payment_method: 'cash', amount: 5 }],
    supplier_expenses_total: 5, net_after_expenses: 95,
    by_cashier: [{ cashier_code: 'A', cashier_name: 'Ahmed', total: 100, waiters: [{ employee_name: 'Sara', total: 30 }] }],
    closing_notes: [{ employee_name: 'Ahmed', note: 'Count checked' }]
  },
  currentLang: 'en', businessDate: () => '2026-09-12', getCurrency: () => 'THB',
  t: key => key, escapeHtml: value => String(value),
  deliveryAppName: id => id, paymentMethodsList: [{ id: 'card', name: 'Visa Terminal' }],
  appRestaurantName: '', appRestaurantNameEn: '', setTimeout() {}, Date
});
vm.runInContext(fs.readFileSync('public/js/features/shifts/shift-closing-report-printing.js', 'utf8'), context);
vm.runInContext("printDailyClosingReport({date:'2026-09-12', employee_id:1})", context);
setImmediate(() => {
  for (const fragment of ['Grab', 'LINE MAN', 'Visa Terminal', 'Oil Supplier', 'Ahmed', 'Sara', 'Count checked', '25.00', '24.00', '95.00']) {
    assert(html.includes(fragment), `Missing ${fragment} in A4 closing`);
  }
  vm.runInContext(fs.readFileSync('public/js/features/shifts/shift-closing-thermal-printing.js', 'utf8'), context);
  vm.runInContext("printDailyClosingThermal({date:'2026-09-12', employee_id:1})", context);
  setImmediate(() => {
    for (const fragment of ['Grab', 'LINE MAN', 'Visa Terminal', 'Oil Supplier', 'Count checked', '25.00', '24.00', '95.00']) {
      assert(html.includes(fragment), `Missing ${fragment} in thermal closing`);
    }
    console.log('PASS 37: A4 and thermal closings render app, card, supplier, cashier, cash count, and notes details');
  });
});
