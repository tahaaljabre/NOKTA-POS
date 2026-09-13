const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { requireAuthenticated, requirePermission } = require('../middleware/auth.middleware');
const { logAudit: writeAudit } = require('../middleware/audit.middleware');
const getDb = () => db;
function cashierIdOrNull(value) {
  if (value === '' || value == null) return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0 || !db.prepare('SELECT id FROM cashiers WHERE id=? AND active=1').get(id)) {
    throw new Error('الكاشير المحدد غير صالح');
  }
  return id;
}
function logAudit(entry) {
  writeAudit(entry.employeeId, entry.employeeName, entry.action, entry.entity,
    entry.entityId, entry.details, entry.oldValue, entry.newValue);
}
router.use(requireAuthenticated, (req, res, next) => { req.user = req.currentUser; next(); });
router.get('/stats/summary', requirePermission('manage_suppliers'), (req, res) => {
  try {
    const stats = db.prepare(`SELECT COUNT(*) total_suppliers, COALESCE(SUM(total_purchases),0) all_purchases,
      COALESCE(SUM(total_payments),0) all_payments, COALESCE(SUM(current_balance),0) total_balance FROM suppliers`).get();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching supplier summary:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب ملخص الموردين' });
  }
});

// ==================== SUPPLIERS CRUD ====================

// GET /api/suppliers - Get all suppliers
router.get('/', requirePermission('manage_suppliers'), async (req, res) => {
  try {
    const db = getDb();
    const suppliers = db.prepare(`
      SELECT * FROM suppliers 
      ORDER BY name ASC
    `).all();
    
    res.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الموردين' });
  }
});

// GET /api/suppliers/:id - Get single supplier with full details
router.get('/:id', requirePermission('manage_suppliers'), async (req, res) => {
  try {
    const db = getDb();
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    
    if (!supplier) {
      return res.status(404).json({ error: 'المورد غير موجود' });
    }
    
    // Get summary statistics
    const stats = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN transaction_type = 'purchase' THEN amount ELSE 0 END), 0) as total_purchases,
        COALESCE(SUM(CASE WHEN transaction_type = 'payment' THEN amount ELSE 0 END), 0) as total_payments,
        COUNT(CASE WHEN transaction_type = 'purchase' THEN 1 END) as purchase_count,
        COUNT(CASE WHEN transaction_type = 'payment' THEN 1 END) as payment_count
      FROM supplier_transactions
      WHERE supplier_id = ?
    `).get(req.params.id);
    
    res.json({ ...supplier, stats });
  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات المورد' });
  }
});

// POST /api/suppliers - Create new supplier
router.post('/', requireAuthenticated, requirePermission('manage_suppliers'), async (req, res) => {
  try {
    const db = getDb();
    const {
      code, name, name_en, company_name, company_name_en, tax_number, commercial_registration, cashier_id,
      phone, email, address, city, country, payment_terms, credit_limit, opening_balance,
      category, contact_person, contact_phone, bank_name, bank_account, iban, notes
    } = req.body;
    
    // Validate required fields
    if (!code || !String(name).trim()) {
      return res.status(400).json({ error: 'الكود والاسم مطلوبان' });
    }
    
    // Check if code already exists
    const existing = db.prepare('SELECT id FROM suppliers WHERE code = ?').get(code);
    if (existing) {
      return res.status(400).json({ error: 'كود المورد موجود مسبقاً' });
    }
    
    // Insert supplier
    const assignedCashier = cashierIdOrNull(cashier_id);
    const result = db.prepare(`
      INSERT INTO suppliers (
        code, name, name_en, company_name, company_name_en, tax_number, commercial_registration,
        phone, email, address, city, country, payment_terms, credit_limit, opening_balance,
        current_balance, category, contact_person, contact_phone, bank_name, bank_account, 
        iban, notes, created_by, cashier_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code, name, name_en || '', company_name || '', company_name_en || '', tax_number || '', 
      commercial_registration || '', phone || '', email || '', address || '', city || '', 
      country || 'Saudi Arabia', payment_terms || 30, credit_limit || 0, opening_balance || 0,
      opening_balance || 0, category || 'general', contact_person || '', contact_phone || '',
      bank_name || '', bank_account || '', iban || '', notes || '', req.user.id, assignedCashier
    );
    
    // Log audit
    logAudit({
      employeeId: req.user.id,
      employeeName: req.user.name,
      action: 'create_supplier',
      entity: 'supplier',
      entityId: result.lastInsertRowid,
      details: `أضاف مورد جديد: ${name}`,
      newValue: JSON.stringify({ code, name, opening_balance })
    });
    
    res.json({ 
      success: true, 
      id: result.lastInsertRowid,
      message: 'تم إضافة المورد بنجاح' 
    });
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(400).json({ error: error.message || 'حدث خطأ أثناء إضافة المورد' });
  }
});

