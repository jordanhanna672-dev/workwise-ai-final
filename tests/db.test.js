'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, '..', 'data', 'tasks.json');

function freshDb() {
  delete require.cache[require.resolve('../src/db')];
  return require('../src/db');
}

// These tests write to the real data/tasks.json (there's no separate test
// fixture location in this zero-dependency setup). That file is git-ignored
// runtime state, not a deliverable - but leaving it in an encrypted state
// after this file's tests run would break anything that reads it next
// (the dev server, the benchmark scripts) since they wouldn't have the
// randomly-generated key any more. Clean up after every test so the data
// file is always back to a normal, key-free, empty state for whatever
// runs next - a script, `npm start`, or another test file.
test.afterEach(() => {
  delete process.env.DATA_ENCRYPTION_KEY;
  fs.rmSync(DATA_FILE, { force: true });
});

test('without a key, tasks.json is stored as plain readable JSON', () => {
  delete process.env.DATA_ENCRYPTION_KEY;
  const db = freshDb();
  db.resetForTests([]);
  db.insert({ title: 'Plain task', source: 'manual' });

  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  assert.ok(Array.isArray(parsed), 'expected a plain array on disk when no key is set');
  assert.equal(parsed[0].title, 'Plain task');
});

test('with a key set, tasks.json is encrypted on disk and transparently decrypted through the API', () => {
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  const db = freshDb();
  db.resetForTests([]);
  db.insert({ title: 'Secret task', source: 'manual' });

  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.encrypted, true);
  assert.ok(!raw.includes('Secret task'), 'plaintext title must not appear anywhere in the file on disk');

  // Reading back through the module (same key) should transparently decrypt.
  const tasks = db.getAll();
  assert.equal(tasks[0].title, 'Secret task');

  delete process.env.DATA_ENCRYPTION_KEY;
});

test('reading encrypted data with the wrong key fails loudly instead of silently returning garbage', () => {
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  const db = freshDb();
  db.resetForTests([]);
  db.insert({ title: 'Secret task', source: 'manual' });

  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex'); // different key
  const db2 = freshDb();
  assert.throws(() => db2.getAll(), /Failed to decrypt/);

  delete process.env.DATA_ENCRYPTION_KEY;
});

test('an invalid key length is rejected with a clear error rather than a cryptic crypto error', () => {
  process.env.DATA_ENCRYPTION_KEY = 'not-a-valid-hex-key';
  const db = freshDb();
  assert.throws(() => db.getAll(), /must decode to exactly 32 bytes/);
  delete process.env.DATA_ENCRYPTION_KEY;
});
