const {start}=require('./support.cjs');
(async()=>{const {api,db,assert,close}=await start();try{
 await api('/api/orders','POST',{items:[{item_id:1,quantity:1}]});
 const backup=(await api('/api/backup/export')).data;
 assert(backup.inventory && backup.modifiers && backup.shifts && backup.employees[0].pin);
 const before=db.prepare('SELECT count(*) n FROM items').get().n;
 const bad=structuredClone(backup);bad.items[0].price={invalid:true};
 assert.equal((await api('/api/backup/restore','POST',bad)).status,400);
 assert.equal(db.prepare('SELECT count(*) n FROM items').get().n,before);
 db.exec("CREATE TRIGGER fail_restore BEFORE INSERT ON categories BEGIN SELECT RAISE(ABORT,'test interruption'); END");
 assert.equal((await api('/api/backup/restore','POST',backup)).status,500);
 assert.equal(db.prepare('SELECT count(*) n FROM items').get().n,before);
 assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n,1);
 db.exec('DROP TRIGGER fail_restore');
 assert.equal((await api('/api/backup/restore','POST',backup)).status,200);
 assert.equal(db.prepare("SELECT value FROM settings WHERE key='next_invoice_number'").get().value,'2');
 console.log('PASS 03: complete snapshot, invalid input protection, interrupted restore rolls back, roundtrip');
}finally{await close();}})().catch(e=>{console.error(e);process.exitCode=1;});
