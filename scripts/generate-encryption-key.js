'use strict';
/**
 * Generates a random 32-byte (256-bit) key, hex-encoded, suitable for
 * DATA_ENCRYPTION_KEY in .env. Run once per environment and keep the
 * key out of version control (it already lives in .env, which is
 * git-ignored).
 */
const crypto = require('crypto');

const key = crypto.randomBytes(32).toString('hex');
console.log('\nGenerated a new 256-bit encryption key.');
console.log('Add this line to your .env file:\n');
console.log(`DATA_ENCRYPTION_KEY=${key}`);
console.log('\nKeep this key safe - if it is lost, any existing encrypted data/tasks.json cannot be recovered.');
console.log('If you change this key later, delete data/tasks.json first (it can only be read by the key that encrypted it).\n');
