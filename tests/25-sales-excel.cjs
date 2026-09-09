const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { createSalesReportXlsx } = require('../src/services/sales-report-excel.service');

(async () => {
  const report = {
    from: '2026-09-01', to: '2026-09-02', timezone: 'Asia/Bangkok',
    totals: { total_orders: 3, total_revenue: 125.5 },
    daily: [{ day: '2026-09-01', orders: 3, revenue: 125.5 }],
    by_payment: [{ payment_method: 'cash', count: 3, total: 125.5 }],
    by_employee: [{ employee_name: 'موظف اختبار', count: 3, total: 125.5 }]
  };
  const buffer = await createSalesReportXlsx(report, { language: 'ar', currency: '฿' });
  assert.equal(Buffer.from(buffer).subarray(0, 2).toString(), 'PK');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['الملخص', 'المبيعات اليومية', 'طرق الدفع', 'الموظفون']);
  assert.equal(workbook.getWorksheet('الملخص').getCell('F4').value, 125.5);
  assert.equal(workbook.getWorksheet('الموظفون').getCell('A4').value, 'موظف اختبار');
  console.log('PASS 25: real XLSX sales report with summary, daily, payment and employee sheets');
})().catch(error => { console.error(error); process.exitCode = 1; });
