const fs = require('fs');

// Check i18n.js
try {
  const i18n = fs.readFileSync('public/i18n.js', 'utf8');
  new Function(i18n);
  console.log('i18n.js: SYNTAX OK');
} catch(e) {
  console.log('i18n.js SYNTAX ERROR:', e.message);
}

// Check app.js
try {
  const app = fs.readFileSync('public/js/app.js', 'utf8');
  new Function(app);
  console.log('app.js: SYNTAX OK');
} catch(e) {
  console.log('app.js SYNTAX ERROR:', e.message);
}
