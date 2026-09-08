const router=require('express').Router();
const {db}=require('../database/db');
const {requirePermission}=require('../middleware/auth.middleware');
const {dayOf,range}=require('../services/business-time');
router.use(requirePermission('reports'));
function report(from,to,employeeId){
 const {start,end}=range(from,to);
 const rows=db.prepare("SELECT * FROM orders WHERE status='completed' AND is_deleted=0 AND julianday(completed_at)>=julianday(?) AND julianday(completed_at)<julianday(?)"+(employeeId?' AND employee_id=?':'')).all(...(employeeId?[start,end,employeeId]:[start,end]));
 const days=new Map(),payments=new Map(),employees=new Map(),channels=new Map();let cents=0;
 for(const o of rows){
  const amount=Math.round(o.total*100);cents+=amount;
  const day=dayOf(o.completed_at);const d=days.get(day)||{day,orders:0,revenue:0};d.orders++;d.revenue+=amount;days.set(day,d);
  const p=payments.get(o.payment_method)||{payment_method:o.payment_method,count:0,total:0};p.count++;p.total+=amount;payments.set(o.payment_method,p);
    const channel=o.type==='delivery'?'delivery':(['card','promptpay','truemoney'].includes(o.payment_method)?'network':'cash');
    const channelRow=channels.get(channel)||{channel,count:0,total:0};channelRow.count++;channelRow.total+=amount;channels.set(channel,channelRow);
  const e=employees.get(o.employee_id)||{employee_name:o.employee_name,count:0,total:0};e.count++;e.total+=amount;employees.set(o.employee_id,e);
 }
 return {from,to,timezone:require('../services/business-time').zone(),daily:[...days.values()].map(d=>({...d,revenue:d.revenue/100})).sort((a,b)=>a.day.localeCompare(b.day)),by_payment:[...payments.values()].map(p=>({...p,total:p.total/100})),by_channel:[...channels.values()].map(c=>({...c,total:c.total/100})),by_employee:[...employees.values()].map(e=>({...e,total:e.total/100})),totals:{total_orders:rows.length,total_revenue:cents/100}};
}
router.get('/sales',(req,res)=>res.json(report(req.query.from||dayOf(),req.query.to||req.query.from||dayOf(),req.query.employee_id)));
router.get('/daily',(req,res)=>{const date=req.query.date||dayOf(),r=report(date,date,req.query.employee_id);res.json({date,total_orders:r.totals.total_orders,total_revenue:r.totals.total_revenue,by_employee:Object.fromEntries(r.by_employee.map(e=>[e.employee_name,{count:e.count,total:e.total}]))});});
module.exports=router;

