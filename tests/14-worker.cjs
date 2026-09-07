const fs=require('fs'),vm=require('vm');const {start}=require('./support.cjs');
(async()=>{const {api,assert,close}=await start();try{
 const code=(await api('/sw.js','GET',undefined,null)).data;assert(!code.includes('localStorage'));
 const ctx=vm.createContext({self:{addEventListener(){}}});vm.runInContext(code,ctx);
 const assets=vm.runInContext('STATIC_ASSETS',ctx);
 for(const url of assets.filter(x=>!x.startsWith('/socket.io')))assert.equal((await api(url,'GET',undefined,null)).status,200,url);
 assert(code.includes("indexedDB.open('pos-offline',2)"));assert(code.includes("url.pathname.startsWith('/api/')"));
 console.log('PASS 14: running app serves every offline asset, one IndexedDB version and no API response caching');
}finally{await close();}})().catch(e=>{console.error(e);process.exitCode=1;});
