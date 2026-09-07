const http = require('http');

function isNoktaServerRunning(port, timeoutMs = 2000) {
  return new Promise(resolve => {
    const request = http.get({ hostname: '127.0.0.1', port, path: '/api/auth/setup-status', timeout: timeoutMs }, response => {
      response.resume();
      resolve(response.statusCode === 200 && String(response.headers['content-type'] || '').includes('application/json'));
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

module.exports = { isNoktaServerRunning };
