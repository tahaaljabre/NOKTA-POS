const assert = require('assert');
const fs = require('fs');
const source = fs.readFileSync('scripts/capacitor-env.js', 'utf8');
assert.match(source, /process\.argv = \[process\.argv\[0\], cliPath/);
assert.match(source, /require\(require\('path'\)\.resolve\(cliPath\)\)/);
