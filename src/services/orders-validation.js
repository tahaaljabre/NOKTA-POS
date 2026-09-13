const { db } = require('../database/db');
const error = (message,status=400) => Object.assign(new Error(message),{status});
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
  o.invoice_code = o.cashier_code ? `${o.cashier_code}-${o.invoice_number || o.id}` : String(o.invoice_number || o.id);
  return o;
}
module.exports={number,text,json,getOrder,error};