// PUT /api/suppliers/:id - Update supplier
router.put('/:id', requireAuthenticated, requirePermission('manage_suppliers'), async (req, res) => {
  try {
    const db = getDb();
    const supplierId = req.params.id;
    
    // Get old values for audit
    const oldSupplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
    if (!oldSupplier) {
      return res.status(404).json({ error: 'المورد غير موجود' });
    }
    
    const {
      code, name, name_en, company_name, company_name_en, tax_number, commercial_registration, cashier_id,
      phone, email, address, city, country, payment_terms, credit_limit,
      category, contact_person, contact_phone, bank_name, bank_account, iban, notes, active
    } = req.body;
    
    // Update supplier
    const assignedCashier = cashierIdOrNull(cashier_id);
    db.prepare(`
      UPDATE suppliers SET
        code = ?, name = ?, name_en = ?, company_name = ?, company_name_en = ?, 
        tax_number = ?, commercial_registration = ?, phone = ?, email = ?, address = ?, 
        city = ?, country = ?, payment_terms = ?, credit_limit = ?, category = ?,
        contact_person = ?, contact_phone = ?, bank_name = ?, bank_account = ?, 
        iban = ?, notes = ?, active = ?, cashier_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      code, name, name_en || '', company_name || '', company_name_en || '',
      tax_number || '', commercial_registration || '', phone || '', email || '', 
      address || '', city || '', country || 'Saudi Arabia', payment_terms || 30,
      credit_limit || 0, category || 'general', contact_person || '', contact_phone || '',
      bank_name || '', bank_account || '', iban || '', notes || '', 
      active !== undefined ? active : oldSupplier.active, assignedCashier, supplierId
    );
    
    // Log audit
    logAudit({
      employeeId: req.user.id,
      employeeName: req.user.name,
      action: 'update_supplier',
      entity: 'supplier',
      entityId: supplierId,
      details: `عدّل بيانات المورد: ${name}`,
      oldValue: JSON.stringify(oldSupplier),
      newValue: JSON.stringify(req.body)
    });
    
    res.json({ success: true, message: 'تم تحديث بيانات المورد بنجاح' });
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(400).json({ error: error.message || 'حدث خطأ أثناء تحديث المورد' });
  }
});

// DELETE /api/suppliers/:id - Soft delete supplier
router.delete('/:id', requireAuthenticated, requirePermission('manage_suppliers'), async (req, res) => {
  try {
    const db = getDb();
    const supplier = db.prepare('SELECT name FROM suppliers WHERE id = ?').get(req.params.id);
    
    if (!supplier) {
      return res.status(404).json({ error: 'المورد غير موجود' });
    }
    
    // Soft delete
    db.prepare('UPDATE suppliers SET active = 0, updated_at = datetime(\'now\') WHERE id = ?')
      .run(req.params.id);
    
    // Log audit
    logAudit({
      employeeId: req.user.id,
      employeeName: req.user.name,
      action: 'delete_supplier',
      entity: 'supplier',
      entityId: req.params.id,
      details: `حذف المورد: ${supplier.name}`
    });
    
    res.json({ success: true, message: 'تم حذف المورد بنجاح' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف المورد' });
  }
});

// ==================== SUPPLIER ACCOUNT STATEMENT ====================

// GET /api/suppliers/:id/statement - Get supplier account statement
router.get('/:id/statement', requirePermission('manage_suppliers'), async (req, res) => {
  try {
    const db = getDb();
    const { from, to } = req.query;
    
    // Get supplier
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!supplier) {
      return res.status(404).json({ error: 'المورد غير موجود' });
    }
    
    // Build query with optional date filter
    let query = `
      SELECT * FROM supplier_transactions 
      WHERE supplier_id = ?
    `;
    const params = [req.params.id];
    
    if (from) {
      query += ' AND transaction_date >= ?';
      params.push(from);
    }
    if (to) {
      query += ' AND transaction_date <= ?';
      params.push(to);
    }
    
    query += ' ORDER BY transaction_date DESC, id DESC';
    
    const transactions = db.prepare(query).all(...params);
    
    // Calculate balance
    let runningBalance = supplier.opening_balance;
    const transactionsWithBalance = transactions.map(t => {
      if (t.transaction_type === 'purchase') {
        runningBalance += t.amount;
      } else if (t.transaction_type === 'payment') {
        runningBalance -= t.amount;
      }
      return { ...t, balance: runningBalance };
    }).reverse();
    
    res.json({
      supplier,
      transactions: transactionsWithBalance,
      summary: {
        opening_balance: supplier.opening_balance,
        total_purchases: supplier.total_purchases,
        total_payments: supplier.total_payments,
        current_balance: supplier.current_balance
      }
    });
  } catch (error) {
    console.error('Error fetching supplier statement:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب كشف الحساب' });
  }
});

// ==================== PURCHASES ====================

// POST /api/suppliers/:id/purchases - Create new purchase
router.post('/:id/purchases', requireAuthenticated, requirePermission('manage_purchases'), async (req, res) => {
  try {
    const db = getDb();
    const supplierId = req.params.id;
    const {
      purchase_date, invoice_number, delivery_date, warehouse,
      items, payment_method, notes
    } = req.body;
    const mode = req.body.mode === 'quick' ? 'quick' : 'detailed';
    const money = value => Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) / 100 : NaN;
    let normalizedItems;
    let subtotal, tax_amount, discount_amount, shipping_cost, total_amount;
    if (mode === 'quick') {
      total_amount = money(req.body.quick_total);
      const description = String(req.body.quick_description || '').trim();
      if (!description || description.length > 200 || !Number.isFinite(total_amount) || total_amount <= 0) {
        return res.status(400).json({ error: 'أدخل وصف الفاتورة ومبلغاً صحيحاً' });
      }
      normalizedItems = [{ name: description, quantity: 1, unit_price: total_amount, total: total_amount }];
      subtotal = total_amount;
      tax_amount = discount_amount = shipping_cost = 0;
    } else {
      if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
        return res.status(400).json({ error: 'أدخل أصناف الفاتورة' });
      }
      normalizedItems = items.map(item => {
        const name = String(item.name || '').trim();
        const quantity = Number(item.quantity);
        const unitPrice = money(item.unit_price);
        if (!name || name.length > 200 || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) return null;
        return { name, quantity, unit: String(item.unit || 'unit').slice(0, 20), unit_price: unitPrice, total: money(quantity * unitPrice) };
      });
      if (normalizedItems.includes(null)) return res.status(400).json({ error: 'بيانات أصناف الفاتورة غير صحيحة' });
      subtotal = money(normalizedItems.reduce((sum, item) => sum + item.total, 0));
      tax_amount = money(req.body.tax_amount || 0);
      discount_amount = money(req.body.discount_amount || 0);
      shipping_cost = money(req.body.shipping_cost || 0);
      total_amount = money(subtotal + tax_amount - discount_amount + shipping_cost);
      if ([tax_amount, discount_amount, shipping_cost].some(value => !Number.isFinite(value) || value < 0) || total_amount <= 0) {
        return res.status(400).json({ error: 'المبالغ في الفاتورة غير صحيحة' });
      }
    }
    const paid_amount = money(req.body.paid_amount || 0);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(purchase_date || '')) || !Number.isFinite(paid_amount) || paid_amount < 0 || paid_amount > total_amount) {
      return res.status(400).json({ error: 'تاريخ الفاتورة أو المبلغ المدفوع غير صحيح' });
    }
    if (!db.prepare('SELECT id FROM suppliers WHERE id=? AND active=1').get(supplierId)) {
      return res.status(404).json({ error: 'المورد غير موجود' });
    }
    
    // Generate purchase number
    const lastPurchase = db.prepare(`
      SELECT purchase_number FROM supplier_purchases 
      ORDER BY id DESC LIMIT 1
    `).get();
    
    let purchaseNumber = 'PUR-0001';
    if (lastPurchase) {
      const lastNum = parseInt(lastPurchase.purchase_number.split('-')[1]);
      purchaseNumber = `PUR-${String(lastNum + 1).padStart(4, '0')}`;
    }
    
    const remaining = total_amount - (paid_amount || 0);
    const paymentStatus = remaining <= 0 ? 'paid' : (paid_amount > 0 ? 'partial' : 'pending');
    
    // Start transaction
    const insertPurchase = db.transaction(() => {
      // Insert purchase
      const result = db.prepare(`
        INSERT INTO supplier_purchases (
          supplier_id, purchase_number, purchase_date, invoice_number, delivery_date,
          warehouse, subtotal, tax_amount, discount_amount, shipping_cost, total_amount,
          paid_amount, remaining_amount, payment_status, items_json, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        supplierId, purchaseNumber, purchase_date, invoice_number || '', delivery_date || null,
        warehouse || 'main', subtotal || 0, tax_amount || 0, discount_amount || 0,
        shipping_cost || 0, total_amount, paid_amount || 0, remaining, paymentStatus,
        JSON.stringify(normalizedItems), notes || '', req.user.id
      );
      
      const purchaseId = result.lastInsertRowid;
      
      // Insert transaction for purchase
      db.prepare(`
        INSERT INTO supplier_transactions (
          supplier_id, transaction_type, transaction_number, transaction_date,
          amount, reference_number, description, created_by
        ) VALUES (?, 'purchase', ?, ?, ?, ?, ?, ?)
      `).run(
        supplierId, purchaseNumber, purchase_date, total_amount,
        invoice_number || '', `فاتورة مشتريات #${purchaseNumber}`, req.user.id
      );
      
      // If paid amount, insert payment transaction
      if (paid_amount > 0) {
        const paymentNumber = `PAY-${purchaseNumber}`;
        db.prepare(`
          INSERT INTO supplier_transactions (
            supplier_id, transaction_type, transaction_number, transaction_date,
            amount, payment_method, reference_number, description, created_by
          ) VALUES (?, 'payment', ?, ?, ?, ?, ?, ?, ?)
        `).run(
          supplierId, paymentNumber, purchase_date, paid_amount,
          payment_method || 'cash', invoice_number || '',
          `دفعة من فاتورة #${purchaseNumber}`, req.user.id
        );
      }
      
      // Update supplier balance
      db.prepare(`
        UPDATE suppliers SET
          current_balance = current_balance + ?,
          total_purchases = total_purchases + ?,
          total_payments = total_payments + ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(remaining, total_amount, paid_amount || 0, supplierId);
      
      return purchaseId;
    });
    
    const purchaseId = insertPurchase();
    
    // Log audit
    logAudit({
      employeeId: req.user.id,
      employeeName: req.user.name,
      action: 'create_purchase',
      entity: 'supplier_purchase',
      entityId: purchaseId,
      details: `سجّل مشتريات #${purchaseNumber} بقيمة ${total_amount}`,
      newValue: JSON.stringify({ purchaseNumber, total_amount, paid_amount })
    });
    
    res.json({
      success: true,
      id: purchaseId,
      purchase_number: purchaseNumber,
      message: 'تم تسجيل المشتريات بنجاح'
    });
  } catch (error) {
    console.error('Error creating purchase:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل المشتريات' });
  }
});

