const {start}=require('./support.cjs');
(async()=>{const {api,assert,close}=await start();try{
 assert.equal((await api('/api/inventory','GET',undefined,null)).status,401);
 const item=await api('/api/inventory','POST',{item_id:1,item_name:'Test',quantity:10});assert.equal(item.status,200);
 assert.equal((await api('/api/inventory/'+item.data.id+'/adjust','POST',{quantity_change:-11})).status,400);
 assert.equal((await api('/api/inventory/'+item.data.id+'/adjust','POST',{quantity_change:2,notes:'Test'})).status,200);
 const logs=await api('/api/inventory/'+item.data.id+'/logs');assert.equal(logs.data.length,1);assert.equal(logs.data[0].new_qty,12);
 assert.equal((await api('/api/modifiers/item/1')).status,200);
 const fs=require('fs');assert(!fs.readFileSync('public/js/inventory.js','utf8').includes('getAuthHeaders'));assert(!fs.readFileSync('public/js/inventory.js','utf8').includes('fetch('));
 console.log('PASS 09: authenticated inventory, adjustments, logs and modifier API');
}finally{await close();}})().catch(e=>{console.error(e);process.exitCode=1;});
