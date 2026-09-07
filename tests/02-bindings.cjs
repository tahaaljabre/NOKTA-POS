const {start}=require('./support.cjs');
(async()=>{const {api,db,assert,close}=await start();try{
 db.prepare('INSERT INTO settings(key,value) VALUES (@key,@value)').run({key:'named_test',value:'ok'});
 assert.equal(db.prepare('SELECT value FROM settings WHERE key=@key').get({key:'named_test'}).value,'ok');
 assert.equal(db.prepare('SELECT value FROM settings WHERE key=@key').all({key:'named_test'}).length,1);
 const r=await api('/api/orders','POST',{items:[{item_id:1,quantity:1}]});assert.equal(r.status,200);
 const backup=await api('/api/backup/export');
 const restored=await api('/api/backup/restore','POST',backup.data);assert.equal(restored.status,200,JSON.stringify(restored.data));
 assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n,1);
 console.log('PASS 02: named run/get/all and real HTTP export/restore');
}finally{await close();}})().catch(e=>{console.error(e);process.exitCode=1;});
