'use strict';
/**
 * Picks the data store backend: PostgreSQL if DATABASE_URL is set
 * (typically because this app is deployed somewhere with an ephemeral
 * filesystem, like Render's free tier - see
 * docs/adr/0005-postgres-on-render.md), otherwise the original
 * zero-install JSON file (json-store.js).
 *
 * Everything above this module (server.js) calls getAll/getById/insert/
 * update/remove exactly the same way regardless of which backend is
 * live - that's the whole point of the shared interface ADR 0002
 * defined back in the alpha. The only user-visible difference: the
 * JSON store's functions happen to be synchronous and Postgres's are
 * necessarily async, which is why every call site in server.js awaits
 * them - awaiting a plain (non-Promise) value is always safe in JS, so
 * this didn't require two versions of server.js.
 */
module.exports = process.env.DATABASE_URL ? require('./postgres-store') : require('./json-store');
