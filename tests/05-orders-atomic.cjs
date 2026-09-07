const {start}=require('./support.cjs');
(async()=>{const {api,db,assert,close}=await start();try{
 const count=()=>db.prepare('SELECT count(*) n FROM orders').get().n;
 db.exec("CREATE TRIGGER fail_item BEFORE INSERT ON order_items BEGIN SELECT RAISE(ABORT,'interrupted item write'); END");
 assert.equal((await api('/api/orders','POST',{items:[{item_id:1,quantity:1}]})).status,500);assert.equal(count(),0);
 assert.equal(db.prepare("SELECT value FROM settings WHERE key='next_invoice_number'").get().value,'1');
 db.exec('DROP TRIGGER fail_item');
 const payload={offline_id:'retry-test',table_id:1,items:[{item_id:1,quantity:1}]};
 const a=await api('/api/orders','POST',payload);assert.equal(a.status,200,JSON.stringify(a.data));
 const b=await api('/api/orders','POST',payload);assert.equal(b.data.id,a.data.id);assert.equal(count(),1);
 assert.equal((await api('/api/orders','POST',{...payload,offline_id:'other'})).status,409);
 assert.equal((await api('/api/orders/'+a.data.id,'PUT',{status:'completed',version:a.data.version})).status,200);
 assert.equal((await api('/api/orders/'+a.data.id,'PUT',{note:'stale',version:a.data.version})).status,409);
 assert.equal(db.prepare('SELECT status FROM "tables" WHERE id=1').get().status,'empty');
 console.log('PASS 05: interrupted sale rollback, invoice counter, retries, table conflict, stale edit');
}finally{await close();}})().catch(e=>{console.error(e);process.exitCode=1;});
