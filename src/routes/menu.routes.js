const router = require('express').Router();
const { db } = require('../database/db');
const { requireAdmin } = require('../middleware/auth.middleware');
const { createMenuExportWorkbook, parseMenuImportWorkbook } = require('../services/menu-excel.service');

router.use(requireAdmin);

async function readMultipartFile(req) {
  const contentType = String(req.headers['content-type'] || '');
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) return null;
  const boundary = Buffer.from(`--${(match[1] || match[2]).trim()}`);
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks);
  const start = body.indexOf(boundary);
  if (start < 0) return null;
  const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), start);
  if (headerEnd < 0) return null;
  const headers = body.subarray(start, headerEnd).toString('utf8');
  const nameMatch = headers.match(/filename\*?=(?:UTF-8''|"?)([^";\r\n]*)/i);
  if (!/name="file"/i.test(headers) && !nameMatch) return null;
  const dataStart = headerEnd + 4;
  const end = body.indexOf(boundary, dataStart);
  if (end < 0) return null;
  const dataEnd = end >= 2 ? end - 2 : end;
  return { name: nameMatch?.[1] || 'menu.xlsx', data: body.subarray(dataStart, dataEnd) };
}

// Export menu to Excel
router.get('/export', async (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
  const items = db.prepare('SELECT * FROM items ORDER BY category_id, sort_order, id').all();
  const modifiers = db.prepare('SELECT * FROM modifiers ORDER BY sort_order, id').all();

  const buffer = await createMenuExportWorkbook(categories, items, modifiers);
  const timestamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="nokta-menu-${timestamp}.xlsx"`);
  res.send(Buffer.from(buffer));
});

// Import menu from Excel
router.post('/import', async (req, res) => {
  try {
    const file = await readMultipartFile(req);
    if (!file) {
      return res.status(400).json({ error: 'ملف مطلوب / File required' });
    }

    if (!/\.xlsx?$/i.test(file.name)) {
      return res.status(400).json({ error: 'الملف يجب أن يكون Excel (.xlsx) / File must be Excel (.xlsx)' });
    }

    const data = await parseMenuImportWorkbook(file.data);

    let importedCategories = 0, importedItems = 0, importedModifiers = 0;
    const errors = [];

  const importTransaction = db.transaction(() => {
    // Import categories
    const catMap = new Map(); // old_id -> new_id
    const importedCatNames = new Set(); // Track imported category names to avoid duplicates
    
    for (const cat of data.categories) {
      try {
        // Skip if this category name was already imported in this session
        if (importedCatNames.has(cat.name)) {
          errors.push(`تم تخطي قسم مكرر: "${cat.name}"`);
          continue;
        }
        
        // Check if a category with this name already exists
        const existingByName = db.prepare('SELECT id FROM categories WHERE name=?').get(cat.name);
        if (existingByName) {
          // Update existing category
          db.prepare('UPDATE categories SET name_en=?, icon=?, sort_order=?, active=? WHERE id=?')
            .run(cat.name_en, cat.icon, cat.sort_order, cat.active, existingByName.id);
          catMap.set(cat.id, existingByName.id);
          importedCatNames.add(cat.name);
          importedCategories++;
        } else {
          // Insert new category
          const info = db.prepare('INSERT INTO categories (name, name_en, icon, sort_order, active) VALUES (?,?,?,?,?)')
            .run(cat.name, cat.name_en, cat.icon, cat.sort_order, cat.active);
          catMap.set(cat.id, info.lastInsertRowid);
          importedCatNames.add(cat.name);
          importedCategories++;
        }
      } catch (e) {
        errors.push(`Category "${cat.name}": ${e.message}`);
      }
    }

    // Import items
    for (const item of data.items) {
      try {
        const newCategoryId = item.category_id ? (catMap.get(item.category_id) || item.category_id) : null;
        const existing = item.id ? db.prepare('SELECT id FROM items WHERE id=?').get(item.id) : null;
        if (existing) {
          db.prepare(`UPDATE items SET name=?, name_en=?, category_id=?, price=?, price2=?,
            cost_price=?, image=?, barcode=?, sku=?, sort_order=?, active=? WHERE id=?`)
            .run(item.name, item.name_en, newCategoryId, item.price, item.price2,
              item.cost_price, item.image, item.barcode, item.sku, item.sort_order, item.active, item.id);
        } else {
          db.prepare(`INSERT INTO items (name, name_en, category_id, price, price2,
            cost_price, image, barcode, sku, sort_order, active) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
            .run(item.name, item.name_en, newCategoryId, item.price, item.price2,
              item.cost_price, item.image, item.barcode, item.sku, item.sort_order, item.active);
        }
        importedItems++;
      } catch (e) {
        errors.push(`Item "${item.name}": ${e.message}`);
      }
    }

    // Import modifiers
    for (const mod of data.modifiers) {
      try {
        const existing = mod.id ? db.prepare('SELECT id FROM modifiers WHERE id=?').get(mod.id) : null;
        if (existing) {
          db.prepare(`UPDATE modifiers SET group_name=?, group_name_en=?, name=?, name_en=?,
            price_extra=?, active=? WHERE id=?`)
            .run(mod.group_name, mod.group_name_en, mod.name, mod.name_en,
              mod.price_extra, mod.active, mod.id);
        } else {
          db.prepare(`INSERT INTO modifiers (group_name, group_name_en, name, name_en,
            price_extra, active) VALUES (?,?,?,?,?,?)`)
            .run(mod.group_name, mod.group_name_en, mod.name, mod.name_en,
              mod.price_extra, mod.active);
        }
        importedModifiers++;
      } catch (e) {
        errors.push(`Modifier "${mod.name}": ${e.message}`);
      }
    }
  });

  importTransaction();

  res.json({
    ok: errors.length === 0,
    categories: importedCategories,
    items: importedItems,
    modifiers: importedModifiers,
    errors
  });
  } catch (err) {
    console.error('[Menu Import Error]', err);
    res.status(500).json({ error: `خطأ في معالجة الملف: ${err.message}` });
  }
});

module.exports = router;
