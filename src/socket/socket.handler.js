let ioInstance=null;
const {getRequesterInfo}=require('../middleware/auth.middleware');
function userFor(socket) {return getRequesterInfo({headers:{authorization:'Bearer '+(socket.handshake.auth?.token||'')}});}
function allowed(user) {return user&&(user.role==='admin'||user.permissions.pos||user.permissions.kitchen||user.permissions.tables||user.permissions.view_invoices);}
function revokeUser(id) {
  if(!ioInstance)return;
  for(const socket of ioInstance.sockets.sockets.values()) if(socket.data.employeeId===Number(id) && !allowed(userFor(socket)))socket.disconnect(true);
}
function initSocket(io) {
  ioInstance=io;
  io.use((socket,next)=>{const user=userFor(socket);if(!allowed(user))return next(new Error('يلزم دخول مصرح / Authorized sign-in required'));socket.data.employeeId=user.id;next();});
  io.on('connection',socket=>{
    const timer=setInterval(()=>{if(!allowed(userFor(socket)))socket.disconnect(true);},10000);timer.unref?.();
    socket.on('disconnect',()=>clearInterval(timer));
  });
}
function emitEvent(event,data) {
  if(!ioInstance)return;
  for(const socket of ioInstance.sockets.sockets.values()) {
    const user=userFor(socket);
    if(!allowed(user)){socket.disconnect(true);continue;}
    const perm=event.startsWith('table:')?'tables':event.startsWith('order:')?'pos':'kitchen';
    if(user.role==='admin'||user.permissions[perm]||user.permissions.pos||user.permissions.kitchen)socket.emit(event,data);
  }
}
module.exports={initSocket,emitEvent,revokeUser,getIo:()=>ioInstance};

