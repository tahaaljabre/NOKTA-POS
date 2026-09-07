const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const config = require('./src/config/app.config');
const { initDatabase } = require('./src/database/db');
const { createApp } = require('./src/app');
const { initSocket } = require('./src/socket/socket.handler');

async function startServer() {
  if(!!config.tlsKeyPath!==!!config.tlsCertPath)throw new Error('Both TLS_KEY_PATH and TLS_CERT_PATH are required');
  const behindManagedHttpsProxy = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_ID);
  if(process.env.NODE_ENV==='production' && !config.tlsKeyPath && !behindManagedHttpsProxy)throw new Error('Production LAN requires TLS_KEY_PATH and TLS_CERT_PATH');
  // 1. Initialize SQLite Database & Migrations
  await initDatabase();
  const automaticBackups = config.dbPath === ':memory:'
    ? { stop() {} }
    : require('./src/services/automatic-backup').startAutomaticBackups(
        require('./src/database/db').db.getRawDb(),
        config.dbDir
      );

  // 2. Create Express App & HTTP Server
  const app = createApp();
  const secure=!!config.tlsKeyPath;
  const server = secure ? https.createServer({key:fs.readFileSync(config.tlsKeyPath),cert:fs.readFileSync(config.tlsCertPath)},app) : http.createServer(app);

  // 3. Initialize Socket.IO
  const io = new Server(server, {
    cors: { origin: false }
  });
  initSocket(io);

  // 4. Start Listening
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.port, config.host, () => {server.removeListener('error',reject);resolve();});});
    console.log(`\n========================================`);
    console.log(`  🍽️ POS Server: ${secure?'https':'http'}://${config.host}:${server.address().port}`);
    console.log(`  🔐 Initial setup: create the administrator account in the browser`);
    console.log(`  📱 Responsive Multi-device Architecture`);
    console.log(`========================================\n`);
  return {server,io,close:()=>new Promise(resolve=>{
    automaticBackups.stop();
    io.close(()=>server.close(()=>{require('./src/database/db').db.getRawDb().close();resolve();}));
  })};
}

if (require.main === module) {
  startServer().catch(err => {
    console.error('Server Startup Failed:', err);
    process.exit(1);
  });
}

module.exports = { startServer };
