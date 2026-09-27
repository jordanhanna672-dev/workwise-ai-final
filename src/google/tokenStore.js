'use strict';
/**
 * Stores the Google OAuth refresh/access token on disk, reusing the same
 * AES-256-GCM-if-a-key-is-set approach as src/db/json-store.js (see that file for the
 * full reasoning). Kept as a small, separate module rather than sharing
 * code with db.js directly - the duplication is a few lines of
 * encrypt/decrypt logic, which is a reasonable trade against coupling two
 * otherwise-unrelated concerns (task storage vs. OAuth token storage)
 * through a shared internal module.
 *
 * A refresh token is long-lived credential material - if it leaks, it
 * grants ongoing read access to the account's Gmail/Calendar data - so
 * this file is git-ignored and, when DATA_ENCRYPTION_KEY is set, encrypted
 * exactly like the task store.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TOKEN_FILE = path.join(__dirname, '..', '..', 'data', 'google-token.json');

function getKey() {
  const hex = process.env.DATA_ENCRYPTION_KEY;
  if (!hex) return null;
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) return null; // db.js already surfaces the loud error for this; stay quiet here
  return key;
}

function encrypt(plaintextJson, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintextJson, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({ encrypted: true, iv: iv.toString('hex'), tag: tag.toString('hex'), data: encrypted.toString('hex') });
}

function decrypt(payload, key) {
  const iv = Buffer.from(payload.iv, 'hex');
  const tag = Buffer.from(payload.tag, 'hex');
  const data = Buffer.from(payload.data, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function readToken() {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  const raw = fs.readFileSync(TOKEN_FILE, 'utf8');
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return null;
  }
  const key = getKey();
  if (parsed && parsed.encrypted) {
    if (!key) return null; // encrypted on disk but no key available right now
    try {
      return JSON.parse(decrypt(parsed, key));
    } catch (err) {
      return null; // wrong/missing key - treat as "not connected" rather than crashing
    }
  }
  return parsed;
}

function writeToken(tokenData) {
  const dir = path.dirname(TOKEN_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const key = getKey();
  const json = JSON.stringify(tokenData, null, 2);
  fs.writeFileSync(TOKEN_FILE, key ? encrypt(json, key) : json, 'utf8');
}

function clearToken() {
  if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE);
}

module.exports = { readToken, writeToken, clearToken, TOKEN_FILE };
