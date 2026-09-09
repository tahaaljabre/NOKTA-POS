const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { createDatabaseBackup, createAutomaticBackup, removeExpiredBackups } = require('../src/services/automatic-backup');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nokta-backup-'));
try {
  const source = new DatabaseSync(path.join(root, 'source.sqlite'));
  source.exec("CREATE TABLE proof(value TEXT); INSERT INTO proof VALUES ('ok')");
  const backup = createAutomaticBackup(source, path.join(root, 'backups'));
  const restored = new DatabaseSync(backup, { readOnly: true });
  assert.equal(restored.prepare('SELECT value FROM proof').get().value, 'ok');
  restored.close();

  const closingBackup = createDatabaseBackup(source, path.join(root, 'daily-closing'), {
    prefix: 'nokta-pos-closing-2026-09-09-'
  });
  assert.match(path.basename(closingBackup), /^nokta-pos-closing-2026-09-09-/);
  const closingCopy = new DatabaseSync(closingBackup, { readOnly: true });
  assert.equal(closingCopy.prepare('SELECT value FROM proof').get().value, 'ok');
  closingCopy.close();
  source.close();

  const old = new Date('2026-01-01T00:00:00Z');
  fs.utimesSync(backup, old, old);
  assert.deepEqual(removeExpiredBackups(path.dirname(backup), 30, new Date('2026-03-01T00:00:00Z')), [backup]);
  assert.equal(fs.existsSync(backup), false);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
