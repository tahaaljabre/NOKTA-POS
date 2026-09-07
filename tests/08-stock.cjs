const {start}=require('./support.cjs');
(async()=>{const {api,db,assert,close}=await start();try{
 db.prepare('INSERT INTO inventory(item_id,item_name,quantity) VALUES (?,?,?)').run(1,'Stock',100);
 const customer=db.prepare('INSERT INTO customers(name,phone) VALUES (?,?)').run('Test','0001').lastInsertRowid;
 const qty=()=>db.prepare('SELECT quantity FROM inventory WHERE item_id=1').get().quantity;
 const input={offline_id:'stock-sale',status:'completed',customer_id:customer,items:[{item_id:1,quantity:5}]};
 let r=await api('/api/orders','POST',input);assert.equal(r.status,200);const id=r.data.id;assert.equal(qty(),95);
 await api('/api/orders','POST',input);assert.equal(qty(),95);
 assert.equal(db.prepare('SELECT points FROM customers WHERE id=?').get(customer).points,1);
 db.exec("CREATE TRIGGER fail_stock BEFORE INSERT ON stock_logs BEGIN SELECT RAISE(ABORT,'stock write failure'); END");
 r=await api('/api/orders/'+id,'PUT',{items:[{item_id:1,quantity:8}]});assert.equal(r.status,500);assert.equal(qty(),95);assert.equal(db.prepare('SELECT total FROM orders WHERE id=?').get(id).total,10);
 db.exec('DROP TRIGGER fail_stock');
 r=await api('/api/orders/'+id,'PUT',{items:[{item_id:1,quantity:8}]});assert.equal(r.status,200);assert.equal(qty(),92);
 await api('/api/orders/'+id,'PUT',{status:'cancelled'});assert.equal(qty(),100);assert.equal(db.prepare('SELECT points FROM customers WHERE id=?').get(customer).points,0);
 await api('/api/sync','POST',{orders:[{...input,offline_id:'stock-sync'}]});assert.equal(qty(),95);
 const synced=db.prepare("SELECT id FROM orders WHERE offline_id='stock-sync'").get();await api('/api/orders/'+synced.id,'DELETE');assert.equal(qty(),100);await api('/api/orders/'+synced.id,'DELETE');assert.equal(qty(),100);
 console.log('PASS 08: stock/loyalty on sale, retry, edit, rollback, cancel, sync and repeated void');
}finally{await close();}})().catch(e=>{console.error(e);process.exitCode=1;});
