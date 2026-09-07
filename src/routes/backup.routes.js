const router = require('express').Router();
const { db } = require('../database/db');
const { requireAdmin } = require('../middleware/auth.middleware');
const { logAudit } = require('../middleware/audit.middleware');
const TABLES = ['employees','categories','items','modifiers','item_modifiers','table_zones','tables','customers','orders','order_items','shifts','inventory','stock_logs','daily_closings','discounts_coupons','audit_log','settings','sync_log'];
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
router.post('/restore',(req,res) => {
  const data=req.body;
  if (!data || !['orders','full'].includes(data.type)) throw fail('ملف النسخة غير صالح / Invalid backup file');
  if (data.type==='full' && data.version!==2) throw fail('النسخة القديمة غير مكتملة؛ يلزم ترحيلها قبل الاستعادة / Legacy full backup requires migration');
  const names=data.type==='full'?TABLES:['orders','order_items'];
  const operations=[];
  for (const name of names) {
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
  const ids=new Set(data.orders.map(o=>o.id));
  if(data.order_items.some(i=>!ids.has(i.order_id))) throw fail('عنصر دون فاتورة / Orphan order item');
  if(data.type==='full' && !data.employees.some(e=>e.role==='admin' && e.active===1 && e.pin)) throw fail('يلزم مدير نشط في النسخة / Backup needs an active administrator');
  db.transaction(()=>{
    for(const name of [...names].reverse()) db.prepare('DELETE FROM "'+name+'"').run();
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
    logAudit(req.currentUser.id,req.currentUser.name,'restore','backup',0,'Restored '+data.type+' backup');
  })();
  res.json({success:true,message:'تمت الاستعادة / Restore completed'});
});
module.exports=router;

