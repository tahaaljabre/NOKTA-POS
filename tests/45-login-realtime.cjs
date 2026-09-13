const fs = require('node:fs');
const assert = require('node:assert/strict');

const page = fs.readFileSync('public/index.html', 'utf8');
const realtime = fs.readFileSync('public/js/core/realtime-sync.js', 'utf8');
assert(page.includes('<script src="/socket.io/socket.io.js"></script>'));
assert(realtime.includes('connect: () => {}'));
assert(realtime.includes('disconnect: () => {}'));
console.log('PASS 45: login page loads Socket.IO and has a safe realtime fallback');
