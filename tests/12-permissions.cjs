const {start}=require('./support.cjs');
(async()=>{const {api,db,assert,close}=await start();try{
 const user=(await api('/api/employees','POST',{name:'Cashier',pin:'8317',permissions:{pos:true}})).data.id;
 const active=await api('/api/orders','POST',{items:[{item_id:1,quantity:1}]},user);assert.equal(active.status,200);
 assert.equal((await api('/api/orders/'+active.data.id,'PUT',{status:'cancelled'},user)).status,403);
 assert.equal((await api('/api/orders?status=completed','GET',undefined,user)).status,403);
 assert.equal((await api('/api/orders?not_deleted=0','GET',undefined,user)).status,403);
 const finished=await api('/api/orders','POST',{status:'completed',items:[{item_id:1,quantity:1}]});
 assert.equal((await api('/api/orders/'+finished.data.id,'GET',undefined,user)).status,403);
 assert.equal((await api('/api/orders','POST',{discount_percent:10,items:[{item_id:1,quantity:1}]},user)).status,403);
 assert.equal((await api('/api/backup/export','GET',undefined,user)).status,403);
 console.log('PASS 12: history, cancellation, discount and backups require matching permissions');
}finally{await close();}})().catch(e=>{console.error(e);process.exitCode=1;});
