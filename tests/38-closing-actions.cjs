const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const records = [[{ id: 1, employee_id: 1, employee_name: 'Old', cashier_code: 'A', is_closed: 1, total_revenue: 10 }],
  [{ id: 2, employee_id: 2, employee_name: 'Current', cashier_code: 'B', is_closed: 1, total_revenue: 20 }]];
let load = 0;
let listener;
const calls = [];
const container = { innerHTML: '', addEventListener(type, callback) { if (type === 'click') listener = callback; } };
const elements = {
  'closing-date': { value: '2026-09-13' },
  'closing-employee-filter': { value: '', options: [{ value: '' }, { value: '1' }] },
  'closing-content': container
};
const context = vm.createContext({
  document: { getElementById: id => elements[id] || null },
  api: async (url, method) => {
    calls.push({ url, method });
    if (url.startsWith('/api/daily-closings?')) return records[Math.min(load++, 1)];
    if (url.startsWith('/api/orders?')) return [];
    if (url.startsWith('/api/reports/daily?')) return { total_orders: 0, total_revenue: 0, by_payment: [], by_cashier: [], by_delivery_app: [], supplier_expenses: [], counted_cash: null };
    return { ok: true };
  },
  businessDate: () => '2026-09-13', getCurrency: () => 'THB', currentLang: 'en',
  currentUser: { role: 'admin', id: 1 }, t: key => key, escapeHtml: value => String(value),
  platformBreakdownFromOrders: () => ({}), readPlatformBreakdown: () => ({}), deliveryAppName: name => name, paymentMethodsList: [],
  printDailyClosingThermal: row => { context.printedId = row.id; },
  printDailyClosingReport: row => { context.printedId = row.id; },
  confirm: () => true, toast: () => {}
});
vm.runInContext(fs.readFileSync('public/js/features/shifts/shift-closing-dashboard.js', 'utf8'), context);
function click(action, id) {
  const button = { dataset: { action, closingId: String(id) }, disabled: false };
  return listener({ target: { closest: () => button } });
}
(async () => {
  await vm.runInContext('loadDailyClosing()', context);
  await vm.runInContext('loadDailyClosing()', context);
  assert.equal(typeof listener, 'function');
  await click('print-pdf', 2);
  assert.equal(context.printedId, 2);
  context.printedId = null;
  await click('print-thermal', 2);
  assert.equal(context.printedId, 2);
  await click('approve-closing', 2);
  assert(calls.some(call => call.url === '/api/daily-closings/2/approve' && call.method === 'POST'));
  await click('reopen-closing', 2);
  assert(calls.some(call => call.url === '/api/daily-closings/2/reopen' && call.method === 'POST'));
  console.log('PASS 38: closing actions use the latest rendered rows after reload');
})().catch(error => { console.error(error); process.exitCode = 1; });
