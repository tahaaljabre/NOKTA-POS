const router=require('express').Router();
const {db}=require('../database/db');
const {requirePermission}=require('../middleware/auth.middleware');
const {createOrder,error,text}=require('../services/orders.service');
const {emitEvent}=require('../socket/socket.handler');
router.use(requirePermission('pos'));
router.post('/',(req,res)=>{
  const {orders,device_id}=req.body||{};
  if(!Array.isArray(orders)||orders.length>100) throw error('دفعة غير صالحة؛ الحد 100 طلب / Invalid batch; maximum 100 orders');
  const syncedOrders=[],failedOrders=[];
  for(const input of orders) {
    try {
      if(!input.offline_id) throw error('معرف الطلب مطلوب / Request ID required');
      if(input.employee_id && Number(input.employee_id)!==req.currentUser.id) throw error('أعد الدخول بحساب صاحب الطلب / Sign in as the order owner',403);
      const saved=createOrder({...input,status:input.status||'completed'},req.currentUser);
      syncedOrders.push({...saved,offline_id:input.offline_id,print_required:!saved.already_synced});
    }catch(e){failedOrders.push({offline_id:input?.offline_id||null,error:e.status?e.message:'تعذر حفظ الطلب / Could not save order',status:e.status||500});}
  }
  db.prepare("INSERT INTO sync_log(device_id,last_sync) VALUES (?,datetime('now'))").run(text(device_id||'unknown',128));
  if(syncedOrders.length){emitEvent('order:updated',{});emitEvent('table:updated',{});}
  res.json({ok:failedOrders.length===0,synced:syncedOrders.length,syncedOrders,failedOrders,server_time:new Date().toISOString()});
});
module.exports=router;

