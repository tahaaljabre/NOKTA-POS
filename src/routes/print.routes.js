const express = require('express');
const router = express.Router();
const printService = require('../services/print.service');
const { requireAuthenticated, requirePermission } = require('../middleware/auth.middleware');

// GET /api/print/scan
// Scans for available printers (USB, Network, Bluetooth)
router.get('/scan', requireAuthenticated, requirePermission('manage_settings'), async (req, res) => {
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
router.post('/test', requireAuthenticated, requirePermission('manage_settings'), async (req, res) => {
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

module.exports = router;
