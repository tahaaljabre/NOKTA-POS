const ExcelJS = require('exceljs');

const labels = {
  ar: {
    title: 'تقرير المبيعات', summary: 'الملخص', daily: 'المبيعات اليومية', payments: 'طرق الدفع', employees: 'الموظفون', cashiers: 'الكاشيرات', types: 'أنواع الطلبات',
    periodFrom: 'من', periodTo: 'إلى', timezone: 'المنطقة الزمنية', totalOrders: 'إجمالي الطلبات', totalRevenue: 'إجمالي الإيرادات',
    totalTax: 'الضريبة المحصلة', taxRate: 'نسبة الضريبة',
    averageOrder: 'متوسط الطلب', date: 'التاريخ', orders: 'الطلبات', revenue: 'الإيراد', paymentMethod: 'طريقة الدفع',
    orderType: 'نوع الطلب', employee: 'الموظف', cashier: 'رمز الكاشير', count: 'العدد', currency: 'العملة', deliveryApps: 'تطبيقات التوصيل', app: 'التطبيق', legacyCollection: 'تحصيل قديم للمراجعة'
  },
  en: {
    title: 'Sales Report', summary: 'Summary', daily: 'Daily Sales', payments: 'Payment Methods', employees: 'Employees', cashiers: 'Cashiers', types: 'Order Types',
    periodFrom: 'From', periodTo: 'To', timezone: 'Time Zone', totalOrders: 'Total Orders', totalRevenue: 'Total Revenue',
    totalTax: 'Total Tax', taxRate: 'Tax Rate',
    averageOrder: 'Average Order', date: 'Date', orders: 'Orders', revenue: 'Revenue', paymentMethod: 'Payment Method',
    orderType: 'Order Type', employee: 'Employee', cashier: 'Cashier Code', count: 'Count', currency: 'Currency', deliveryApps: 'Delivery Apps', app: 'App', legacyCollection: 'Older collection to review'
  }
};

function styleSheet(sheet, title, columnWidths) {
  sheet.views = [{ rightToLeft: sheet.properties.tabColor === 'AR', state: 'frozen', ySplit: 3 }];
  sheet.mergeCells(1, 1, 1, columnWidths.length);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF721C24' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 26;
  sheet.columns.forEach((column, index) => { column.width = columnWidths[index]; });
  sheet.eachRow((row, rowNumber) => {
    row.font = { ...row.font, name: 'Arial', size: rowNumber === 1 ? 15 : 10 };
    row.alignment = { vertical: 'middle', horizontal: rowNumber === 3 ? 'center' : undefined };
    if (rowNumber === 3) {
      row.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5E3C' } };
    }
  });
  sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: columnWidths.length } };
}

function addDataSheet(workbook, name, title, headers, rows, widths, language) {
  const sheet = workbook.addWorksheet(name, { properties: { tabColor: language === 'ar' ? 'AR' : 'EN' } });
  sheet.addRow([]);
  sheet.addRow([]);
  sheet.addRow(headers);
  rows.forEach(row => sheet.addRow(row));
  styleSheet(sheet, title, widths);
  return sheet;
}

async function createSalesReportWorkbook(report, options = {}) {
  const language = options.language === 'en' ? 'en' : 'ar';
  const l = labels[language];
  const currency = String(options.currency || '฿');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NOKTA POS';
  workbook.created = new Date();
  workbook.modified = new Date();

  const totalOrders = Number(report.totals?.total_orders || 0);
  const totalRevenue = Number(report.totals?.total_revenue || 0);
  const totalTax = Number(report.totals?.total_tax || 0);
  const taxRate = Number(report.totals?.tax_rate || 0);
  
  const summary = addDataSheet(workbook, l.summary, l.title,
    [l.periodFrom, l.periodTo, l.timezone, l.currency, l.totalOrders, l.totalRevenue, l.totalTax, l.taxRate, l.averageOrder],
    [[report.from, report.to, report.timezone || '', currency, totalOrders, totalRevenue, totalTax, taxRate, totalOrders ? totalRevenue / totalOrders : 0]],
    [14, 14, 22, 12, 16, 18, 18, 14, 18], language);
  summary.getColumn(6).numFmt = '#,##0.00';
  summary.getColumn(7).numFmt = '#,##0.00';
  summary.getColumn(9).numFmt = '#,##0.00';

  const types = addDataSheet(workbook, l.types, l.types,
    [l.orderType, l.count, l.revenue],
    (report.by_type || []).map(row => [String(row.type || ''), Number(row.count || 0), Number(row.total || 0)]),
    [24, 14, 18], language);
  types.getColumn(3).numFmt = '#,##0.00';

  const daily = addDataSheet(workbook, l.daily, l.daily,
    [l.date, l.orders, l.revenue, l.totalTax],
    (report.daily || []).map(row => [new Date(`${row.day}T00:00:00Z`), Number(row.orders || 0), Number(row.revenue || 0), Number(row.tax || 0)]),
    [16, 14, 18, 18], language);
  daily.getColumn(1).numFmt = 'yyyy-mm-dd';
  daily.getColumn(3).numFmt = '#,##0.00';
  daily.getColumn(4).numFmt = '#,##0.00';

  const payments = addDataSheet(workbook, l.payments, l.payments,
    [l.paymentMethod, l.count, l.revenue],
    (report.by_payment || []).map(row => [String(row.payment_method || ''), Number(row.count || 0), Number(row.total || 0)]),
    [24, 14, 18], language);
  payments.getColumn(3).numFmt = '#,##0.00';

  if ((report.by_delivery_app || []).length) {
    const apps = addDataSheet(workbook, l.deliveryApps, l.deliveryApps,
      [l.app, l.count, l.revenue, l.legacyCollection],
      report.by_delivery_app.map(row => [String(row.app_name || row.app_id || ''), Number(row.count || 0), Number(row.total || 0), Number(row.legacy_collection || 0)]),
      [30, 14, 18, 24], language);
    apps.getColumn(3).numFmt = '#,##0.00';
    apps.getColumn(4).numFmt = '#,##0.00';
  }

  const employees = addDataSheet(workbook, l.employees, l.employees,
    [l.employee, l.orders, l.revenue],
    (report.by_employee || []).map(row => [String(row.employee_name || ''), Number(row.count || 0), Number(row.total || 0)]),
    [28, 14, 18], language);
  employees.getColumn(3).numFmt = '#,##0.00';

  if ((report.by_cashier || []).length) {
    const cashiers = addDataSheet(workbook, l.cashiers, l.cashiers,
      [l.cashier, l.orders, l.revenue, language === 'ar' ? 'النادلون' : 'Waiters'],
      report.by_cashier.map(row => [String(row.cashier_code || ''), Number(row.count || 0), Number(row.total || 0), (row.waiters || []).map(w => `${w.employee_name}: ${Number(w.total || 0).toFixed(2)}`).join(' | ')]),
      [24, 14, 18, 44], language);
    cashiers.getColumn(3).numFmt = '#,##0.00';
  }

  return workbook;
}

async function createSalesReportXlsx(report, options = {}) {
  const workbook = await createSalesReportWorkbook(report, options);
  return workbook.xlsx.writeBuffer();
}

module.exports = { createSalesReportWorkbook, createSalesReportXlsx };
