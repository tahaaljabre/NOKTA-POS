const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { logAudit } = require('../middleware/audit.middleware');
const { emitEvent } = require('../socket/socket.handler');
const { checkPerm, requirePermission } = require('../middleware/auth.middleware');
router.use(require('../middleware/auth.middleware').requireAuthenticated);
const {can,error}=require('../services/orders.service');

// GET active/filtered orders
router.get('/', (req, res) => {
  let { status, date, employee_id, not_deleted, with_items } = req.query;
  if(!can(req.currentUser,'pos') && !can(req.currentUser,'view_invoices')) throw error('صلاحية الطلبات مطلوبة / Order access required',403);
  if(!can(req.currentUser,'view_invoices')) {
    const ownDay = date && Number(employee_id)===req.currentUser.id;
    if(!ownDay && ((status && status!=='active') || not_deleted==='0')) throw error('صلاحية الفواتير مطلوبة / Invoice permission required',403);
    if(!ownDay) status='active';
    not_deleted='1';
  }
  let sql = 'SELECT o.*, t.number as table_number, t.name as table_name, c.name as customer_name, c.phone as customer_phone FROM orders o LEFT JOIN "tables" t ON o.table_id=t.id LEFT JOIN customers c ON o.customer_id=c.id WHERE 1=1';
  const p = [];
  if (status) { sql += ' AND o.status=?'; p.push(status); }
  if (date) { const r=require("../services/business-time").range(date);sql += " AND julianday(COALESCE(o.completed_at,o.created_at))>=julianday(?) AND julianday(COALESCE(o.completed_at,o.created_at))<julianday(?)";p.push(r.start,r.end); }
  if (employee_id) { sql += ' AND o.employee_id=?'; p.push(employee_id); }
  if (not_deleted !== '0') { sql += ' AND o.is_deleted=0'; }
  const limit=Math.max(1,Math.min(500,Number.parseInt(req.query.limit)||200));
  const offset=Math.max(0,Number.parseInt(req.query.offset)||0);
  sql += ' ORDER BY o.id DESC LIMIT ? OFFSET ?';p.push(limit,offset);
  const orders = db.prepare(sql).all(...p);

  if (with_items === '1' && orders.length > 0) {
    const orderIds = orders.map(o => o.id);
    const placeholders = orderIds.map(() => '?').join(',');
    const allItems = db.prepare(`
      SELECT oi.*, i.name as item_name, i.name_en as item_name_en 
      FROM order_items oi 
      LEFT JOIN items i ON oi.item_id=i.id 
      WHERE oi.order_id IN (${placeholders})
    `).all(...orderIds);

    const itemMap = {};
    allItems.forEach(item => {
      if (!itemMap[item.order_id]) itemMap[item.order_id] = [];
      itemMap[item.order_id].push(item);
    });

    orders.forEach(o => {
      o.items = itemMap[o.id] || [];
    });
  }

  res.json(orders);
});

router.get('/kitchen',requirePermission('kitchen'),(req,res)=>{
 const ids=db.prepare("SELECT id FROM orders WHERE status='active' AND is_deleted=0 ORDER BY id LIMIT 500").all();
 res.json(ids.map(({id})=>{const o=require('../services/orders.service').getOrder(id);return {id:o.id,invoice_number:o.invoice_number,table_id:o.table_id,type:o.type,status:o.status,attributes:o.attributes,created_at:o.created_at,version:o.version,items:o.items.map(i=>({item_name:i.item_name,item_name_en:i.item_name_en,quantity:i.quantity,note:i.note,selected_modifiers:i.selected_modifiers}))};}));
});
router.post('/:id/ready',requirePermission('kitchen'),(req,res)=>{
 const result=db.transaction(()=>{
  const old=require('../services/orders.service').getOrder(req.params.id);
  if(old.status!=='active'||old.is_deleted)throw error('الطلب لم يعد نشطًا / Order is no longer active',409);
  if(Number(req.body.version)!==old.version)throw error('تغير الطلب؛ أعد تحميله / Order changed; reload it',409);
  let attributes;try{attributes=JSON.parse(old.attributes||'{}');}catch{attributes={};}
  attributes.kds_status='ready';db.prepare('UPDATE orders SET attributes=?,version=version+1 WHERE id=?').run(JSON.stringify(attributes),old.id);
  logAudit(req.currentUser.id,req.currentUser.name,'kitchen_ready','orders',old.id,'Kitchen marked ready');return {ok:true};
 })();emitEvent('order:updated',{id:req.params.id});res.json(result);
});

// GET single order with items
router.get('/:id', (req, res) => {
  const order = db.prepare('SELECT o.*, t.number as table_number, t.name as table_name, c.name as customer_name, c.phone as customer_phone FROM orders o LEFT JOIN "tables" t ON o.table_id=t.id LEFT JOIN customers c ON o.customer_id=c.id WHERE o.id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if(!can(req.currentUser,'view_invoices') && !(can(req.currentUser,'pos') && order.status==='active' && !order.is_deleted)) throw error('صلاحية الفاتورة مطلوبة / Invoice access required',403);
  const items = db.prepare('SELECT oi.*, i.name as item_name, i.name_en as item_name_en, i.image as item_image FROM order_items oi LEFT JOIN items i ON oi.item_id=i.id WHERE oi.order_id=?').all(req.params.id);
  res.json({ ...order, items });
});


const service = require('../services/orders.service');
router.post('/', requirePermission('pos'), (req,res)=>{const order=service.createOrder(req.body,req.currentUser);emitEvent('order:created',{id:order.id});emitEvent('table:updated',{});res.json(order);});
router.put('/:id', requirePermission('pos'), (req,res)=>{const order=service.updateOrder(req.params.id,req.body,req.currentUser);emitEvent('order:updated',{id:order.id});emitEvent('table:updated',{});res.json(order);});
router.delete('/:id',requirePermission('delete_orders'),(req,res)=>{const result=service.deleteOrder(req.params.id,req.currentUser);emitEvent('order:deleted',{id:req.params.id});emitEvent('table:updated',{});res.json(result);});
router.post('/:id/items',requirePermission('pos'),(req,res)=>{const order=service.getOrder(req.params.id);const result=service.updateOrder(req.params.id,{items:[...order.items,req.body],version:order.version},req.currentUser);emitEvent('order:items_changed',{order_id:order.id});res.json(result);});
module.exports=router;
