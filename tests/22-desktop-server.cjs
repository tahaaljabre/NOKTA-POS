const assert = require('assert');
const http = require('http');
const { isNoktaServerRunning } = require('../src/desktop/server-probe');

(async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/api/auth/setup-status') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      return res.end('{}');
    }
    res.writeHead(404).end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  assert.equal(await isNoktaServerRunning(port), true);
  await new Promise(resolve => server.close(resolve));
  assert.equal(await isNoktaServerRunning(port, 100), false);
})().catch(error => { console.error(error); process.exit(1); });
