const {start}=require('./support.cjs');
(async()=>{const {api,assert,close}=await start();try{
 assert.equal((await api('/api/inventory','POST',{item_name:'Bad',quantity:-1})).status,400);
 assert.equal((await api('/api/modifiers/assign','POST',{item_id:1,modifier_ids:[99999]})).status,400);
 const order=await api('/api/orders','POST',{table_id:1,items:[{item_id:1,quantity:1}]});assert.equal(order.status,200);
 assert.equal((await api('/api/tables/1','DELETE')).status,409);
 assert.equal((await api('/api/tables/1','PUT',{status:'empty'})).status,400);
 await api('/api/orders','POST',{status:'completed',items:[{item_id:1,quantity:1}]});
 const none=await api('/api/invoices?search=99999');assert.equal(none.data.total,0);
 const lim=await api('/api/invoices?limit=-1');assert(lim.data.orders.length<=200);
 console.log('PASS 21: inventory validation, modifier assignment, table integrity and filtered invoice counts');
}finally{await close();}})().catch(e=>{console.error(e);process.exitCode=1;});
