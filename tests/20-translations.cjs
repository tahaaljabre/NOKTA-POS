const fs=require('fs'),vm=require('vm');const {start}=require('./support.cjs');
(async()=>{const {api,assert,close}=await start();try{
 const c=vm.createContext({localStorage:{getItem(){return 'ar';}}});vm.runInContext(fs.readFileSync('public/i18n.js','utf8'),c);
 assert.equal(vm.runInContext('Object.keys(I18N.ar).filter(k=>!I18N.en[k]).length',c),0);assert.equal(vm.runInContext('Object.keys(I18N.en).filter(k=>!I18N.ar[k]).length',c),0);
 for(const key of ['perm_kitchen','perm_discount_orders','perm_cancel_orders','business_timezone','modifiers_failed'])assert(vm.runInContext('I18N.ar.'+key+' !== I18N.en.'+key,c));
 assert((await api('/','GET',undefined,null)).data.includes('set-business-timezone'));
 console.log('PASS 20: translation key parity and translated new permissions, modifiers and settings');
}finally{await close();}})().catch(e=>{console.error(e);process.exitCode=1;});
