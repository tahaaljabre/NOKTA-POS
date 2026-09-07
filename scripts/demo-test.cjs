// Disposable interactive test server. No business database is opened.
const config=require('../src/config/app.config');
config.dbPath=':memory:';config.host='127.0.0.1';config.port=3100;
require('../server').startServer().then(()=>{
 const {db,hashPin}=require('../src/database/db');
 db.prepare('INSERT INTO employees(name,username,pin,role) VALUES (?,?,?,?)').run('مدير التجربة','testmanager',hashPin('Test!123'),'admin');
 console.log('Disposable test UI: http://127.0.0.1:3100 | testmanager / Test!123');
});
