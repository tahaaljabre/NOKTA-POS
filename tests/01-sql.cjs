const {start}=require('./support.cjs');
(async()=>{const {api,db,assert,close}=await start();try{
  const item=db.prepare('SELECT id FROM items LIMIT 1').get();
  let r=await api('/api/tables','POST',{number:999});assert.equal(r.status,200);
  r=await api('/api/orders','POST',{table_id:r.data.id,items:[{item_id:item.id,quantity:1}]});assert.equal(r.status,200,JSON.stringify(r.data));
  assert.equal((await api(`/api/orders/${r.data.id}`,'PUT',{status:'completed'})).status,200);
  r=await api('/api/inventory','POST',{item_id:item.id,item_name:'Test',quantity:10});
  assert.equal((await api(`/api/inventory/${r.data.id}/adjust`,'POST',{quantity_change:1})).status,200);
  assert.equal((await api('/api/daily-closings/open','POST',{opening_cash:50})).status,200);
  assert.equal((await api('/api/daily-closings/close','POST',{})).status,200);
  r=await api('/api/sync','POST',{orders:[{offline_id:'sql-test',items:[{item_id:item.id,quantity:1}]}]});assert.equal(r.status,200);assert.equal(r.data.synced,1);
  console.log('PASS 01: real HTTP table, sale, inventory, daily closing and sync');
}finally{await close();}})().catch(e=>{console.error(e);process.exitCode=1;});
