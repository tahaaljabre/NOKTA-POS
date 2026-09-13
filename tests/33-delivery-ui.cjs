const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const buttons = [];
const elements = {
  'delivery-buttons-container': { innerHTML: '', appendChild(button) { buttons.push(button); } },
  'delivery-select-modal': { style: {} },
  'btn-select-payment': { textContent: '' }
};
const context = vm.createContext({
  document: {
    getElementById: id => elements[id],
    createElement: () => ({ style: {}, dataset: {} }),
    querySelectorAll: () => [],
    querySelector: () => null
  },
  deliveryMethodsList: [{ id: 'grab', name: 'GrabFood' }, { id: 'lineman', name: 'LINE MAN' }],
  currentOrder: { type: 'dine_in', payment_method: 'cash', attributes: {} },
  t: key => ({ platform_collection: 'تحصيل المنصة' })[key] || key,
  toggleCashCalculator(value) { context.cashCalculator = value; }
});
vm.runInContext(fs.readFileSync('public/js/features/orders/order-method-selection.js', 'utf8'), context);
vm.runInContext('openDeliverySelectModal()', context);
assert.equal(buttons.length, 2);
buttons[0].onclick();
assert.equal(context.currentOrder.attributes.delivery_app_id, 'grab');
assert.equal(context.currentOrder.payment_method, 'platform');
assert.equal(elements['btn-select-payment'].textContent, 'تحصيل المنصة');
assert.equal(context.cashCalculator, false);
console.log('PASS 33: selecting an app sets platform collection before invoice creation');
