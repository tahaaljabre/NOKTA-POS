const fs = require('fs');
const path = require('path');

const PREFIX = 'pos-auto-';

function safeSqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function createDatabaseBackup(rawDb, backupDir, options = {}) {
  fs.mkdirSync(backupDir, { recursive: true });
  const now = options.now || new Date();
  const prefix = options.prefix || PREFIX;
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const destination = path.join(backupDir, `${prefix}${stamp}.sqlite`);
  rawDb.exec(`VACUUM INTO ${safeSqlString(destination)}`);
  return destination;
}

function createAutomaticBackup(rawDb, backupDir, now = new Date()) {
  return createDatabaseBackup(rawDb, backupDir, { now, prefix: PREFIX });
}

function removeExpiredBackups(backupDir, retentionDays = 30, now = new Date()) {
  if (!fs.existsSync(backupDir)) return [];
  const cutoff = now.getTime() - retentionDays * 86400000;
  const removed = [];
  for (const name of fs.readdirSync(backupDir)) {
    if (!name.startsWith(PREFIX) || !name.endsWith('.sqlite')) continue;
    const file = path.join(backupDir, name);
    if (fs.statSync(file).mtimeMs < cutoff) {
      fs.unlinkSync(file);
      removed.push(file);
    }
  }
  return removed;
}

function startAutomaticBackups(rawDb, dataDir, options = {}) {
  const backupDir = path.join(dataDir, 'backups');
  const intervalMs = options.intervalMs || 86400000;
  const run = () => {
    try {
      createAutomaticBackup(rawDb, backupDir);
      removeExpiredBackups(backupDir, options.retentionDays || 30);
    } catch (error) {
      console.error('Automatic database backup failed:', error.message);
    }
  };
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return { stop: () => clearInterval(timer), backupDir };
}

module.exports = { createDatabaseBackup, createAutomaticBackup, removeExpiredBackups, startAutomaticBackups };
