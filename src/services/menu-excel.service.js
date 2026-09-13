const ExcelJS = require('exceljs');

async function createMenuExportWorkbook(categories, items, modifiers) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NOKTA POS';
  wb.created = new Date();

  const catFont = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  const catFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF202A44' } };
  const itemFont = { size: 11, color: { argb: 'FF333333' } };
  const itemFillEven = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
  const groupFont = { bold: true, size: 11, color: { argb: 'FF18A999' } };
  const groupFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F8F5' } };

  const sheet = wb.addWorksheet('Menu', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  sheet.columns = [
    { header: 'النوع', key: 'type', width: 6 },
    { header: 'الاسم عربي', key: 'name', width: 30 },
    { header: 'Name (EN)', key: 'name_en', width: 30 },
    { header: 'السعر', key: 'price', width: 12 },
    { header: 'السعر2', key: 'price2', width: 12 },
    { header: 'التكلفة', key: 'cost_price', width: 12 },
    { header: 'الأيقونة', key: 'icon', width: 8 },
    { header: 'الصورة (URL)', key: 'image', width: 45 },
    { header: 'الباركود', key: 'barcode', width: 15 },
    { header: 'الترتيب', key: 'sort_order', width: 10 },
    { header: 'نشط', key: 'active', width: 8 }
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B1124' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;

  const itemsByCat = new Map();
  for (const item of items) {
    const catId = item.category_id;
    if (!itemsByCat.has(catId)) itemsByCat.set(catId, []);
    itemsByCat.get(catId).push(item);
  }

  let rowIndex = 2;
  const sortedCats = [...categories].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id);

  for (const cat of sortedCats) {
    const catRow = sheet.getRow(rowIndex);
    catRow.getCell(1).value = '📁';
    catRow.getCell(2).value = cat.name;
    catRow.getCell(3).value = cat.name_en || '';
    catRow.getCell(7).value = cat.icon || '📁';
    catRow.getCell(10).value = cat.sort_order || 0;
    catRow.getCell(11).value = cat.active ? '✓' : '✗';
    catRow.font = catFont;
    catRow.fill = catFill;
    catRow.height = 24;
    rowIndex++;

    const catItems = (itemsByCat.get(cat.id) || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id);
    for (let idx = 0; idx < catItems.length; idx++) {
      const item = catItems[idx];
      const itemRow = sheet.getRow(rowIndex);
      const prefix = idx === catItems.length - 1 ? '  └─ ' : '  ├─ ';
      itemRow.getCell(2).value = prefix + item.name;
      itemRow.getCell(3).value = item.name_en || '';
      itemRow.getCell(4).value = item.price || 0;
      itemRow.getCell(5).value = item.price2 || 0;
      itemRow.getCell(6).value = item.cost_price || 0;
      itemRow.getCell(8).value = item.image || '';
      itemRow.getCell(9).value = item.barcode || '';
      itemRow.getCell(10).value = item.sort_order || 0;
      itemRow.getCell(11).value = item.active ? '✓' : '✗';
      itemRow.font = itemFont;
      itemRow.fill = idx % 2 === 0 ? itemFillEven : {};
      itemRow.alignment = { vertical: 'middle', indent: 1 };
      rowIndex++;
    }
  }

  if (modifiers && modifiers.length) {
    const sectionRow = sheet.getRow(rowIndex);
    sectionRow.getCell(2).value = '━━━ الإضافات / Modifiers ━━━';
    sectionRow.font = { bold: true, size: 12, color: { argb: 'FF18A999' } };
    sectionRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F8F5' } };
    sectionRow.height = 28;
    rowIndex++;

    const groupedMods = new Map();
    for (const mod of modifiers) {
      const grp = mod.group_name || 'Default';
      if (!groupedMods.has(grp)) groupedMods.set(grp, []);
      groupedMods.get(grp).push(mod);
    }

    for (const [groupName, groupMods] of groupedMods) {
      const groupRow = sheet.getRow(rowIndex);
      groupRow.getCell(1).value = '📂';
      groupRow.getCell(2).value = groupName;
      groupRow.getCell(3).value = groupMods[0]?.group_name_en || '';
      groupRow.font = groupFont;
      groupRow.fill = groupFill;
      rowIndex++;

      for (let idx = 0; idx < groupMods.length; idx++) {
        const mod = groupMods[idx];
        const modRow = sheet.getRow(rowIndex);
        const prefix = idx === groupMods.length - 1 ? '  └─ ' : '  ├─ ';
        modRow.getCell(2).value = prefix + mod.name;
        modRow.getCell(3).value = mod.name_en || '';
        modRow.getCell(4).value = mod.price_extra || 0;
        modRow.font = itemFont;
        modRow.fill = idx % 2 === 0 ? itemFillEven : {};
        modRow.alignment = { indent: 1 };
        rowIndex++;
      }
    }
  }

  return wb.xlsx.writeBuffer();
}

