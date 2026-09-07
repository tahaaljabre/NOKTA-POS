const vm=require('vm'),fs=require('fs');const {start}=require('./support.cjs');
(async()=>{const {api,assert,close}=await start();try{
 assert.equal((await api('/js/safety.js','GET',undefined,null)).status,200);
 let output='';const ctx=vm.createContext({currentLang:'ar',location:{origin:'http://localhost'},URL,localStorage:{getItem(){return '';}},io:()=>({on(){}}),document:{addEventListener(){},createElement(){return {};},getElementById(){return {innerHTML:'',appendChild(el){output=el.innerHTML;}}}}});
 vm.runInContext(fs.readFileSync('public/js/safety.js','utf8'),ctx);
 vm.runInContext(fs.readFileSync('public/js/kds.js','utf8'),ctx);
 vm.runInContext(`kdsOrders=[{id:1,type:'takeaway',created_at:'2026-09-07',items:[{item_name:'<svg onload=alert(1)>',quantity:1,note:'<img src=x onerror=alert(1)>'}]}];renderTickets();`,ctx);
 assert(!output.includes('<img'));assert(!output.includes('<svg'));assert(output.includes('&lt;img'));
 assert.equal(vm.runInContext("safeImageUrl('javascript:alert(1)')",ctx),'');
 console.log('PASS 06: running app serves safety module; KDS escapes stored markup and unsafe image URLs');
}finally{await close();}})().catch(e=>{console.error(e);process.exitCode=1;});
