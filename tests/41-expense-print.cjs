const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
let printed = '';
const doc = { open() {}, write(value) { printed = value; }, close() {} };
const context = vm.createContext({
  document: { createElement: () => ({ style: {}, contentWindow: { document: doc } }), body: { appendChild() {} } },
  currentLang: 'en', appRestaurantNameEn: 'Test Restaurant',
  getCurrency: () => 'SAR', t: key => key, escapeHtml: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
  setTimeout() {}
});
vm.runInContext(fs.readFileSync('public/js/features/expenses/expenses-printing.js', 'utf8'), context);
vm.runInContext("printShopExpenseReceipt({id:7,expense_date:'2026-09-13',title:'<Unsafe>',category:'purchase',amount:12.5,payment_method:'cash',cashier_name:'Ali',cashier_code:'A',payee:'Shop'})", context);
assert(printed.includes('EXP-000007'));
assert(printed.includes('12.50 SAR'));
assert(printed.includes('&lt;Unsafe&gt;'));
assert(!printed.includes('<Unsafe>'));
vm.runInContext("printShopExpensesReportPage({from:'2026-09-01',to:'2026-09-13',count:1,total:12.5,items:[{id:7,expense_date:'2026-09-13',title:'Shop',category:'purchase',amount:12.5,payment_method:'cash',cashier_name:'Ali'}]})", context);
assert(printed.includes('2026-09-01'));
assert(printed.includes('2026-09-13'));
assert(printed.includes('12.50 SAR'));
console.log('PASS 41: expense voucher and period report use configured currency and escape data');
