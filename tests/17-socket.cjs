const {start}=require('./support.cjs');
(async()=>{const {db,id,assert,close}=await start();try{
 const mod=require('../src/socket/socket.handler');let middleware;const sockets=new Map();mod.initSocket({use(fn){middleware=fn;},on(){},sockets:{sockets}});
 const token=require('../src/middleware/auth.middleware').issueToken({id});let rejected,disconnected=false,received=0;
 const socket={handshake:{auth:{token}},data:{},disconnect(){disconnected=true;},emit(){received++;}};
 middleware(socket,e=>rejected=e);assert(!rejected);sockets.set('test',socket);
 mod.emitEvent('order:updated',{id:1});assert.equal(received,1);
 db.prepare('UPDATE employees SET token_rev=token_rev+1 WHERE id=?').run(id);
 mod.revokeUser(id);assert(disconnected);
 middleware(socket,e=>rejected=e);assert(rejected);mod.emitEvent('order:updated',{id:2});assert.equal(received,1);
 console.log('PASS 17: socket middleware and broadcasts check active user/session; revoked socket disconnected');
}finally{await close();}})().catch(e=>{console.error(e);process.exitCode=1;});
