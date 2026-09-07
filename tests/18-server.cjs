const {start}=require('./support.cjs');
(async()=>{const {api,base,assert,close}=await start();try{
 const missing=await api('/api/missing');assert.equal(missing.status,404);assert.equal(typeof missing.data,'object');
 assert.equal((await api('/api/settings','PUT',{setup_complete:'0'})).status,400);
 assert.equal((await api('/api/settings','PUT',{tax_rate:-1})).status,400);
 assert.equal((await api('/api/settings','PUT',{business_timezone:'unknown'})).status,400);
 const ar=await fetch(base+'/api/orders',{headers:{'Accept-Language':'ar'}});assert.equal((await ar.json()).error,'يلزم تسجيل الدخول');
 const en=await fetch(base+'/api/orders',{headers:{'Accept-Language':'en'}});assert.equal((await en.json()).error,'Authentication required');
 assert.equal((await api('/api/items')).headers.get('cache-control'),'no-store');
 console.log('PASS 18: JSON 404, protected settings, validation, Arabic/English errors and no API caching');
}finally{await close();}})().catch(e=>{console.error(e);process.exitCode=1;});
