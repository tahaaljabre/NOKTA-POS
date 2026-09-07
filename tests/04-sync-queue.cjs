const vm=require('vm'),fs=require('fs');const {start}=require('./support.cjs');
(async()=>{const {api,assert,close}=await start();try{
 assert.equal((await api('/api/sync','POST',{orders:[]})).status,200);
 async function scenario(ok,data) {
  const deleted=[],el={className:'',textContent:''};
  const context=vm.createContext({currentUser:{id:1,token:'test'},currentLang:'en',getOfflineOrders:async()=>[{offline_id:'a',local_id:1,employee_id:1},{offline_id:'b',local_id:2,employee_id:1}],clearOfflineOrders:async ids=>deleted.push(...ids),getDeviceId:()=> 'test',api:async()=>{if(!ok)throw new Error('401');return data;},document:{getElementById:()=>el},toast(){},loadTables(){},loadActiveOrders(){}});
  const source=fs.readFileSync('public/js/app.js','utf8');vm.runInContext(source.slice(source.indexOf('let syncInProgress=false;')),context);
  await vm.runInContext('syncPendingOrders()',context);return deleted;
 }
 assert.deepEqual(await scenario(false,{error:'expired'}),[]);
 assert.deepEqual(await scenario(true,{syncedOrders:[{offline_id:'a'}]}),[1]);
 console.log('PASS 04: rejected sync preserves queue; partial sync deletes only acknowledged order');
}finally{await close();}})().catch(e=>{console.error(e);process.exitCode=1;});

