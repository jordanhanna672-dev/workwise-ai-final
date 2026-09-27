'use strict';
/**
 * PostgreSQL-backed repository - the sibling to json-store.js, used when
 * DATABASE_URL is set (see src/db/index.js for the switch). Implements
 * the exact same function signatures as json-store.js: getAll, getById,
 * insert, update, remove, resetForTests. Nothing above this module
 * (server.js, prioritize.js, extractor.js) needs to know which backend
 * is actually in use - that was the whole point of the interface ADR
 * 0002 documented back in the alpha.
 *
 * Why this exists at all: see docs/adr/0005-postgres-on-render.md. In
 * short - a one-click "Deploy your own instance" button (README's
 * deploy section) needs task data to survive Render's free-tier
 * ephemeral filesystem, which the JSON file cannot do. Postgres can.
 *
 * HONESTY NOTE ABOUT TESTING: this module was written without access to
 * a live PostgreSQL instance or an internet connection to install `pg`
 * (this development environment has neither). It's written carefully
 * against `pg`'s documented API and the same interface json-store.js
 * already proves correct, but it has NOT been run against a real
 * database. Test it yourself before relying on it - see the "Testing
 * this yourself" section of docs/adr/0005-postgres-on-render.md for a
 * five-minute local Docker Postgres setup that does exactly that.
 */

let Pool;
try {
  ({ Pool } = require('pg'));
} catch (err) {
  throw new Error(
    'DATABASE_URL is set, but the "pg" package is not installed. ' +
      'Run: npm install pg --no-save (or see docs/adr/0005-postgres-on-render.md).'
  );
}

const useSSL =
  Boolean(process.env.DATABASE_URL) &&
  !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) &&
  process.env.PGSSLMODE !== 'disable';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

let schemaReady = null;

/** Creates the tasks table if it doesn't exist yet. Runs once per process, lazily, on first use. */
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        deadline TIMESTAMPTZ,
        subtasks JSONB NOT NULL DEFAULT '[]'::jsonb,
        source TEXT NOT NULL DEFAULT 'manual',
        importance INTEGER NOT NULL DEFAULT 3,
        status TEXT NOT NULL DEFAULT 'approved',
        manual_override INTEGER,
        extraction_reasoning JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  }
  return schemaReady;
}

/** Converts a DB row (snake_case, Date objects) to this app's task shape (camelCase, ISO strings). */
function rowToTask(row) {
  return {
    id: row.id,
    title: row.title,
    deadline: row.deadline ? new Date(row.deadline).toISOString() : null,
    subtasks: row.subtasks || [],
    source: row.source,
    importance: row.importance,
    status: row.status,
    manualOverride: row.manual_override,
    extractionReasoning: row.extraction_reasoning || [],
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

async function getAll() {
  await ensureSchema();
  const { rows } = await pool.query('SELECT * FROM tasks ORDER BY id ASC');
  return rows.map(rowToTask);
}

async function getById(id) {
  await ensureSchema();
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [Number(id)]);
  return rows.length ? rowToTask(rows[0]) : null;
}

async function insert(task) {
  await ensureSchema();
  const { rows } = await pool.query(
    `INSERT INTO tasks (title, deadline, subtasks, source, importance, status, manual_override, extraction_reasoning)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      task.title,
      task.deadline || null,
      JSON.stringify(task.subtasks || []),
      task.source || 'manual',
      task.importance || 3,
      task.status || 'approved',
      task.manualOverride != null ? task.manualOverride : null,
      JSON.stringify(task.extractionReasoning || []),
    ]
  );
  return rowToTask(rows[0]);
}

async function update(id, patch) {
  await ensureSchema();
  const existing = await getById(id);
  if (!existing) return null;

  const merged = Object.assign({}, existing, patch, { id: existing.id });
  const { rows } = await pool.query(
    `UPDATE tasks
     SET title = $1, deadline = $2, subtasks = $3, source = $4, importance = $5,
         status = $6, manual_override = $7, extraction_reasoning = $8
     WHERE id = $9
     RETURNING *`,
    [
      merged.title,
      merged.deadline || null,
      JSON.stringify(merged.subtasks || []),
      merged.source,
      merged.importance,
      merged.status,
      merged.manualOverride != null ? merged.manualOverride : null,
      JSON.stringify(merged.extractionReasoning || []),
      Number(id),
    ]
  );
  return rows.length ? rowToTask(rows[0]) : null;
}

async function remove(id) {
  await ensureSchema();
  const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [Number(id)]);
  return rowCount > 0;
}

/** Wipes the table and optionally seeds it - mirrors json-store.js's resetForTests, for parity if you write your own integration tests against a real database. */
async function resetForTests(tasks = []) {
  await ensureSchema();
  await pool.query('TRUNCATE TABLE tasks RESTART IDENTITY');
  for (const task of tasks) {
    await insert(task);
  }
}

module.exports = { getAll, getById, insert, update, remove, resetForTests };