// GET /api/suppliers/:id/purchases - Get supplier purchases
router.get('/:id/purchases', requirePermission('manage_purchases'), async (req, res) => {
  try {
    const db = getDb();
    const purchases = db.prepare(`
      SELECT * FROM supplier_purchases
      WHERE supplier_id = ?
      ORDER BY purchase_date DESC
    `).all(req.params.id);
    
    res.json(purchases);
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب المشتريات' });
  }
});

// ==================== PAYMENTS (سندات الصرف) ====================

// POST /api/suppliers/:id/payments - Create payment voucher
router.post('/:id/payments', requirePermission('manage_payments'), async (req, res) => {
  try {
    const db = getDb();
    const supplierId = req.params.id;
    const {
      payment_date, amount, payment_method, check_number, bank_name,
      reference_number, notes, received_by
    } = req.body;
    
    // Validate
    const numericAmount = Number(amount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(payment_date || '')) || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'بيانات السند غير صحيحة' });
    }
    
    // Get supplier
    const supplier = db.prepare('SELECT name, current_balance, cashier_id FROM suppliers WHERE id = ? AND active=1').get(supplierId);
    if (!supplier) {
      return res.status(404).json({ error: 'المورد غير موجود' });
    }
    const assigned = supplier.cashier_id && db.prepare('SELECT code FROM cashiers WHERE id=? AND active=1').get(supplier.cashier_id);
    const canPay = req.user.role === 'admin' || req.user.permissions.manage_payments ||
      (assigned && assigned.code === req.user.cashier_code);
    if (!canPay) return res.status(403).json({ error: 'هذا المورد غير مرتبط بالكاشير الحالي' });
    
    // Generate payment number
    const lastPayment = db.prepare(`
      SELECT payment_number FROM supplier_payments 
      ORDER BY id DESC LIMIT 1
    `).get();
    
    let paymentNumber = 'SPAY-0001';
    if (lastPayment) {
      const lastNum = parseInt(lastPayment.payment_number.split('-')[1]);
      paymentNumber = `SPAY-${String(lastNum + 1).padStart(4, '0')}`;
    }
    
    // Start transaction
    const insertPayment = db.transaction(() => {
      // Insert payment
      const result = db.prepare(`
        INSERT INTO supplier_payments (
          supplier_id, payment_number, payment_date, amount, payment_method,
          check_number, bank_name, reference_number, notes, received_by, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        supplierId, paymentNumber, payment_date, amount, payment_method || 'cash',
        check_number || '', bank_name || '', reference_number || '', notes || '',
        received_by || '', req.user.id
      );
      
      const paymentId = result.lastInsertRowid;
      
      // Insert transaction
      db.prepare(`
        INSERT INTO supplier_transactions (
          supplier_id, transaction_type, transaction_number, transaction_date,
          amount, payment_method, reference_number, description, created_by
        ) VALUES (?, 'payment', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        supplierId, paymentNumber, payment_date, amount, payment_method || 'cash',
        reference_number || '', `سند صرف #${paymentNumber} - ${supplier.name}`, req.user.id
      );
      
      // Update supplier balance
      db.prepare(`
        UPDATE suppliers SET
          current_balance = current_balance - ?,
          total_payments = total_payments + ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(amount, amount, supplierId);
      
      return paymentId;
    });
    
    const paymentId = insertPayment();
    
    // Log audit
    logAudit({
      employeeId: req.user.id,
      employeeName: req.user.name,
      action: 'create_supplier_payment',
      entity: 'supplier_payment',
      entityId: paymentId,
      details: `سجّل سند صرف #${paymentNumber} بقيمة ${amount} للمورد: ${supplier.name}`,
      newValue: JSON.stringify({ paymentNumber, amount, payment_method })
    });
    
    res.json({
      success: true,
      id: paymentId,
      payment_number: paymentNumber,
      message: 'تم تسجيل سند الصرف بنجاح'
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل سند الصرف' });
  }
});

// GET /api/suppliers/:id/payments - Get supplier payments
router.get('/:id/payments', requirePermission('manage_payments'), async (req, res) => {
  try {
    const db = getDb();
    const payments = db.prepare(`
      SELECT * FROM supplier_payments
      WHERE supplier_id = ?
      ORDER BY payment_date DESC
    `).all(req.params.id);
    
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب سندات الصرف' });
  }
});

// GET /api/suppliers/stats/summary - Get overall suppliers statistics
router.get('/stats/summary', requireAuthenticated, async (req, res) => {
  try {
    const db = getDb();
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_suppliers,
        COUNT(CASE WHEN active = 1 THEN 1 END) as active_suppliers,
        COALESCE(SUM(current_balance), 0) as total_balance,
        COALESCE(SUM(total_purchases), 0) as all_purchases,
        COALESCE(SUM(total_payments), 0) as all_payments
      FROM suppliers
    `).get();
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching supplier stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الإحصائيات' });
  }
});

module.exports = router;
