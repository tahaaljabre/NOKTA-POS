const {start}=require('./support.cjs');
(async()=>{const {api,db,assert,close}=await start();try{
 db.prepare("UPDATE settings SET value='10' WHERE key='tax_rate'").run();
 const mid=db.prepare('INSERT INTO modifiers(group_name,name,price_extra) VALUES (?,?,?)').run('Extras','Milk',3).lastInsertRowid;
 db.prepare('INSERT INTO item_modifiers(item_id,modifier_id) VALUES (?,?)').run(1,mid);
 const input={type:'takeaway',status:'completed',discount_amount:1,items:[{item_id:1,quantity:2,modifiers:[{id:mid}]}]};
 const online=await api('/api/orders','POST',input);assert.equal(online.status,200);assert.equal(online.data.total,9.9);
 const offline=await api('/api/sync','POST',{orders:[{...input,offline_id:'pricing'}]});assert.equal(offline.data.synced,1,JSON.stringify(offline.data));
 const saved=offline.data.syncedOrders[0];assert.equal(saved.total,online.data.total);assert.equal(saved.tax_percent,10);assert.equal(saved.discount_amount,1);
 db.prepare('UPDATE items SET price=20 WHERE id=1').run();
 const updated=await api('/api/orders/'+saved.id,'PUT',{note:'only a note',items:saved.items,version:saved.version});assert.equal(updated.data.total,9.9);
 for(const bad of [{discount_percent:-1},{discount_percent:101},{items:[{item_id:1,quantity:1.5}]},{paid_amount:1}]) assert.equal((await api('/api/orders','POST',{...input,...bad})).status,400);
 const partial=await api('/api/sync','POST',{orders:[{...input,offline_id:'good'},{offline_id:'bad',items:[{item_id:999,quantity:1}]}]});assert.equal(partial.data.synced,1);assert.equal(partial.data.failedOrders.length,1);
 console.log('PASS 07: online/offline totals, modifiers, tax, historical price, quantity/payment validation and partial sync');
}finally{await close();}})().catch(e=>{console.error(e);process.exitCode=1;});
