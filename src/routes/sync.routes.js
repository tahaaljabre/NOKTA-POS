const router = require('express').Router();
const { db } = require('../database/db');
const { requirePermission } = require('../middleware/auth.middleware');
const { createOrder, error, text } = require('../services/orders.service');
const { emitEvent } = require('../socket/socket.handler');

router.use(requirePermission('pos'));

// Full sync — download all data for offline use
router.get('/full', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories WHERE active=1').all();
  const items = db.prepare('SELECT * FROM items WHERE active=1').all();
  const modifiers = db.prepare('SELECT * FROM modifiers WHERE active=1').all();
  const item_modifiers = db.prepare('SELECT * FROM item_modifiers').all();

  let settingsRows;
  try {
    settingsRows = db.prepare('SELECT key, value FROM settings WHERE key IN (?)').all([
      'tax_rate', 'tax_type', 'currency', 'currency_position', 'restaurant_name',
      'restaurant_address', 'restaurant_phone', 'tax_number', 'footer_text',
      'receipt_width', 'business_timezone', 'printer_ip', 'printer_port',
      'android_printer', 'android_printer_size'
    ]);
  } catch (e) {
    settingsRows = db.prepare('SELECT key, value FROM settings').all();
  }
  const settings = {};
  for (const r of settingsRows) settings[r.key] = r.value;

  const tables_pos = db.prepare('SELECT * FROM "tables" WHERE (is_deleted=0 OR is_deleted IS NULL)').all();
  const cashiers = db.prepare('SELECT * FROM cashiers WHERE active=1').all();

  res.json({
    ok: true,
    categories,
    items,
    modifiers,
    item_modifiers,
    settings,
    tables_pos,
    cashiers,
    server_time: new Date().toISOString()
  });
});

// Incremental sync — download all active data (client handles deduplication)
router.get('/changes', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories').all();
  const items = db.prepare('SELECT * FROM items').all();
  const modifiers = db.prepare('SELECT * FROM modifiers').all();
  const tables_pos = db.prepare('SELECT * FROM "tables"').all();
  const cashiers = db.prepare('SELECT * FROM cashiers').all();

  res.json({
    ok: true,
    categories,
    items,
    modifiers,
    tables_pos,
    cashiers,
    server_time: Date.now()
  });
});

// Upload offline orders (backward compatible: POST / and POST /upload both work)
const uploadHandler = (req, res) => {
  const { orders, device_id } = req.body || {};
  if (!Array.isArray(orders) || orders.length > 100) {
    throw error('دفعة غير صالحة؛ الحد 100 طلب / Invalid batch; maximum 100 orders');
  }
  const syncedOrders = [], failedOrders = [];
  for (const input of orders) {
    try {
      if (!input.offline_id) throw error('معرف الطلب مطلوب / Request ID required');
      if (input.employee_id && Number(input.employee_id) !== req.currentUser.id) {
        throw error('أعد الدخول بحساب صاحب الطلب / Sign in as the order owner', 403);
      }
      const saved = createOrder({ ...input, status: input.status || 'completed' }, req.currentUser);
      syncedOrders.push({ ...saved, offline_id: input.offline_id, print_required: !saved.already_synced });
    } catch (e) {
      failedOrders.push({
        offline_id: input?.offline_id || null,
        error: e.status ? e.message : 'تعذر حفظ الطلب / Could not save order',
        status: e.status || 500
      });
    }
  }
  db.prepare("INSERT INTO sync_log(device_id, last_sync) VALUES (?, datetime('now'))").run(text(device_id || 'unknown', 128));
  if (syncedOrders.length) {
    emitEvent('order:updated', {});
    emitEvent('table:updated', {});
  }
  res.json({
    ok: failedOrders.length === 0,
    synced: syncedOrders.length,
    syncedOrders,
    failedOrders,
    server_time: new Date().toISOString()
  });
};

router.post('/', uploadHandler);
router.post('/upload', uploadHandler);

module.exports = router;
