const router=require('express').Router();
const {db}=require('../database/db');
const {requirePermission}=require('../middleware/auth.middleware');
const {dayOf,range}=require('../services/business-time');
const {createSalesReportXlsx}=require('../services/sales-report-excel.service');
const {forDay: shopExpensesForDay}=require('../services/expenses.service');
router.use(requirePermission('reports'));
function report(from,to,employeeId,cashierCode){
 const {start,end}=range(from,to);
 const rows=db.prepare("SELECT * FROM orders WHERE status='completed' AND is_deleted=0 AND julianday(completed_at)>=julianday(?) AND julianday(completed_at)<julianday(?)"+(employeeId?' AND employee_id=?':'')+(cashierCode?' AND cashier_code=?':'')).all(...[start,end,...(employeeId?[employeeId]:[]),...(cashierCode?[cashierCode]:[])]);
 const days=new Map(),payments=new Map(),employees=new Map(),cashiers=new Map(),cashierWaiters=new Map(),channels=new Map(),types=new Map(),deliveryApps=new Map();let cents=0,taxCents=0,discountCents=0,cashDiscountCents=0,platformCents=0,legacyAppCents=0;
 let configuredApps=[];try{configuredApps=JSON.parse(db.prepare("SELECT value FROM settings WHERE key='delivery_methods_list'").get()?.value||'[]');}catch{}
 const employeeMeta=new Map(db.prepare('SELECT id,name,role,cashier_code FROM employees').all().map(e=>[e.id,e]));
 const cashierNames=new Map(db.prepare('SELECT code,name FROM cashiers').all().map(c=>[c.code,c.name]));
 for(const employee of db.prepare("SELECT name,cashier_code FROM employees WHERE role IN ('admin','cashier') AND cashier_code<>''").all()) {
  if(!cashierNames.has(employee.cashier_code)) cashierNames.set(employee.cashier_code,employee.name);
 }
 for(const o of rows){
  const amount=Math.round(o.total*100);cents+=amount;
  const taxAmt=Math.round((o.tax_amount||0)*100);taxCents+=taxAmt;
  const discountAmt=Math.round(Number(o.discount_amount||0)*100);discountCents+=discountAmt;if(o.payment_method==='cash')cashDiscountCents+=discountAmt;
  const day=dayOf(o.completed_at);const d=days.get(day)||{day,orders:0,revenue:0,tax:0};d.orders++;d.revenue+=amount;d.tax+=taxAmt;days.set(day,d);
  const p=payments.get(o.payment_method)||{payment_method:o.payment_method,count:0,total:0};p.count++;p.total+=amount;payments.set(o.payment_method,p);
  let attributes={};try{attributes=JSON.parse(o.attributes||'{}');}catch{}
  const appId=String(attributes.delivery_app_id||configuredApps.find(app=>app.name===attributes.delivery_app)?.id||'').trim();
  const appName=String(attributes.delivery_app||'').trim();
  if(o.type==='delivery' && (appId||appName)) {
   const key=appId||`legacy:${appName}`;
   const app=deliveryApps.get(key)||{app_id:appId,app_name:configuredApps.find(entry=>entry.id===appId)?.name||appName||appId,count:0,total:0,legacy_collection:0};
   app.count++;app.total+=amount;
   if(o.payment_method!=='platform'){app.legacy_collection+=amount;legacyAppCents+=amount;}
   deliveryApps.set(key,app);
  }
  if(o.payment_method==='platform')platformCents+=amount;
  const channel=o.payment_method==='platform'?'platform':(['card','promptpay','truemoney'].includes(o.payment_method)?'network':o.payment_method==='cash'?'cash':'other');
  const channelRow=channels.get(channel)||{channel,count:0,total:0};channelRow.count++;channelRow.total+=amount;channels.set(channel,channelRow);
  const t=types.get(o.type)||{type:o.type,count:0,total:0};t.count++;t.total+=amount;types.set(o.type,t);
  const meta=employeeMeta.get(o.employee_id);
  const employeeName=o.employee_name||meta?.name||'';
  const e=employees.get(o.employee_id)||{employee_name:employeeName,count:0,total:0};e.count++;e.total+=amount;employees.set(o.employee_id,e);
  const cashierCode=o.cashier_code||meta?.cashier_code||'';
  const c=cashiers.get(cashierCode)||{cashier_code:cashierCode,cashier_name:cashierNames.get(cashierCode)||'',count:0,total:0};c.count++;c.total+=amount;cashiers.set(cashierCode,c);
  if(meta?.role==='waiter' && cashierCode){ const group=cashierWaiters.get(cashierCode)||new Map(); const w=group.get(o.employee_id)||{employee_id:o.employee_id,employee_name:employeeName,count:0,total:0}; w.count++; w.total+=amount; group.set(o.employee_id,w); cashierWaiters.set(cashierCode,group); }
 }
 const taxRate = Number(db.prepare("SELECT value FROM settings WHERE key='tax_rate'").get()?.value || 0);
 return {from,to,timezone:require('../services/business-time').zone(),daily:[...days.values()].map(d=>({...d,revenue:d.revenue/100,tax:d.tax/100})).sort((a,b)=>a.day.localeCompare(b.day)),by_payment:[...payments.values()].map(p=>({...p,total:p.total/100})),by_channel:[...channels.values()].map(c=>({...c,total:c.total/100})),by_delivery_app:[...deliveryApps.values()].map(a=>({...a,total:a.total/100,legacy_collection:a.legacy_collection/100})),by_type:[...types.values()].map(t=>({...t,total:t.total/100})),by_employee:[...employees.values()].map(e=>({...e,total:e.total/100})),by_cashier:[...cashiers.values()].map(c=>({...c,total:c.total/100,waiters:[...(cashierWaiters.get(c.cashier_code)||new Map()).values()].map(w=>({...w,total:w.total/100}))})),totals:{total_orders:rows.length,total_revenue:cents/100,total_tax:taxCents/100,total_discount:discountCents/100,cash_discount:cashDiscountCents/100,tax_rate:taxRate,platform_receivable:platformCents/100,legacy_app_collection:legacyAppCents/100}};
}
function reportScope(req, requestedCashierCode) {
 const user = req.currentUser || {};
 const isAdmin = user.role === 'admin' || user.permissions?.admin === true;
 if (isAdmin) return { isAdmin: true, cashierCode: requestedCashierCode || null };
 if (!user.cashier_code) {
  const error = new Error('يلزم ربط الحساب بكاشير لعرض التقارير / A cashier assignment is required for reports');
  error.status = 403;
  throw error;
 }
 return { isAdmin: false, cashierCode: user.cashier_code };
}
router.get('/sales', (req, res) => {
  const scope = reportScope(req, req.query.cashier_code);
  return res.json(report(
    req.query.from || dayOf(),
    req.query.to || req.query.from || dayOf(),
    req.query.employee_id,
    scope.cashierCode
  ));
});
router.get('/sales.xlsx', async(req,res,next)=>{
 try{
  const from=req.query.from||dayOf(),to=req.query.to||req.query.from||dayOf();
   const scope = reportScope(req, req.query.cashier_code);
   const data=report(from,to,req.query.employee_id,scope.cashierCode);
  const language=String(req.headers['accept-language']||'ar').startsWith('en')?'en':'ar';
  const currency=db.prepare("SELECT value FROM settings WHERE key='currency'").get()?.value||'฿';
  const buffer=await createSalesReportXlsx(data,{language,currency});
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition',`attachment; filename="nokta-sales-${from}-to-${to}.xlsx"`);
  res.send(Buffer.from(buffer));
 }catch(error){next(error);}
});
router.get('/daily', (req,res)=>{
 const date=req.query.date||dayOf();
 const scope = reportScope(req, req.query.cashier_code);
 const employeeId=scope.isAdmin ? (req.query.employee_id||null) : req.currentUser.id;
 const r=report(date,date,scope.isAdmin ? employeeId : null,scope.cashierCode);
 const closings=db.prepare('SELECT employee_id,employee_name,opening_cash,counted_cash,notes,is_closed FROM daily_closings WHERE date=?'+(employeeId?' AND employee_id=?':'')).all(...(employeeId?[date,employeeId]:[date]));
 const expenses=db.prepare(`SELECT t.amount,t.payment_method,s.name supplier_name
   FROM supplier_transactions t JOIN suppliers s ON s.id=t.supplier_id
   WHERE t.transaction_type='payment' AND t.transaction_date=?${employeeId?' AND t.created_by=?':''}
   ORDER BY t.id`).all(...(employeeId?[date,employeeId]:[date]));
 const sum=rows=>Math.round(rows.reduce((n,row)=>n+Math.round(Number(row.amount||0)*100),0))/100;
 const expenseTotal=sum(expenses),cashExpenses=sum(expenses.filter(row=>row.payment_method==='cash'));
 const shopExpenses=shopExpensesForDay(date,employeeId);
 const allExpenses=Math.round((expenseTotal+shopExpenses.total)*100)/100;
 const allCashExpenses=Math.round((cashExpenses+shopExpenses.cash)*100)/100;
 const openingCash=Math.round(closings.reduce((n,row)=>n+Math.round(Number(row.opening_cash||0)*100),0))/100;
 const countedRows=closings.filter(row=>row.counted_cash!==null);
 const countedCash=countedRows.length?Math.round(countedRows.reduce((n,row)=>n+Math.round(Number(row.counted_cash)*100),0))/100:null;
 const countComplete=countedRows.length>0 && countedRows.length===closings.length;
 const cashSales=r.by_payment.find(p=>p.payment_method==='cash')?.total||0;
 res.json({date,total_orders:r.totals.total_orders,total_revenue:r.totals.total_revenue,total_tax:r.totals.total_tax,total_discount:r.totals.total_discount,cash_discount:r.totals.cash_discount,tax_rate:r.totals.tax_rate,
  platform_receivable:r.totals.platform_receivable,legacy_app_collection:r.totals.legacy_app_collection,
  by_payment:r.by_payment,by_delivery_app:r.by_delivery_app,by_employee:Object.fromEntries(r.by_employee.map(e=>[e.employee_name,{count:e.count,total:e.total}])),by_cashier:r.by_cashier,
  opening_cash:openingCash,cash_sales:cashSales,cash_expenses:allCashExpenses,expected_cash:Math.round((openingCash+cashSales-allCashExpenses)*100)/100,
  counted_cash:countedCash,cash_count_complete:countComplete,cash_difference:countComplete?Math.round((countedCash-openingCash-cashSales+allCashExpenses)*100)/100:null,
  supplier_expenses:expenses,supplier_expenses_total:expenseTotal,shop_expenses:shopExpenses.items,shop_expenses_total:shopExpenses.total,expenses_total:allExpenses,
  net_after_expenses:Math.round((r.totals.total_revenue-allExpenses)*100)/100,
  closing_notes:closings.filter(c=>c.notes).map(c=>({employee_name:c.employee_name,note:c.notes,is_closed:c.is_closed}))});
});
module.exports=router;
