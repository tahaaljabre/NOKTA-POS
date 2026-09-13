const express = require('express');
const router = express.Router();
const printService = require('../services/print.service');
const { requireAuthenticated, requirePermission } = require('../middleware/auth.middleware');
const { getOrder } = require('../services/orders.service');

function requireOrderAccess(req, res, next) {
  const order = getOrder(req.params.id);
  if (req.currentUser.role === 'admin') { req.order = order; return next(); }
  const ownsOrder = req.currentUser.cashier_code
    ? order.cashier_code === req.currentUser.cashier_code
    : order.employee_id === req.currentUser.id;
  if (!ownsOrder) return res.status(403).json({ error: 'الفاتورة تخص موظفاً آخر / Invoice belongs to another employee' });
  req.order = order;
  next();
}

// GET /api/print/scan
// Scans for available printers (USB, Network, Bluetooth)
router.get('/scan', requireAuthenticated, requirePermission('settings'), async (req, res) => {
  try {
    const printers = await printService.scanPrinters();
    res.json(printers);
  } catch (error) {
    console.error('Error scanning printers:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء البحث عن الطابعات' });
  }
});

// POST /api/print/test
// Tests a printer connection by printing a test page
router.post('/test', requireAuthenticated, requirePermission('settings'), async (req, res) => {
  try {
    const { config } = req.body;
    if (!config) {
      return res.status(400).json({ error: 'إعدادات الطابعة مطلوبة' });
    }

    const { testPrinter } = require('../services/print.service');
    await testPrinter(config);
    
    return res.json({ success: true, message: 'تم إرسال أمر الطباعة التجريبي بنجاح' });
  } catch (error) {
    console.error('Error testing printer:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء اختبار الطابعة' });
  }
});

// POST /api/print/invoice/:id
// Prints a cashier receipt via ESC/POS on the server
router.post('/invoice/:id', requirePermission('pos'), requireOrderAccess, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[PRINT] Invoice #${id} requested by ${req.currentUser.name}`);
    await printService.printInvoice(id);
    console.log(`[PRINT] Invoice #${id} printed successfully`);
    return res.json({ success: true });
  } catch (error) {
    console.error(`[PRINT] Invoice #${id} FAILED:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/print/kitchen/:id
// Prints kitchen tickets via ESC/POS on the server
router.post('/kitchen/:id', requirePermission('kitchen'), requireOrderAccess, async (req, res) => {
  try {
    const { id } = req.params;
    await printService.printKitchen(id);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error printing kitchen:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
