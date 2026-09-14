const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { createMenuExportWorkbook, parseMenuImportWorkbook } = require('../src/services/menu-excel.service');

(async () => {
  const exported = await createMenuExportWorkbook(
    [{ id: 1, name: 'المشروبات', name_en: 'Drinks', icon: '🥤', sort_order: 1, active: 1 }],
    [{ id: 1, category_id: 1, name: 'ميرندا', name_en: 'Mirinda', price: 30, price2: 0, cost_price: 0, image: '', barcode: '', sort_order: 1, active: 1 }],
    []
  );
  const parsedExport = await parseMenuImportWorkbook(exported);
  assert.ok(parsedExport.categories.length > 0);
  assert.ok(parsedExport.items.length > 0);
  assert.equal(parsedExport.items[0].name.includes('├─'), false);
  assert.equal(parsedExport.items[0].name_en, 'Mirinda');

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Menu');
  sheet.addRow(['الاسم عربي', 'Name (EN)', 'السعر']);
  sheet.addRow(['صنف بدون صورة', 'Item without image', 12.5]);
  sheet.addRow(['صنف آخر', 'Another item', 20]);
  const parsedNoImage = await parseMenuImportWorkbook(await workbook.xlsx.writeBuffer());
  assert.equal(parsedNoImage.items.length, 2);
  assert.equal(parsedNoImage.items[1].price, 20);

  const withImage = new ExcelJS.Workbook();
  const imageSheet = withImage.addWorksheet('Menu');
  imageSheet.addRow(['الاسم عربي', 'Name (EN)', 'الصورة (URL)', 'السعر']);
  imageSheet.addRow(['صنف بصورة', 'Item with image', 'https://example.test/item.png', 15]);
  const parsedImage = await parseMenuImportWorkbook(await withImage.xlsx.writeBuffer());
  assert.equal(parsedImage.items.length, 1);
  assert.equal(parsedImage.items[0].image, 'https://example.test/item.png');
  assert.equal(parsedImage.items[0].price, 15);
  console.log('PASS 46: menu import detects optional image and flexible column order');
})().catch(error => { console.error(error); process.exitCode = 1; });
