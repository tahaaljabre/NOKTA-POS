const {start}=require('./support.cjs');
const fs=require('fs');
(async()=>{const {api,db,assert,close}=await start();try{
 const chef=(await api('/api/employees','POST',{name:'Chef',role:'kitchen',pin:'6782',permissions:{kitchen:true}})).data.id;
 const saved=(await api('/api/orders','POST',{items:[{item_id:1,quantity:1}]})).data;
 db.prepare('UPDATE items SET price=50 WHERE id=1').run();
 const list=await api('/api/orders/kitchen','GET',undefined,chef);assert.equal(list.status,200);assert(!('total' in list.data[0]));
 assert.equal((await api('/api/orders/'+saved.id+'/ready','POST',{version:saved.version},chef)).status,200);
 const after=(await api('/api/orders/'+saved.id)).data;assert.equal(after.total,saved.total);assert.equal(after.items[0].price,saved.items[0].price);
 assert.equal((await api('/api/orders/'+saved.id+'/ready','POST',{version:saved.version},chef)).status,409);
 assert.equal((await api('/api/orders/'+saved.id,'PUT',{status:'completed'},chef)).status,403);
 const app=fs.readFileSync('public/js/app.js','utf8'),kds=fs.readFileSync('public/js/kds.js','utf8');
 assert(app.includes("kds.html#session=${encodeURIComponent(currentUser.token)}"));
 assert(kds.includes("history.replaceState(null, '', location.pathname + location.search)"));
 console.log('PASS 16: kitchen-only permission; ready preserves prices and items; stale updates rejected');
}finally{await close();}})().catch(e=>{console.error(e);process.exitCode=1;});
