const fs=require('fs'),vm=require('vm');const {start}=require('./support.cjs');
(async()=>{const {api,assert,close}=await start();try{
 const r=await api('/api/sync','POST',{orders:[{offline_id:'offline-13',items:[{item_id:1,quantity:1}],status:'active'}]});assert.equal(r.data.synced,1);
 const code=fs.readFileSync('public/js/orders.js','utf8');let queued,reset=false;
 const ctx=vm.createContext({crypto:require('crypto').webcrypto,currentUser:{id:1,token:'test'},currentOrder:{items:[{item_id:1,quantity:1}],type:'takeaway'},currentLang:'ar',api:async()=>{const e=new Error('offline');e.network=true;throw e;},saveOfflineOrder:async o=>queued=o,toast(){},document:{getElementById(){return {classList:{remove(){}}};}},setTimeout});
 const a=code.indexOf('async function saveOrder('),b=code.indexOf('async function printOrder()',a);vm.runInContext(code.slice(a,b),ctx);ctx.resetOrder=()=>{reset=true;};
 await vm.runInContext('saveOrder()',ctx);assert(queued.offline_id);assert.equal(queued.employee_id,1);assert.equal(queued.status,'active');assert(reset);
 queued=null;ctx.api=async()=>{const e=new Error('invalid');e.status=400;throw e;};await vm.runInContext('saveOrder()',ctx);assert.equal(queued,null);
 console.log('PASS 13: disconnected save queues a stable request; validation errors never queue; server accepts later sync');
}finally{await close();}})().catch(e=>{console.error(e);process.exitCode=1;});
