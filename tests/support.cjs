const assert = require('node:assert/strict');
const config = require('../src/config/app.config');
config.dbPath = ':memory:';
const { db, initDatabase, hashPin } = require('../src/database/db');
const { issueToken } = require('../src/middleware/auth.middleware');
async function start() {
  await initDatabase();
  const id = db.prepare('INSERT INTO employees (name,pin,role,username) VALUES (?,?,?,?)').run('Test Manager',hashPin('Test!123'),'admin','testmanager').lastInsertRowid;
  const server = require('../src/app').createApp().listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  async function api(url,method='GET',body,user=id) {
    const res=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer ${issueToken({id:user})}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const text=await res.text();let data;try{data=JSON.parse(text);}catch{data=text;}
    return {status:res.status,data,headers:res.headers};
  }
  return {api,db,id,base,assert,close:async()=>{await new Promise(resolve=>server.close(resolve));db.getRawDb().close();}};
}
module.exports={start,assert};
