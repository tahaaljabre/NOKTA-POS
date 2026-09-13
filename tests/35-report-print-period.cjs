const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const elements = {
  'report-from': { value: '2026-09-01' },
  'report-to': { value: '2026-09-07' },
  'report-employee-filter': { value: '2', selectedIndex: 1, options: [{ text: 'All' }, { text: 'Cashier' }] }
};
const calls = [];
const context = vm.createContext({
  document: { getElementById: id => elements[id] || null },
  businessDate: () => '2026-09-13',
  currentLang: 'en',
  api: async url => { calls.push(url); return url === '/api/settings' ? {} : { totals: {} }; },
  getCurrency: () => 'THB',
  getSalesReportHtml: (_report, from, to) => `${from}/${to}`,
  printSalesReportHtml: html => { context.printed = html; },
  appRestaurantName: '', appRestaurantNameEn: ''
});
vm.runInContext(fs.readFileSync('public/js/features/reports/sales-report-printing.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('public/js/reports.js', 'utf8'), context);
vm.runInContext('printAdminReport()', context);
setImmediate(() => {
  assert.equal(calls[0], '/api/reports/sales?from=2026-09-01&to=2026-09-07&employee_id=2');
  assert.equal(context.printed, '2026-09-01/2026-09-07');
  console.log('PASS 35: admin print uses the selected report period and employee');
});