// Detect column positions by header text (flexible)
function detectColumns(headerRow) {
  const cols = {};
  const maxCols = 20;
  for (let c = 1; c <= maxCols; c++) {
    const val = String(headerRow.getCell(c).value || '').toLowerCase().trim();
    if (!val) continue;

    if (/^#|رقم$|序号/i.test(val)) cols.id = c;
    else if (/اسم.*عربي|اسم.*الصنف|arabic.*name|item.*name.*ar|اسم بالعربي/i.test(val)) cols.name = c;
    else if (/english.*name|item.*name.*en|name.*english|الاسم.*انجليزي|اسم.*انجليزي|item name/i.test(val)) cols.name_en = c;
    else if (/سعر|price|cost|ثمن|السعر/i.test(val) && !cols.price) cols.price = c;
    else if (/سعر2|price2|second.*price/i.test(val)) cols.price2 = c;
    else if (/تكلفة|cost.*price|سعر.*الشراء/i.test(val)) cols.cost_price = c;
    else if (/صورة|image|photo|picture|logo|url|رابط/i.test(val)) cols.image = c;
    else if (/باركود|barcode|codabar/i.test(val)) cols.barcode = c;
    else if (/ترتيب|sort|order| رقم.*ترتيب/i.test(val)) cols.sort_order = c;
    else if (/نشط|active|متوفر|available/i.test(val)) cols.active = c;
    else if (/قسم|category|group|المجموعة/i.test(val)) cols.category = c;
  }

  // Fallback: if no name column detected, assume col 2
  if (!cols.name) cols.name = 2;
  // Fallback: if no price column, assume last meaningful col or col 4
  if (!cols.price) cols.price = 4;

  return cols;
}

// Detect if a row is a category row
function isCategoryRow(row, cols) {
  const a = String(row.getCell(1).value || '').trim();
  const b = String(row.getCell(cols.name || 2).value || '').trim();

  if (!a) return false;

  // Skip header rows
  if (a === '#') return false;

  // Not a number
  if (/^\d+$/.test(a)) return false;

  // Category: A===B (text repeated across columns), price is NOT a number
  if (a === b) {
    const priceVal = row.getCell(cols.price || 4).value;
    const priceStr = String(priceVal || '').trim();
    // Price is empty or text (not a number) = category row
    if (!priceStr || isNaN(Number(priceStr))) return true;
  }

  // Category: A has text, B is empty, C is empty, D is empty (merged cells)
  if (a && !b) {
    const c = cols.name_en ? String(row.getCell(cols.name_en).value || '').trim() : '';
    const d = cols.price ? String(row.getCell(cols.price).value || '').trim() : '';
    if (!c && !d) return true;
  }

  return false;
}

// Detect if a row is a header row
function isHeaderRow(row) {
  const a = String(row.getCell(1).value || '').trim();
  if (a === '#') return true;
  for (let c = 1; c <= 8; c++) {
    const v = String(row.getCell(c).value || '').toLowerCase();
    if (/اسم.*صنف|item.*name|اسم.*عربي|السعر|price/i.test(v)) return true;
  }
  return false;
}

async function parseMenuImportWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const result = { categories: [], items: [], modifiers: [], errors: [] };
  const ws = wb.worksheets[0];
  if (!ws) return result;

  let currentCatId = 0;
  let catSort = 0;
  let itemSortByCat = 0;
  let cols = null;
  let headerRowNum = 0;

  ws.eachRow((row, rn) => {
    const a = String(row.getCell(1).value || '').trim();

    // Detect header row
    if (isHeaderRow(row)) {
      if (!cols) cols = detectColumns(row);
      headerRowNum = rn;
      return;
    }

    // If we haven't found a header yet, try to detect columns from this row
    if (!cols) {
      // Check if this row has a header-like structure
      for (let c = 1; c <= 8; c++) {
        const v = String(row.getCell(c).value || '').toLowerCase();
        if (/اسم.*صنف|item.*name|اسم.*عربي|السعر|price/i.test(v)) {
          cols = detectColumns(row);
          headerRowNum = rn;
          return;
        }
      }
    }

    const nameCol = cols ? cols.name : 2;
    const nameEnCol = cols ? cols.name_en : 3;
    const priceCol = cols ? cols.price : 4;

    const name = String(row.getCell(nameCol).value || '').trim();
    const nameEn = nameEnCol ? String(row.getCell(nameEnCol).value || '').trim() : '';
    const price = priceCol ? Number(row.getCell(priceCol).value) || 0 : 0;

    if (!name) return;

    // Check if category
    if (isCategoryRow(row, cols || { name: 2, price: 4 })) {
      catSort++;
      currentCatId++;
      itemSortByCat = 0;
      result.categories.push({
        id: null,
        name,
        name_en: nameEn,
        icon: '📁',
        sort_order: catSort,
        active: 1
      });
      return;
    }

    // It's an item
    itemSortByCat++;
    const imageCol = cols && cols.image ? String(row.getCell(cols.image).value || '').trim() : '';
    result.items.push({
      id: null,
      category_id: currentCatId || 1,
      name,
      name_en: nameEn,
      price,
      price2: cols && cols.price2 ? Number(row.getCell(cols.price2).value) || 0 : 0,
      cost_price: cols && cols.cost_price ? Number(row.getCell(cols.cost_price).value) || 0 : 0,
      image: imageCol,
      barcode: cols && cols.barcode ? String(row.getCell(cols.barcode).value || '').trim() : '',
      sku: '',
      sort_order: cols && cols.sort_order ? Number(row.getCell(cols.sort_order).value) || itemSortByCat : itemSortByCat,
      active: cols && cols.active ? (String(row.getCell(cols.active).value || '1').trim() === '0' ? 0 : 1) : 1
    });
  });

  // If no categories found but items exist, create a default one
  if (result.categories.length === 0 && result.items.length > 0) {
    result.categories.push({
      id: null, name: 'القائمة العامة', name_en: 'General Menu',
      icon: '📁', sort_order: 1, active: 1
    });
    result.items.forEach(item => item.category_id = 1);
  }

  return result;
}

module.exports = { createMenuExportWorkbook, parseMenuImportWorkbook };
