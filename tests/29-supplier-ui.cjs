const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const codeInput = { value: '' };
const title = { textContent: '', setAttribute() {} };
const modal = { classList: { contains: () => false, add() {} } };
const form = { reset() {}, elements: { id: { value: '' } } };
const elements = {
  'admin-suppliers-admin': null,
  'modal-supplier-form': modal,
  'form-supplier': form,
  'supplier-modal-title': title,
  'supplier-code-hidden': codeInput
};
let systemCurrency = '฿';
const context = vm.createContext({
  document: { getElementById: id => elements[id] || null },
  t: key => ({ add_supplier: 'إضافة مورد', view_details: 'التفاصيل', edit: 'تعديل',
    add_purchase: 'مشتريات', add_payment: 'سند صرف', statement: 'كشف حساب' })[key] || key,
  escapeHtml: value => String(value),
  currentLang: 'ar',
  getCurrency: () => systemCurrency,
  Intl
});
vm.runInContext(fs.readFileSync('public/js/features/suppliers/suppliers-admin.js', 'utf8'), context);
vm.runInContext("suppliersData = [{ id: 1, name: 'مورد', code: null, active: 1 }]", context);
vm.runInContext('openSupplierForm()', context);
assert.equal(codeInput.value, 'SUP-0001');
assert.equal(title.textContent, 'إضافة مورد');
const card = vm.runInContext('createSupplierCard(suppliersData[0])', context);
for (const label of ['التفاصيل', 'تعديل', 'مشتريات', 'سند صرف', 'كشف حساب']) assert(card.includes(label));
assert(context.formatCurrency(12.5).includes('฿'));
assert(!context.formatCurrency(12.5).includes('ر.س'));
systemCurrency = '$';
assert(context.formatCurrency(12.5).includes('$'));
assert(!context.formatCurrency(12.5).includes('฿'));
console.log('PASS 29: supplier form opens with legacy blank code and card actions have labels');
