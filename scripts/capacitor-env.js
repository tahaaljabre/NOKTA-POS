// The local Node runtime occasionally cannot read the Windows account record.
// Capacitor only needs this information for terminal formatting, so provide a
// conservative fallback while generating the native project.
const os = require('os');
const originalUserInfo = os.userInfo;
os.userInfo = options => {
  try {
    return originalUserInfo(options);
  } catch {
    return {
      uid: -1,
      gid: -1,
      username: process.env.USERNAME || 'user',
      homedir: process.env.USERPROFILE || process.cwd(),
      shell: null
    };
  }
};

const cliPath = process.argv[2];
if (!cliPath) {
  console.error('Capacitor CLI path is required.');
  process.exit(1);
}
process.argv = [process.argv[0], cliPath, ...process.argv.slice(3)];
require(require('path').resolve(cliPath));
