const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { createAutomaticBackup, removeExpiredBackups } = require('../src/services/automatic-backup');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nokta-backup-'));
try {
  const source = new DatabaseSync(path.join(root, 'source.sqlite'));
  source.exec("CREATE TABLE proof(value TEXT); INSERT INTO proof VALUES ('ok')");
  const backup = createAutomaticBackup(source, path.join(root, 'backups'));
  const restored = new DatabaseSync(backup, { readOnly: true });
  assert.equal(restored.prepare('SELECT value FROM proof').get().value, 'ok');
  restored.close();
  source.close();

  const old = new Date('2026-01-01T00:00:00Z');
  fs.utimesSync(backup, old, old);
  assert.deepEqual(removeExpiredBackups(path.dirname(backup), 30, new Date('2026-03-01T00:00:00Z')), [backup]);
  assert.equal(fs.existsSync(backup), false);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
