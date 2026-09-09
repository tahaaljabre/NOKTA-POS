const { db } = require('../database/db');
const { logAudit } = require('../middleware/audit.middleware');
const error = (message,status=400) => Object.assign(new Error(message),{status});
const can = (user,permission) => user.role==='admin' || user.permissions?.[permission];
const money = value => Math.round((Number(value)+Number.EPSILON)*100)/100;
function number(value,label,min=0,max=100000000) {
  const n=Number(value);
  if(value===null || value==='' || !Number.isFinite(n) || n<min || n>max) throw error('قيمة غير صالحة / Invalid '+label);
  return n;
}
function text(value,max=2000) {
  if(value===undefined || value===null) return '';
  if(typeof value!=='string' || value.length>max) throw error('نص غير صالح أو طويل / Invalid or oversized text');
  return value;
}
function json(value,fallback={}) {
  try { const result=typeof value==='string'?JSON.parse(value):value??fallback; if(!result || typeof result!=='object') throw 0;return result; }
  catch { throw error('بيانات إضافية غير صالحة / Invalid attributes'); }
}
function getOrder(id) {
  const o=db.prepare('SELECT o.*,t.number table_number,t.name table_name,c.name customer_name,c.phone customer_phone FROM orders o LEFT JOIN "tables" t ON t.id=o.table_id LEFT JOIN customers c ON c.id=o.customer_id WHERE o.id=?').get(id);
  if(!o) throw error('الطلب غير موجود / Order not found',404);
  o.items=db.prepare('SELECT oi.*,i.name item_name,i.name_en item_name_en,i.image item_image FROM order_items oi LEFT JOIN items i ON i.id=oi.item_id WHERE order_id=? ORDER BY oi.id').all(id);
  return o;
}
function normalizeItems(input,oldItems=[]) {
  if(!Array.isArray(input) || !input.length || input.length>300) throw error('أضف من 1 إلى 300 صنف / Order needs 1 to 300 items');
  return input.map(row=>{
    if(!row || typeof row!=='object') throw error('صنف غير صالح / Invalid item');
    const quantity=number(row.quantity,'quantity',1,1000);
    if(!Number.isInteger(quantity)) throw error('الكمية يجب أن تكون عددًا صحيحًا / Quantity must be a whole number');
    const selected=json(row.modifiers??row.selected_modifiers,[]);
    if(!Array.isArray(selected) || selected.length>50) throw error('إضافات غير صالحة / Invalid modifiers');
    const ids=selected.map(m=>Number(m.id??m.modifier_id)).sort((a,b)=>a-b);
    if(new Set(ids).size!==ids.length || ids.some(id=>!Number.isSafeInteger(id))) throw error('إضافات مكررة أو غير صالحة / Invalid duplicate modifiers');
    const prior=oldItems.find(i=>i.item_id===Number(row.item_id) && JSON.stringify(json(i.selected_modifiers,[]).map(m=>Number(m.id??m.modifier_id)).sort((a,b)=>a-b))===JSON.stringify(ids));
    if(prior) return {item_id:prior.item_id,quantity,note:text(row.note),price:prior.price,cost_price:prior.cost_price,selected_modifiers:prior.selected_modifiers,discount_amount:0};
    const product=db.prepare('SELECT * FROM items WHERE id=? AND active=1').get(row.item_id);
    if(!product) throw error('الصنف غير متاح / Item is unavailable');
    const allowed=db.prepare('SELECT m.* FROM modifiers m JOIN item_modifiers im ON im.modifier_id=m.id WHERE im.item_id=? AND m.active=1').all(product.id);
    const mods=ids.map(id=>{const m=allowed.find(m=>m.id===id);if(!m) throw error('إضافة غير متاحة للصنف / Modifier unavailable for item');return m;});
    for(const group of new Set(allowed.map(m=>m.group_name))) {
      const choices=allowed.filter(m=>m.group_name===group), picked=mods.filter(m=>m.group_name===group);
      if(choices.some(m=>m.is_required) && !picked.length) throw error('اختر الإضافة المطلوبة / Required modifier missing');
      if(choices.some(m=>!m.is_multiple) && picked.length>1) throw error('اختر إضافة واحدة للمجموعة / Choose one modifier per group');
    }
    const extra=mods.reduce((sum,m)=>sum+Math.round(number(m.price_extra,'modifier price')*100),0);
    return {item_id:product.id,quantity,note:text(row.note),price:(Math.round(number(product.price,'price')*100)+extra)/100,cost_price:product.cost_price||0,discount_amount:0,selected_modifiers:JSON.stringify(mods.map(m=>({id:m.id,name:m.name,name_en:m.name_en,price_extra:m.price_extra})))};
  });
}
function totals(items,percent,amount,tax) {
  const subtotal=money(items.reduce((sum,i)=>sum+Math.round(i.price*100)*i.quantity,0)/100);
  const after=money(Math.max(0,subtotal-money(subtotal*percent/100)-amount));
  const taxAmount=money(after*tax/100);
  return {subtotal,tax_amount:taxAmount,total:money(after+taxAmount)};
}
function applyEffects(order,items,direction,user) {
  if(order.status!=='completed' || order.is_deleted) return;
  for(const item of items) {
    const inv=db.prepare('SELECT * FROM inventory WHERE item_id=?').get(item.item_id);
    if(!inv) continue;
    const change=-direction*item.quantity,newQty=money(inv.quantity+change);
    if(newQty<0) throw error('المخزون غير كافٍ / Insufficient stock',409);
    db.prepare('UPDATE inventory SET quantity=? WHERE id=?').run(newQty,inv.id);
    db.prepare('INSERT INTO stock_logs(inventory_id,type,quantity,previous_qty,new_qty,reference_id,employee_id,notes) VALUES (?,?,?,?,?,?,?,?)').run(inv.id,direction===1?'sale':'refund',change,inv.quantity,newQty,String(order.id),user.id,'Order #'+order.invoice_number);
  }
  if(order.customer_id) db.prepare('UPDATE customers SET points=points+?,total_spent=total_spent+?,total_orders=total_orders+? WHERE id=?').run(direction*Math.floor(order.total/10),direction*order.total,direction,order.customer_id);
}
function persistItems(id,items) {
  db.prepare('DELETE FROM order_items WHERE order_id=?').run(id);
  for(const i of items) db.prepare('INSERT INTO order_items(order_id,item_id,quantity,price,cost_price,note,discount_amount,selected_modifiers) VALUES (?,?,?,?,?,?,?,?)').run(id,i.item_id,i.quantity,i.price,i.cost_price,i.note,i.discount_amount,i.selected_modifiers);
}
function nextNumber() {
  const max=db.prepare('SELECT COALESCE(MAX(invoice_number),0) n FROM orders').get().n;
  const configured=Number(db.prepare("SELECT value FROM settings WHERE key='next_invoice_number'").get()?.value)||1;
  const n=Math.max(max+1,configured);
  db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('next_invoice_number',?)").run(String(n+1));return n;
}
function payment(method,status,paid,total,old) {
  let list;try{list=JSON.parse(db.prepare("SELECT value FROM settings WHERE key='payment_methods_list'").get()?.value||'[]');}catch{list=[];}
  if(!list.some(p=>p.id===method && p.active!==false) && method!==old?.payment_method) throw error('طريقة الدفع غير متاحة / Payment method unavailable');
  const amount=paid===undefined ? (status==='completed'?total:0) : money(number(paid,'paid amount'));
  if(status==='completed' && amount<total) throw error('المبلغ المدفوع غير كافٍ / Payment does not cover total');
  return {paid_amount:amount,change_amount:method==='cash'?money(Math.max(0,amount-total)):0};
}
function createOrder(input,user) {
  return db.transaction(()=>{
    const offlineId=text(input.offline_id,128);
    if(offlineId) { const existing=db.prepare('SELECT id,employee_id FROM orders WHERE offline_id=?').get(offlineId);if(existing){if(existing.employee_id!==user.id) throw error('معرف طلب مستخدم / Request ID belongs to another employee',409);return {...getOrder(existing.id),already_synced:true};} }
    const items=normalizeItems(input.items),status=input.status||'active',type=input.type||'dine_in';
    if(!['active','completed'].includes(status) || !['dine_in','takeaway','delivery'].includes(type)) throw error('حالة أو نوع الطلب غير صالح / Invalid order state or type');
    const disc=number(input.discount_percent??0,'discount',0,100),amount=money(number(input.discount_amount??0,'discount amount'));
    const maxDisc = user.max_discount !== null && user.max_discount !== undefined ? user.max_discount : 100;
    if (disc > maxDisc) throw error(`تجاوزت الحد الأقصى للخصم (${maxDisc}%) / Exceeded max discount`, 403);
    if((disc || amount) && !can(user,'discount_orders')) throw error('صلاحية الخصم مطلوبة / Discount permission required',403);
    const tax=number(db.prepare("SELECT value FROM settings WHERE key='tax_rate'").get()?.value||0,'tax',0,100);
    const calc=totals(items,disc,amount,tax),method=input.payment_method||'cash',pay=payment(method,status,input.paid_amount,calc.total);
    const tableId=input.table_id?number(input.table_id,'table ID',1):null,customerId=input.customer_id?number(input.customer_id,'customer ID',1):null;
    if(tableId) {
      if(!db.prepare('SELECT id FROM "tables" WHERE id=?').get(tableId)) throw error('الطاولة غير موجودة / Table not found');
      if(db.prepare("SELECT id FROM orders WHERE table_id=? AND status='active' AND is_deleted=0").get(tableId)) throw error('الطاولة مشغولة؛ افتح الطلب الحالي / Table occupied; open its existing order',409);
    }
    if(customerId && !db.prepare('SELECT id FROM customers WHERE id=?').get(customerId)) throw error('العميل غير موجود / Customer not found');
    const shift=db.prepare("SELECT id FROM shifts WHERE employee_id=? AND status='open' ORDER BY id DESC LIMIT 1").get(user.id);
    const now=new Date().toISOString();
    const invoice=nextNumber();
    const info=db.prepare('INSERT INTO orders(invoice_number,table_id,customer_id,type,status,subtotal,discount_percent,discount_amount,tax_percent,tax_amount,total,payment_method,paid_amount,change_amount,note,employee_id,employee_name,attributes,station_id,floor,offline_id,completed_at,shift_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(invoice,tableId,customerId,type,status,calc.subtotal,disc,amount,tax,calc.tax_amount,calc.total,method,pay.paid_amount,pay.change_amount,text(input.note),user.id,user.name,JSON.stringify(json(input.attributes)),text(input.station_id||user.default_station||'cashier_main',100),number(input.floor||user.default_floor||1,'floor',1,100),offlineId,status==='completed'?now:null,shift?.id||null);
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
    if(old.is_deleted || old.status==='cancelled') throw error('لا يمكن تعديل طلب محذوف أو ملغي / Cannot edit deleted or cancelled order',409);
    if(!can(user,'edit_orders') && (old.employee_id!==user.id || old.status!=='active')) throw error('صلاحية تعديل الطلب مطلوبة / Order edit permission required',403);
    if(input.version!==undefined && Number(input.version)!==old.version) throw error('تغير الطلب؛ أعد فتحه / Order changed; reopen it',409);
    const status=input.status??old.status;
    if(!['active','completed','cancelled'].includes(status) || (old.status==='completed' && status==='active')) throw error('انتقال حالة غير صالح / Invalid state transition');
    if(status==='cancelled' && !can(user,'cancel_orders') && !can(user,'delete_orders')) throw error('صلاحية الإلغاء مطلوبة / Cancellation permission required',403);
    const disc=number(input.discount_percent??old.discount_percent,'discount',0,100),amount=money(number(input.discount_amount??old.discount_amount,'discount amount'));
    const maxDisc = user.max_discount !== null && user.max_discount !== undefined ? user.max_discount : 100;
    if (disc > maxDisc) throw error(`تجاوزت الحد الأقصى للخصم (${maxDisc}%) / Exceeded max discount`, 403);
    if((disc!==old.discount_percent || amount!==old.discount_amount) && !can(user,'discount_orders')) throw error('صلاحية الخصم مطلوبة / Discount permission required',403);
    const items=input.items===undefined?old.items:normalizeItems(input.items,old.items);
    const calc=totals(items,disc,amount,old.tax_percent),method=input.payment_method??old.payment_method;
    const pay=payment(method,status,input.paid_amount??(old.status==='completed'?Math.max(old.paid_amount,calc.total):undefined),calc.total,old);
    const effectKey = rows => JSON.stringify(rows.map(i=>[i.item_id,i.quantity]).sort((a,b)=>a[0]-b[0]));
    const effectsChanged = status!==old.status || calc.total!==old.total || effectKey(items)!==effectKey(old.items);
    if(effectsChanged) applyEffects(old,old.items,-1,user);
    db.prepare('UPDATE orders SET status=?,note=?,discount_percent=?,discount_amount=?,subtotal=?,tax_amount=?,total=?,payment_method=?,paid_amount=?,change_amount=?,completed_at=?,attributes=?,version=version+1 WHERE id=?').run(status,input.note===undefined?old.note:text(input.note),disc,amount,calc.subtotal,calc.tax_amount,calc.total,method,pay.paid_amount,pay.change_amount,status==='active'?null:(old.completed_at||new Date().toISOString()),input.attributes===undefined?old.attributes:JSON.stringify(json(input.attributes)),id);
    if(input.items!==undefined) persistItems(id,items);
    if(status!=='active' && old.table_id) db.prepare('UPDATE "tables" SET status=\'empty\',current_order_id=NULL WHERE id=? AND current_order_id=?').run(old.table_id,id);
    const saved=getOrder(id);if(effectsChanged) applyEffects(saved,saved.items,1,user);
    logAudit(user.id,user.name,status==='cancelled'?'cancel_order':'update_order','orders',id,'Invoice #'+saved.invoice_number,old,saved);
    return saved;
  })();
}
function deleteOrder(id,user) {
  return db.transaction(()=>{
    const old=getOrder(id);if(old.is_deleted)return {ok:true};
    applyEffects(old,old.items,-1,user);
    db.prepare('UPDATE orders SET is_deleted=1,version=version+1 WHERE id=?').run(id);
    db.prepare('UPDATE "tables" SET status=\'empty\',current_order_id=NULL WHERE current_order_id=?').run(id);
    logAudit(user.id,user.name,'delete_order','orders',id,'Voided invoice; stock and loyalty reversed',old,'DELETED');return {ok:true};
  })();
}
module.exports={createOrder,updateOrder,deleteOrder,getOrder,can,error,number,text,money};
