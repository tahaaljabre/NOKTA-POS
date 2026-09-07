const {start}=require('./support.cjs');
(async()=>{const {api,db,id,base,assert,close}=await start();try{
 assert.equal((await api('/api/employees/'+id,'PUT',{active:0})).status,409);
 assert.equal((await api('/api/employees/'+id,'PUT',{role:'cashier'})).status,409);
 db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('setup_complete','1')").run();
 db.prepare('UPDATE employees SET active=0 WHERE id=?').run(id);
 assert.equal((await api('/api/auth/setup-admin','POST',{name:'Other',username:'other',password:'Test!123'},null)).status,409);
 db.prepare('UPDATE employees SET active=1 WHERE id=?').run(id);
 const emp=await api('/api/employees','POST',{name:'Cashier',pin:'5729',permissions:{pos:true}});assert.equal(emp.status,200);
 assert.equal((await api('/api/employees','POST',{name:'Duplicate',pin:'5729'})).status,409);
 const token=require('../src/middleware/auth.middleware').issueToken({id:emp.data.id});
 await api('/api/employees/'+emp.data.id,'PUT',{pin:'5730'});
 const response=await fetch(base+'/api/items',{headers:{Authorization:'Bearer '+token}});assert.equal(response.status,401);
 console.log('PASS 11: last admin, setup lock, duplicate PIN and invalidating changed credentials');
}finally{await close();}})().catch(e=>{console.error(e);process.exitCode=1;});
