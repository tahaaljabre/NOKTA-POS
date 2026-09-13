const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('public/js/audit-render.js', 'utf8');
const context = vm.createContext({
  document: { querySelectorAll: () => [{ href: 'http://localhost:3000/style.css' }] },
  t: key => key,
  currentLang: 'ar',
  escapeHtml: value => String(value),
  getRestaurantName: () => 'NOKTA',
});
vm.runInContext(source, context);
const html = context.buildAuditPrintDocument('<div class="audit-card"><div class="audit-inv-old">OLD</div><div class="audit-inv-new">NEW</div></div>');
assert.match(html, /OLD/);
assert.match(html, /NEW/);
assert.match(html, /style\.css/);
assert.match(html, /size:A4 landscape/);
assert.match(source, /data-audit-print/);
assert.doesNotMatch(source, /\/api\/orders\/\$\{orderId\}/);
assert.doesNotMatch(source.slice(source.indexOf('function printAuditInvoice')), /generateReceipt\(/);
console.log('PASS 43-audit-local-print.cjs');
