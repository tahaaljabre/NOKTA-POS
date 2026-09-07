// Read-only with respect to business data: the application uses an in-memory DB.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const config = require('../src/config/app.config');
config.dbPath = ':memory:';
const { db, initDatabase, hashPin } = require('../src/database/db');
const { createApp } = require('../src/app');
const { issueToken } = require('../src/middleware/auth.middleware');
const findings = [];
function observed(id, detail) { findings.push({ id, detail }); console.log(id, JSON.stringify(detail)); }
async function main() {
  await initDatabase();
  const admin = db.prepare('INSERT INTO employees (name,pin,role,username) VALUES (?,?,?,?)').run('Audit Admin', hashPin('Audit!123'), 'admin', 'auditadmin').lastInsertRowid;
  const cashier = db.prepare('INSERT INTO employees (name,pin,role,permissions) VALUES (?,?,?,?)').run('Audit Cashier',hashPin('8259'),'cashier', '{"pos":true}').lastInsertRowid;
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function api(url, method='GET', body, user=admin) {
    const res = await fetch(base+url, { method, headers:{'Content-Type':'application/json', ...(user ? {Authorization:`Bearer ${issueToken({id:user})}`} : {})}, ...(body === undefined ? {} : {body:JSON.stringify(body)}) });
    const text=await res.text(); let data; try {data=JSON.parse(text);} catch {data=text.slice(0,80);}
    return {status:res.status,data};
  }
  const item=db.prepare('SELECT id,price FROM items ORDER BY id LIMIT 1').get();
  const order = (extra={}) => ({items:[{item_id:item.id,quantity:2}], type:'takeaway',...extra});
  try {
    assert.equal((await api('/api/orders','GET',undefined,null)).status,401);
    assert.equal((await api('/api/reports/sales','GET',undefined,cashier)).status,403);
    observed('BASELINE', 'Unauthenticated orders blocked; cashier reports blocked');
    let r=await api('/api/orders','POST',order({items:[{item_id:item.id,quantity:1.5}]}));
    assert.equal(r.data.total,item.price); observed('FRACTIONAL_QUANTITY',{quantity:1.5,total:r.data.total,expected:item.price*1.5});
    r=await api('/api/orders','POST',order({discount_percent:-100}));
    assert.equal(r.status,200); observed('NEGATIVE_DISCOUNT',{discount:-100,total:r.data.total});
    db.prepare('INSERT INTO inventory (item_id,item_name,quantity) VALUES (?,?,?)').run(item.id,'Audit stock',100);
    r=await api('/api/orders','POST',order({status:'completed'}));
    assert.equal(db.prepare('SELECT quantity FROM inventory WHERE item_id=?').get(item.id).quantity,100);
    observed('COMPLETED_STOCK',{status:r.status,stock:100,expected:98});
    const before=db.prepare('SELECT count(*) n FROM orders').get().n;
    r=await api('/api/orders','POST',order({items:[{item_id:item.id,quantity:1,note:{invalid:true}}]}));
    const after=db.prepare('SELECT count(*) n FROM orders').get().n;
    assert.equal(r.status,500); assert.equal(after,before+1);
    observed('PARTIAL_CREATE',{status:r.status,extraOrders:after-before});
    const a=await api('/api/orders','POST',order({table_id:1,type:'dine_in'}));
    const b=await api('/api/orders','POST',order({table_id:1,type:'dine_in'}));
    assert.equal(a.status,500); assert.equal(b.status,500);
    observed('SQL_DIALECT_TABLES',{status:a.status,error:a.data.error});
    const owned=await api('/api/orders','POST',order(),cashier);
    r=await api(`/api/orders/${owned.data.id}`,'PUT',{status:'cancelled'},cashier);
    assert.equal(r.status,200); observed('CANCEL_WITH_POS_ONLY',r.status);
    r=await api('/api/orders?status=completed','GET',undefined,cashier);
    assert(r.data.length>0); observed('INVOICE_PERMISSION_BYPASS',{status:r.status,rows:r.data.length});
    r=await api('/api/order-items/1','DELETE'); assert.equal(r.status,404);
    observed('INVOICE_EDIT_ROUTE_MISSING',r.status);
    const modifier=db.prepare('INSERT INTO modifiers (group_name,name,price_extra) VALUES (?,?,?)').run('Audit','Extra',3).lastInsertRowid;
    db.prepare('UPDATE settings SET value=? WHERE key=?').run('10','tax_rate');
    r=await api('/api/sync','POST',{orders:[order({offline_id:'audit-sync',status:'completed',discount_amount:1,items:[{item_id:item.id,quantity:2,modifiers:[{id:modifier}]}]})]});
    assert.equal(r.status,500); observed('SQL_DIALECT_SYNC',{status:r.status,error:r.data.error});
    const synced=db.prepare('SELECT id,total,subtotal,discount_amount,tax_percent FROM orders WHERE offline_id=?').get('audit-sync');
    await api(`/api/orders/${synced.id}`,'PUT',{note:'only a note'});
    const changed=db.prepare('SELECT total FROM orders WHERE id=?').get(synced.id);
    assert.notEqual(changed.total,synced.total); observed('SYNC_TOTAL_DRIFT',{synced,afterNoteEdit:changed.total});
    r=await api('/api/sync','POST',{orders:[order({offline_id:'bad',items:[{item_id:999999,quantity:1}]})]});
    assert.equal(r.status,500); observed('SYNC_INVALID_ITEM_RESPONSE',r.data);
    const exp=await api('/api/backup/export');
    r=await api('/api/backup/restore','POST',exp.data);
    assert.equal(r.status,500); observed('BACKUP_ROUNDTRIP',r.data);
    const countItems=db.prepare('SELECT count(*) n FROM items').get().n;
    r=await api('/api/backup/restore','POST',{type:'full',orders:[],order_items:[],items:[{id:1}]});
    assert.equal(r.status,500); assert.equal(db.prepare('SELECT count(*) n FROM items').get().n,0);
    observed('RESTORE_DATA_LOSS',{status:r.status,itemsBefore:countItems,itemsAfter:0,ordersAfter:db.prepare('SELECT count(*) n FROM orders').get().n});
    assert.equal((await api('/api/modifiers/item/1','GET',undefined,null)).status,401);
    r=await api('/api/inventory/1/logs'); observed('MISSING_STOCK_LOG_ROUTE',{status:r.status,body:r.data});
    const events={}; let cleared=false;
    const element={classList:{add(){},remove(){}},className:''};
    const context=vm.createContext({currentLang:'ar',io:()=>({on(){}}),navigator:{onLine:true},localStorage:{getItem(){return null;}},window:{location:{protocol:'http:'},addEventListener(n,fn){events[n]=fn;}},document:{addEventListener(n,fn){events[n]=fn;},getElementById(){return element;}},console,setTimeout,setInterval,fetch:async()=>({ok:false,status:401,json:async()=>({error:'Authentication required'})})});
    vm.runInContext(fs.readFileSync(path.join(root,'public/js/app.js'),'utf8'),context);
    vm.runInContext(`updateHeaderRestaurantName=loadSettings=applyTranslations=setupLogin=checkInitialSetup=setupNavigation=setupModals=setupTime=setupHeaderToolsMenu=()=>{}; toast=()=>{}; getOfflineOrders=async()=>[{offline_id:'unsaved'}]; clearOfflineOrders=async()=>{wasCleared=true}; getDeviceId=()=> 'audit'; var wasCleared=false;`,context);
    events.DOMContentLoaded(); await events.online(); cleared=vm.runInContext('wasCleared',context);
    assert.equal(cleared,true); observed('QUEUE_DELETED_ON_401',cleared);
    const sw=vm.createContext({self:{addEventListener(){}}});
    vm.runInContext(fs.readFileSync(path.join(root,'public/sw.js'),'utf8'),sw);
    await assert.rejects(vm.runInContext('getDeviceId()',sw),/localStorage is not defined/);
    observed('SERVICE_WORKER_STORAGE','getDeviceId throws: localStorage is not defined');
    const ks=vm.createContext({localStorage:{getItem(){return '';}},io:()=>({on(){}}),document:{createElement(){return {};},getElementById(){return {innerHTML:'',appendChild(el){this.ticket=el; captured=el.innerHTML;}}},addEventListener(){}},console});
    let captured='';
    vm.runInContext(fs.readFileSync(path.join(root,'public/js/kds.js'),'utf8'),ks);
    vm.runInContext(`kdsOrders=[{id:1,type:'takeaway',created_at:'2026-09-07',items:[{item_name:'Audit',quantity:1,note:'<img src=x onerror="window.auditMarker=1">'}]}];renderTickets();`,ks);
    assert(captured.includes('onerror="window.auditMarker=1"')); observed('STORED_HTML_SINK','Order note rendered as raw event-handler HTML (DOM stub, no browser execution)');
    r=await api(`/api/employees/${admin}`,'PUT',{active:0}); assert.equal(r.status,200);
    r=await api('/api/auth/setup-admin','POST',{name:'New Audit Admin',username:'newaudit',password:'Test!123'},null);
    assert.equal(r.status,201); observed('SETUP_REOPENS_AFTER_ADMIN_DISABLED',r.status);
    fs.writeFileSync(path.join(__dirname,'results.json'),JSON.stringify({date:'2026-09-07',database:':memory:',findings},null,2));
  } finally { await new Promise(resolve=>server.close(resolve)); db.getRawDb().close(); }
}
main().catch(err=>{console.error(err);process.exitCode=1;});

