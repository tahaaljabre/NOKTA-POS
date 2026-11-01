const router = require('express').Router();
const { db } = require('../database/db');
const { requireAdmin } = require('../middleware/auth.middleware');
const { logAudit } = require('../middleware/audit.middleware');
const config = require('../config/app.config');
const path = require('path');
const os = require('os');
const fs = require('fs');
const multer = require('multer');
const { createDatabaseBackup } = require('../services/automatic-backup');

const upload = multer({
  dest: path.join(os.tmpdir(), 'nokta-uploads'),
  limits: { fileSize: 500 * 1024 * 1024 }
});
// Every table the application owns, parents before children so the restore can insert in order
// (deletion walks the same list in reverse). The supplier, expense and HR/attendance tables were
// missing, so a "full" backup silently lost supplier balances, purchase invoices, payment vouchers,
// expenses and the whole attendance history while still restoring orders that reference
// cashier_code values with no cashiers row behind them.
const TABLES = [
  'employees','cashiers','suppliers',
  'categories','items','modifiers','item_modifiers','table_zones','tables','customers',
  'orders','order_items','shifts','inventory','stock_logs','daily_closings','discounts_coupons',
  'supplier_transactions','supplier_purchases','supplier_payments','shop_expenses',
  'hr_employees','attendance_records','biometric_devices',
  'audit_log','settings','sync_log'
];
router.use(requireAdmin);
const fail = message => Object.assign(new Error(message), {status:400});
router.get('/export', (req,res) => {
  if (req.query.type && !['all','orders'].includes(req.query.type)) throw fail('نوع النسخة غير صالح / Invalid backup type');
  const type = req.query.type === 'orders' ? 'orders' : 'full';
  const snapshot = db.transaction(() => {
    const result = {version:2,type,exported_at:new Date().toISOString()};
    for (const table of type==='full' ? TABLES : ['orders','order_items']) result[table]=db.prepare('SELECT * FROM "'+table+'"').all();
    return result;
  })();
  res.setHeader('Cache-Control','no-store');
  res.json(snapshot);
});
router.get('/database', (req, res, next) => {
  const backupDir = config.dbPath === ':memory:'
    ? path.join(os.tmpdir(), 'nokta-pos-test-backups')
    : path.join(config.dbDir, 'backups', 'manual');
  try {
    const file = createDatabaseBackup(db.getRawDb(), backupDir, { prefix: 'nokta-pos-full-' });
    logAudit(req.currentUser.id, req.currentUser.name, 'backup_database', 'backup', 0, 'Created full SQLite database backup');
    res.setHeader('Cache-Control', 'no-store');
    res.download(file, path.basename(file));
  } catch (error) {
    next(error);
  }
});
router.post('/restore',(req,res,next) => {
  try {
    const data=req.body;
    if (!data || !['orders','full'].includes(data.type)) throw fail('ملف النسخة غير صالح / Invalid backup file');
    if (data.type==='full' && data.version!==2) throw fail('النسخة القديمة غير مكتملة؛ يلزم ترحيلها قبل الاستعادة / Legacy full backup requires migration');
  const names=data.type==='full'?TABLES:['orders','order_items'];
  // A backup exported before the supplier/expense/HR tables were included simply does not carry them.
  // Such a file must still restore: absent tables are skipped and their current rows are left
  // untouched, rather than being wiped or rejecting the whole restore.
  const present=names.filter(name=>data[name]!==undefined);
  const operations=[];
  for (const name of names) {
    if (data[name]===undefined) continue;
    if (!Array.isArray(data[name]) || data[name].length>50000) throw fail('جدول النسخة غير صالح / Invalid backup table: '+name);
    const columns=db.prepare('PRAGMA table_info("'+name+'")').all();
    const allowed=new Map(columns.map(c=>[c.name,c]));
    for (const row of data[name]) {
      if (!row || typeof row!=='object' || Array.isArray(row)) throw fail('سجل نسخة غير صالح / Invalid backup row');
      if(data.version===2 && columns.some(c=>!(c.name in row))) throw fail('حقول ناقصة / Missing fields: '+name);
      for (const [key,value] of Object.entries(row)) {
        const col=allowed.get(key);
        if(!col) throw fail('حقل غير معروف / Unknown field: '+name+'.'+key);
        if(value===null) {if(col.notnull) throw fail('قيمة مطلوبة / Required value: '+name+'.'+key);continue;}
        if (/INT|REAL|NUM/i.test(col.type) && (typeof value!=='number' || !Number.isFinite(value))) throw fail('رقم غير صالح / Invalid number: '+key);
        if (!/INT|REAL|NUM/i.test(col.type) && typeof value!=='string') throw fail('نص غير صالح / Invalid text: '+key);
      }
      const keys=Object.keys(row);
      if(!keys.length) throw fail('سجل فارغ / Empty record');
      operations.push({name,keys,row});
    }
  }
  if (data.orders && data.order_items) {
    const ids=new Set(data.orders.map(o=>o.id));
    if(data.order_items.some(i=>!ids.has(i.order_id))) throw fail('عنصر دون فاتورة / Orphan order item');
  }
  if(data.type==='full' && !(data.employees||[]).some(e=>e.role==='admin' && e.active===1 && e.pin)) throw fail('يلزم مدير نشط في النسخة / Backup needs an active administrator');
  // Rows are replaced table by table, so intermediate states are necessarily inconsistent (a child
  // table can be emptied before its parent is refilled). Enforcement is suspended for the duration
  // and the result is verified before committing: PRAGMA foreign_key_check runs inside the
  // transaction, so a backup with broken references rolls back instead of being accepted.
  db.exec('PRAGMA foreign_keys = OFF');
  try {
  db.transaction(()=>{
    for(const name of [...present].reverse()) db.prepare('DELETE FROM "'+name+'"').run();
    for(const {name,keys,row} of operations) db.prepare('INSERT INTO "'+name+'" ('+keys.map(k=>'"'+k+'"').join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')').run(...keys.map(k=>row[k]));
    const max=db.prepare('SELECT COALESCE(MAX(invoice_number),0) n FROM orders').get().n;
    db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('next_invoice_number',?)").run(String(max+1));
    db.prepare('UPDATE "tables" SET status=\'empty\',current_order_id=NULL').run();
    const active=db.prepare("SELECT id,table_id FROM orders WHERE status='active' AND is_deleted=0 AND table_id IS NOT NULL ORDER BY id").all();
    const seen=new Set();
    for(const order of active) {
      if(seen.has(order.table_id)) throw fail('طلبات متعددة لطاولة واحدة في النسخة / Conflicting table orders in backup');
      seen.add(order.table_id);
      db.prepare('UPDATE "tables" SET status=\'occupied\',current_order_id=? WHERE id=?').run(order.id,order.table_id);
    }
    const violations=db.prepare('PRAGMA foreign_key_check').all();
    if(violations.length) throw fail('مراجع مكسورة في النسخة / Backup has broken references: '+violations.slice(0,5).map(v=>v.table+'#'+v.rowid+'->'+v.parent).join(', '));
    logAudit(req.currentUser.id,req.currentUser.name,'restore','backup',0,'Restored '+data.type+' backup');
  })();
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
  res.json({success:true,message:'تمت الاستعادة / Restore completed'});
  } catch (error) {
    console.error('[Restore Error]', error.message, error.stack);
    next(error);
  }
});

router.post('/restore-database', upload.single('file'), (req, res, next) => {
  let uploadPath;
  try {
    if (!req.file) throw fail('لم يتم رفع ملف / No file uploaded');
    uploadPath = req.file.path;
    
    if (config.dbPath === ':memory:') {
      throw fail('استعادة قاعدة البيانات غير متاحة في وضع الاختبار / Database restore not available in test mode');
    }

    const backupPath = path.join(config.dbDir, 'backups', 'before-restore-' + Date.now() + '.sqlite');
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    createDatabaseBackup(db.getRawDb(), path.dirname(backupPath), { prefix: 'before-restore-' });

    const { DatabaseSync } = require('node:sqlite');
    // readOnly (camelCase) is the name this Node version honours; 'readonly' is accepted and ignored,
    // which would have validated the uploaded file with write access. node:sqlite is the driver the
    // whole application already uses; better-sqlite3 is not a dependency of this project.
    let testDb;
    try {
      testDb = new DatabaseSync(uploadPath, { readOnly: true });
      const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
      const tableNames = tables.map(t => t.name);
      const requiredTables = ['employees', 'settings', 'orders'];
      const missing = requiredTables.filter(t => !tableNames.includes(t));
      if (missing.length) {
        throw fail(`ملف قاعدة بيانات غير صالح، جداول ناقصة: ${missing.join(', ')} / Invalid database, missing tables: ${missing.join(', ')}`);
      }

      const adminCount = testDb.prepare("SELECT COUNT(*) as count FROM employees WHERE role='admin' AND active=1").get().count;
      if (adminCount === 0) {
        throw fail('قاعدة البيانات يجب أن تحتوي على مدير نشط واحد على الأقل / Database must contain at least one active admin');
      }

      const integrity = testDb.prepare('PRAGMA integrity_check').get();
      const integrityResult = String(Object.values(integrity || {})[0] || '');
      if (integrityResult.toLowerCase() !== 'ok') {
        throw fail(`ملف قاعدة البيانات تالف: ${integrityResult} / Uploaded database is corrupt: ${integrityResult}`);
      }
    } catch (error) {
      // Anything the SQLite driver rejects is a bad upload, not a server fault: "file is not a
      // database" reached the client as a 500 before this.
      if (error && error.status) throw error;
      throw fail(`ملف قاعدة بيانات غير صالح: ${error.message} / Invalid database file: ${error.message}`);
    } finally {
      if (testDb) { try { testDb.close(); } catch {} }
    }

    // Record the restore while the live database is still open: audit writes go through that same
    // handle, so logging after closing it made the request fail with a 500 *after* the files had
    // already been swapped, leaving the process running against a closed database.
    logAudit(req.currentUser.id, req.currentUser.name, 'restore_database', 'backup', 0, 'Restoring full SQLite database');

    // Close the live handle through the raw driver. The wrapper exposes prepare/transaction/exec/
    // getRawDb only, so the previous `db.close()` was a TypeError, not a closed database.
    db.getRawDb().close();

    // A residual write-ahead log belongs to the database being replaced; SQLite would replay its
    // frames into whatever file it finds on the next open, silently undoing the restore.
    for (const suffix of ['-wal', '-shm']) {
      try { fs.rmSync(config.dbPath + suffix, { force: true }); } catch {}
    }

    fs.copyFileSync(config.dbPath, config.dbPath + '.before-restore');
    fs.copyFileSync(uploadPath, config.dbPath);

    res.json({ 
      success: true, 
      message: 'تمت استعادة قاعدة البيانات بنجاح. سيتم إعادة تشغيل الخادم. / Database restored successfully. Server will restart.',
      requiresRestart: true
    });

    setTimeout(() => {
      console.log('[Database Restore] Restarting server...');
      process.exit(0);
    }, 1000);

  } catch (error) {
    console.error('[Restore Database Error]', error.message);
    next(error);
  } finally {
    if (uploadPath && fs.existsSync(uploadPath)) {
      try { fs.unlinkSync(uploadPath); } catch {}
    }
  }
});

module.exports=router;

