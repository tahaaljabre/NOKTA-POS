// Explicit test CA only. Does not disable certificate verification or modify trust stores.
const fs=require('fs'),https=require('https'),path=require('path'),assert=require('assert/strict');
const config=require('../src/config/app.config');config.dbPath=':memory:';config.port=0;config.host='127.0.0.1';
config.tlsKeyPath=path.resolve('audit/test-tls/key.pem');config.tlsCertPath=path.resolve('audit/test-tls/cert.pem');
(async()=>{const running=await require('../server').startServer();try{
 const result=await new Promise((resolve,reject)=>https.get({hostname:'127.0.0.1',port:running.server.address().port,path:'/api/auth/setup-status',ca:fs.readFileSync(config.tlsCertPath)},res=>{let text='';res.on('data',d=>text+=d);res.on('end',()=>resolve({status:res.statusCode,text}));}).on('error',reject));
 assert.equal(result.status,200);assert(JSON.parse(result.text).setup_required);console.log('PASS 19: actual HTTPS server, verified test CA and API response');
}finally{await running.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
