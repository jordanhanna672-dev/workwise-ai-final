'use strict';
/**
 * Very small JSON-file "database", now with optional encryption at rest.
 *
 * This is one of two interchangeable repository implementations under
 * src/db/ - see src/db/index.js for which one is actually used (it's
 * chosen automatically based on whether DATABASE_URL is set). This file
 * is the original zero-install path: no server to run, no account to
 * create, works immediately after unzipping. See
 * src/db/postgres-store.js for the PostgreSQL-backed sibling, used when
 * this app is deployed somewhere with an ephemeral filesystem (see
 * docs/adr/0005-postgres-on-render.md for why that matters).
 *
 * Security pass (Week 6 deliverable): task text can include names,
 * deadlines, and workplace details, so "data privacy" was flagged as a
 * risk in the original pitch. If DATA_ENCRYPTION_KEY is set (a 64-char
 * hex string = 32 bytes), the file on disk is encrypted with
 * AES-256-GCM - authenticated encryption, so a tampered file is
 * detected rather than silently accepted. Generate a key with:
 *
 *   node scripts/generate-encryption-key.js
 *
 * If no key is set, the store falls back to plain JSON so the app still
 * runs out of the box - a clear one-time warning is logged either way,
 * so "encryption at rest is off" is never a silent, undocumented state.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'tasks.json');

let warnedThisProcess = false;

function getKey() {
  const hex = process.env.DATA_ENCRYPTION_KEY;
  if (!hex) return null;
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error(
      `DATA_ENCRYPTION_KEY must decode to exactly 32 bytes (64 hex chars); got ${key.length} bytes. ` +
        'Generate a valid key with: node scripts/generate-encryption-key.js'
    );
  }
  return key;
}

function warnOnce(key) {
  if (warnedThisProcess) return;
  warnedThisProcess = true;
  if (key) {
    console.log('Data store: encryption at rest is ON (AES-256-GCM).');
  } else {
    console.log(
      'Data store: encryption at rest is OFF (no DATA_ENCRYPTION_KEY set) - fine for local demos, ' +
        'not recommended once real workplace data is involved. See src/db/json-store.js for how to enable it.'
    );
  }
}

function encrypt(plaintextJson, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintextJson, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    encrypted: true,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex'),
  });
}

function decrypt(payload, key) {
  const iv = Buffer.from(payload.iv, 'hex');
  const tag = Buffer.from(payload.tag, 'hex');
  const data = Buffer.from(payload.data, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]); // throws if tampered/wrong key
  return plaintext.toString('utf8');
}

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) writeAll([]);
}

function readAll() {
  ensureStore();
  const key = getKey();
  warnOnce(key);
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  if (!raw) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return []; // a corrupted data file shouldn't crash the whole app
  }

  if (parsed && parsed.encrypted) {
    if (!key) {
      throw new Error(
        'Data file is encrypted but DATA_ENCRYPTION_KEY is not set in this environment. ' +
          'Set the same key that was used to encrypt it, or delete data/tasks.json to start fresh.'
      );
    }
    try {
      return JSON.parse(decrypt(parsed, key));
    } catch (err) {
      throw new Error(
        'Failed to decrypt data/tasks.json - the key may be wrong, or the file may have been tampered with.'
      );
    }
  }

  // Plain, unencrypted array (either encryption is off, or this is a
  // pre-existing plaintext file from before encryption was enabled).
  return Array.isArray(parsed) ? parsed : [];
}

function writeAll(tasks) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const key = getKey();
  warnOnce(key);
  const plaintextJson = JSON.stringify(tasks, null, 2);
  const toWrite = key ? encrypt(plaintextJson, key) : plaintextJson;
  fs.writeFileSync(DATA_FILE, toWrite, 'utf8');
}

let idCounter = null;
function nextId(tasks) {
  if (idCounter === null) {
    idCounter = tasks.reduce((max, t) => Math.max(max, t.id || 0), 0);
  }
  idCounter += 1;
  return idCounter;
}

function getAll() {
  return readAll();
}

function getById(id) {
  return readAll().find((t) => t.id === Number(id)) || null;
}

function insert(task) {
  const tasks = readAll();
  const record = Object.assign({}, task, { id: nextId(tasks) });
  tasks.push(record);
  writeAll(tasks);
  return record;
}

function update(id, patch) {
  const tasks = readAll();
  const idx = tasks.findIndex((t) => t.id === Number(id));
  if (idx === -1) return null;
  tasks[idx] = Object.assign({}, tasks[idx], patch, { id: tasks[idx].id });
  writeAll(tasks);
  return tasks[idx];
}

function remove(id) {
  const tasks = readAll();
  const next = tasks.filter((t) => t.id !== Number(id));
  const changed = next.length !== tasks.length;
  if (changed) writeAll(next);
  return changed;
}

function resetForTests(tasks = []) {
  idCounter = null;
  warnedThisProcess = true; // keep test output quiet
  writeAll(tasks);
}

module.exports = { getAll, getById, insert, update, remove, resetForTests, DATA_FILE };
