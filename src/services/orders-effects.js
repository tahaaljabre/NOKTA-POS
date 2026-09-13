const { db } = require('../database/db');
const { logAudit } = require('../middleware/audit.middleware');
const { getOrder } = require('./orders-validation');
const { number,text,error } = require('./orders-validation');
const money = value => Math.round((Number(value)+Number.EPSILON)*100)/100;
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
module.exports={applyEffects,persistItems,nextNumber};
