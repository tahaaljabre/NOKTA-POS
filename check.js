const fs = require('fs');

// Check translation dictionaries and engine in browser load order.
try {
  const i18n = ['public/i18n/ar.js', 'public/i18n/en.js', 'public/i18n.js']
    .map(file => fs.readFileSync(file, 'utf8'))
    .join('\n');
  new Function(i18n);
  console.log('i18n bundle: SYNTAX OK');
} catch(e) {
  console.log('i18n bundle SYNTAX ERROR:', e.message);
}

// Check the split application core in browser load order.
try {
  const app = [
    'app-state.js', 'offline-order-queue.js', 'offline-data-cache.js',
    'api-client.js', 'view-loader.js', 'app-bootstrap.js',
    'authentication.js', 'navigation.js', 'ui-feedback.js', 'realtime-sync.js'
  ].map(file => fs.readFileSync(`public/js/core/${file}`, 'utf8')).join('\n');
  new Function(app);
  console.log('application core: SYNTAX OK');
} catch(e) {
  console.log('application core SYNTAX ERROR:', e.message);
}
