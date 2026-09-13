// Printable A4 sales report generation.
// Extracted template logic moved to sales-report-template.js.

async function printSalesReport(source = 'sales') {
  const prefix = source === 'admin' ? 'report' : 'sales';
  const fromInput = document.getElementById(`${prefix}-from`);
  const toInput = document.getElementById(`${prefix}-to`);
  const today = businessDate();

  const from = fromInput?.value || today;
  const to = toInput?.value || from;
  const empSel = document.getElementById(`${prefix}-employee-filter`);
  const empId = empSel?.value || '';
  const empText = empSel && empSel.selectedIndex > 0 ? empSel.options[empSel.selectedIndex].text : (currentLang === 'ar' ? 'كل الموظفين' : 'All Employees');

  let url = `/api/reports/sales?from=${from}&to=${to}`;
  if (empId) url += `&employee_id=${empId}`;

  const report = await api(url);
  const currency = getCurrency();

  let s = {};
  try { s = await api('/api/settings'); } catch(e) {}
  const restName = currentLang === 'ar' ? (s.restaurant_name || appRestaurantName || 'اسم المنشأة') : (s.restaurant_name_en || appRestaurantNameEn || s.restaurant_name || 'Your Business');
  const addr = s.restaurant_address || '';
  const phone = s.restaurant_phone || '';
  const taxNo = s.tax_number || '';

  const html = getSalesReportHtml(report, from, to, empSel, empId, empText, restName, addr, phone, taxNo, currency);
  printSalesReportHtml(html);
}
