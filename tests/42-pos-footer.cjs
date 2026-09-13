const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const nodes = new Map();
for (const id of ['order-subtotal', 'order-discount-val', 'order-tax-val', 'order-total', 'order-change-val', 'cash-calc-row', 'change-row']) {
  nodes.set(id, { textContent: '', style: {} });
}
const context = vm.createContext({
  currentOrder: { items: [{ price: 100, quantity: 1 }], discount: 0, cash_received: 120, payment_method: 'cash' },
  appTaxRate: 10, appTaxType: 'exclusive',
  document: { getElementById: id => nodes.get(id) || null },
  updateMobileCartBadge() {},
});
vm.runInContext(fs.readFileSync(path.join(root, 'public/js/features/orders/order-screen.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'public/js/features/orders/order-cart.js'), 'utf8'), context);
context.updateOrderTotals();
context.toggleCashCalculator(true);
assert.equal(nodes.get('order-tax-val').textContent, '10.00');
assert.equal(nodes.get('order-total').textContent, '110.00');
assert.equal(nodes.get('order-change-val').textContent, '10.00');
assert.equal(nodes.get('cash-calc-row').style.display, 'flex');
assert.equal(nodes.get('change-row').style.display, 'flex');
context.appTaxType = 'inclusive';
context.updateOrderTotals();
assert.equal(nodes.get('order-total').textContent, '100.00');
assert.equal(nodes.get('order-tax-val').textContent, '9.09');
assert.equal(nodes.get('order-change-val').textContent, '20.00');
assert.match(fs.readFileSync(path.join(root, 'public/views/pos-view.html'), 'utf8'), /id="order-tax-val"/);
console.log('PASS 42-pos-footer.cjs');
