const router = require('express').Router();
const { db } = require('../database/db');
const { requireAdmin } = require('../middleware/auth.middleware');
const { createMenuExportWorkbook, parseMenuImportWorkbook } = require('../services/menu-excel.service');

router.use(requireAdmin);

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
  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: 'ملف مطلوب / File required' });
  }

  const file = req.files.file;
  if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    return res.status(400).json({ error: 'الملف يجب أن يكون Excel (.xlsx) / File must be Excel (.xlsx)' });
  }

  const data = await parseMenuImportWorkbook(file.data);

  let importedCategories = 0, importedItems = 0, importedModifiers = 0;
  const errors = [];

  const importTransaction = db.transaction(() => {
    // Import categories
    const catMap = new Map(); // old_id -> new_id
    for (const cat of data.categories) {
      try {
        const existing = cat.id ? db.prepare('SELECT id FROM categories WHERE id=?').get(cat.id) : null;
        if (existing) {
          db.prepare('UPDATE categories SET name=?, name_en=?, icon=?, sort_order=?, active=? WHERE id=?')
            .run(cat.name, cat.name_en, cat.icon, cat.sort_order, cat.active, cat.id);
          catMap.set(cat.id, cat.id);
        } else {
          const info = db.prepare('INSERT INTO categories (name, name_en, icon, sort_order, active) VALUES (?,?,?,?,?)')
            .run(cat.name, cat.name_en, cat.icon, cat.sort_order, cat.active);
          catMap.set(cat.id, info.lastInsertRowid);
        }
        importedCategories++;
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
});

module.exports = router;
