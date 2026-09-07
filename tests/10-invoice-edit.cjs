const {start}=require('./support.cjs');
(async()=>{const {api,assert,close}=await start();try{
 const saved=await api('/api/orders','POST',{status:'completed',items:[{item_id:1,quantity:1}]});assert.equal(saved.status,200);
 const edited=await api('/api/orders/'+saved.data.id,'PUT',{version:saved.data.version,items:[{item_id:1,quantity:3}]});assert.equal(edited.status,200);assert.equal(edited.data.total,6);assert.equal(edited.data.items.length,1);
 const failed=await api('/api/orders/'+saved.data.id,'PUT',{version:edited.data.version,items:[]});assert.equal(failed.status,400);
 assert.equal((await api('/api/orders/'+saved.data.id)).data.total,6);
 const fs=require('fs');assert(!fs.readFileSync('public/js/invoices.js','utf8').includes('/api/order-items/'));
 console.log('PASS 10: single invoice edit, recalculated server receipt and empty-edit rollback');
}finally{await close();}})().catch(e=>{console.error(e);process.exitCode=1;});
