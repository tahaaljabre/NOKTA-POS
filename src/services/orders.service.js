const { db } = require('../database/db');
const { logAudit } = require('../middleware/audit.middleware');
const { number,text,error,getOrder,json } = require('./orders-validation');
const { normalizeItems,totals,payment } = require('./orders-pricing');
const { applyEffects,persistItems,nextNumber } = require('./orders-effects');
const { deliveryAttributes } = require('./orders-delivery');
const can = (user,permission) => user.role==='admin' || user.permissions?.[permission];
const money = value => Math.round((Number(value)+Number.EPSILON)*100)/100;
function createOrder(input,user) {
  return db.transaction(()=>{
    const offlineId=text(input.offline_id,128);
    if(offlineId) { const existing=db.prepare('SELECT id,employee_id FROM orders WHERE offline_id=?').get(offlineId);if(existing){if(existing.employee_id!==user.id) throw error('معرف طلب مستخدم / Request ID belongs to another employee',409);return {...getOrder(existing.id),already_synced:true};} }
    const items=normalizeItems(input.items),status=input.status||'active',type=input.type||'dine_in';
    if(!['active','completed'].includes(status) || !['dine_in','takeaway','delivery'].includes(type)) throw error('حالة أو نوع الطلب غير صالح / Invalid order state or type');
    const disc=number(input.discount_percent??0,'discount',0,100),amount=money(number(input.discount_amount??0,'discount amount'));
    const maxDiscCreate = user.max_discount !== null && user.max_discount !== undefined ? user.max_discount : 100;
    const hasDiscountPerm = can(user,'discount_orders') || (user.max_discount !== null && user.max_discount > 0 && user.max_discount < 100);
    if((disc || amount) && !hasDiscountPerm) throw error('صلاحية الخصم مطلوبة / Discount permission required',403);
    if(disc>maxDiscCreate) throw error(`الخصم يتجاوز الحد المسموح (${maxDiscCreate}%) / Discount exceeds your allowed limit`,403);
    const tax=number(db.prepare("SELECT value FROM settings WHERE key='tax_rate'").get()?.value||0,'tax',0,100);
    const taxType=db.prepare("SELECT value FROM settings WHERE key='tax_type'").get()?.value||'exclusive';
    const delivery=deliveryAttributes(type,input.attributes),method=input.payment_method||'cash';
    if(delivery.app && status==='completed' && method!=='platform') throw error('طلبات التطبيق تُحصّلها المنصة / App orders are collected by the platform');
    const calc=totals(items,disc,amount,tax,taxType),pay=payment(method,status,input.is_prepaid?calc.total:input.paid_amount,calc.total,null,!!delivery.app);
    const tableId=input.table_id?number(input.table_id,'table ID',1):null,customerId=input.customer_id?number(input.customer_id,'customer ID',1):null;
    if(tableId) {
      if(!db.prepare('SELECT id FROM "tables" WHERE id=?').get(tableId)) throw error('الطاولة غير موجودة / Table not found');
      if(db.prepare("SELECT id FROM orders WHERE table_id=? AND status='active' AND is_deleted=0").get(tableId)) throw error('الطاولة مشغولة؛ افتح الطلب الحالي / Table occupied; open its existing order',409);
    }
    if(customerId && !db.prepare('SELECT id FROM customers WHERE id=?').get(customerId)) throw error('العميل غير موجود / Customer not found');
    const { dayOf } = require('./business-time');
    const todayDate = dayOf();
    const shift = db.prepare("SELECT id FROM daily_closings WHERE employee_id=? AND date=? AND is_closed=0 ORDER BY id DESC LIMIT 1").get(user.id, todayDate);
    if (user.role === 'cashier' && user.cashier_code && !shift) {
      throw error('يجب استلام الوردية قبل تسجيل الطلب / Open your cashier shift before creating an order', 409);
    }
    const now=new Date().toISOString();
    const invoice=nextNumber();
    // cashier_code يُؤخذ من الـ token المصادق فقط - لا نثق بالقيمة القادمة من المتصفح.
    const cashierCode = user.cashier_code || (user.role === 'cashier' ? String.fromCharCode(64 + Math.max(1, Number(user.id) || 1)) : '');
    const info=db.prepare('INSERT INTO orders(invoice_number,cashier_code,table_id,customer_id,type,status,subtotal,discount_percent,discount_amount,tax_percent,tax_amount,total,payment_method,paid_amount,change_amount,note,employee_id,employee_name,attributes,station_id,floor,offline_id,completed_at,shift_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(invoice,cashierCode,tableId,customerId,type,status,calc.subtotal,disc,amount,tax,calc.tax_amount,calc.total,method,pay.paid_amount,pay.change_amount,text(input.note),user.id,user.name,JSON.stringify(delivery.attributes),text(input.station_id||user.default_station||'cashier_main',100),number(input.floor||user.default_floor||1,'floor',1,100),offlineId,status==='completed'?now:null,shift?.id||null);
    const id=info.lastInsertRowid;persistItems(id,items);
    if(tableId && status==='active') db.prepare('UPDATE "tables" SET status=\'occupied\',current_order_id=? WHERE id=?').run(id,tableId);
    const saved=getOrder(id);applyEffects(saved,items,1,user);
    logAudit(user.id,user.name,'create_order','orders',id,'Invoice #'+invoice+' total '+calc.total,'',saved);
    return saved;
  })();
}
function updateOrder(id,input,user) {
  return db.transaction(()=>{
    const old=getOrder(id);
    const oldSnapshot=JSON.parse(JSON.stringify(old));
    if(old.is_deleted || old.status==='cancelled') throw error('لا يمكن تعديل طلب محذوف أو ملغي / Cannot edit deleted or cancelled order',409);
    if (user.role !== 'admin' && user.cashier_code && old.cashier_code && old.cashier_code !== user.cashier_code) throw error('الفاتورة تخص كاشيراً آخر / Invoice belongs to another cashier',403);
    if(!can(user,'edit_orders') && (old.employee_id!==user.id || old.status!=='active')) throw error('صلاحية تعديل الطلب مطلوبة / Order edit permission required',403);
    if(input.version!==undefined && Number(input.version)!==old.version) throw error('تغير الطلب؛ أعد فتحه / Order changed; reopen it',409);
    const status=input.status??old.status;
    if(!['active','completed','cancelled'].includes(status) || (old.status==='completed' && status==='active')) throw error('انتقال حالة غير صالح / Invalid state transition');
    if(status==='cancelled' && !can(user,'cancel_orders') && !can(user,'delete_orders')) throw error('صلاحية الإلغاء مطلوبة / Cancellation permission required',403);
    const disc=input.discount_percent===undefined?old.discount_percent:number(input.discount_percent,'discount',0,100);
    const amount=input.discount_amount===undefined?old.discount_amount:money(number(input.discount_amount,'discount amount'));
    const maxDiscUpd = user.max_discount !== null && user.max_discount !== undefined ? user.max_discount : 100;
    const hasDiscountPermUpd = can(user,'discount_orders') || (user.max_discount !== null && user.max_discount > 0 && user.max_discount < 100);
    if((disc!==old.discount_percent || amount!==old.discount_amount) && !hasDiscountPermUpd) throw error('صلاحية الخصم مطلوبة / Discount permission required',403);
    if(disc>maxDiscUpd) throw error(`الخصم يتجاوز الحد المسموح (${maxDiscUpd}%) / Discount exceeds your allowed limit`,403);
    const items=input.items===undefined?old.items:normalizeItems(input.items,old.items);
    // SECURITY: Always read tax_percent from settings, never trust client input
    const settings = db.prepare('SELECT key, value FROM settings WHERE key IN (?, ?)').all('tax_type', 'tax_rate');
    const taxType = settings.find(s => s.key === 'tax_type')?.value || 'exclusive';
    const taxP = Number(settings.find(s => s.key === 'tax_rate')?.value || 15);
    const delivery=deliveryAttributes(old.type,input.attributes===undefined?old.attributes:input.attributes);
    const calc=totals(items,disc,amount,taxP,taxType),method=input.payment_method??old.payment_method;
    if(delivery.app && status==='completed' && method!=='platform') throw error('طلبات التطبيق تُحصّلها المنصة / App orders are collected by the platform');
    const pay=payment(method,status,input.is_prepaid!==undefined?(input.is_prepaid?calc.total:input.paid_amount):input.paid_amount??(old.status==='completed'?Math.max(old.paid_amount,calc.total):(old.paid_amount>0?old.paid_amount:undefined)),calc.total,old,!!delivery.app);
    const effectKey = rows => JSON.stringify(rows.map(i=>[i.item_id,i.quantity]).sort((a,b)=>a[0]-b[0]));
    const effectsChanged = status!==old.status || calc.total!==old.total || effectKey(items)!==effectKey(old.items);
    if(effectsChanged) applyEffects(old,old.items,-1,user);
    db.prepare('UPDATE orders SET status=?,note=?,discount_percent=?,discount_amount=?,tax_percent=?,subtotal=?,tax_amount=?,total=?,payment_method=?,paid_amount=?,change_amount=?,completed_at=?,attributes=?,version=version+1 WHERE id=?').run(status,input.note===undefined?old.note:text(input.note),disc,amount,taxP,calc.subtotal,calc.tax_amount,calc.total,method,pay.paid_amount,pay.change_amount,status==='active'?null:(old.completed_at||new Date().toISOString()),JSON.stringify(delivery.attributes),id);
    if(input.items!==undefined) persistItems(id,items);
    if(status!=='active' && old.table_id) db.prepare('UPDATE "tables" SET status=\'empty\',current_order_id=NULL WHERE id=? AND current_order_id=?').run(old.table_id,id);
    const saved=getOrder(id);if(effectsChanged) applyEffects(saved,saved.items,1,user);
    logAudit(user.id,user.name,status==='cancelled'?'cancel_order':'update_order','orders',id,'Invoice #'+saved.invoice_number,oldSnapshot,saved);
    return saved;
  })();
}
function deleteOrder(id,user) {
  return db.transaction(()=>{
    const old=getOrder(id);if(old.is_deleted)return {ok:true};
    const oldSnapshot=JSON.parse(JSON.stringify(old));
    applyEffects(old,old.items,-1,user);
    db.prepare('UPDATE orders SET is_deleted=1,version=version+1 WHERE id=?').run(id);
    db.prepare('UPDATE "tables" SET status=\'empty\',current_order_id=NULL WHERE current_order_id=?').run(id);
    logAudit(user.id,user.name,'delete_order','orders',id,'Voided invoice; stock and loyalty reversed',oldSnapshot,{});return {ok:true};
  })();
}
module.exports={createOrder,updateOrder,deleteOrder,getOrder,can,error,number,text,money};
