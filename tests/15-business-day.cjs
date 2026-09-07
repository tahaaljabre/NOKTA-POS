const {start}=require('./support.cjs');
(async()=>{const {api,db,assert,close}=await start();try{
 db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('business_timezone','Asia/Bangkok')").run();
 const order=await api('/api/orders','POST',{status:'completed',items:[{item_id:1,quantity:1}]});
 db.prepare('UPDATE orders SET created_at=?,completed_at=? WHERE id=?').run('2026-09-06 16:00:00','2026-09-06T18:00:00.000Z',order.data.id);
 const sales=await api('/api/reports/sales?from=2026-09-07&to=2026-09-07');assert.equal(sales.data.totals.total_orders,1);
 const daily=await api('/api/reports/daily?date=2026-09-07');assert.equal(daily.data.total_orders,1);
 const closing=await api('/api/daily-closings/close','POST',{date:'2026-09-07'});assert.equal(closing.status,200,JSON.stringify(closing.data));assert.equal(closing.data.total_orders,1);
 assert.equal((await api('/api/reports/daily?date=2026-02-31')).status,400);
 console.log('PASS 15: local business day consistent across sales, daily report and closing; invalid dates rejected');
}finally{await close();}})().catch(e=>{console.error(e);process.exitCode=1;});
