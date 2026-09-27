'use strict';
/**
 * WorkWise AI - server.
 *
 * Team:
 *   Jordan Hanna   - Lead Architect
 *   Ti'Asia Gause  - Interface Designer
 *   Cal Reed       - Integration Lead
 *
 * Deliberately built on Node's built-in `http` module only (no Express,
 * no bundler) so the *entire app* runs with nothing more than
 * `node server.js` - no `npm install` step required to demo it. See
 * README.md "Why no Express / React build step?" for the
 * reasoning and the upgrade path back to the target stack.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const db = require('./src/db');
const { extractTask } = require('./src/extractor');
const { rankTasks } = require('./src/prioritize');
const { filterTasks } = require('./src/search');
const google = require('./src/google');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

// A small helper used by every API route below: sets the right headers
// and writes a JavaScript object out as a JSON HTTP response.
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

// Node's raw `http` module delivers a request body in small chunks over
// time rather than as one complete string (unlike higher-level
// frameworks such as Express, which do this for you automatically) - this
// function collects all those chunks together, then parses the result as
// JSON once the request has fully arrived. Used by every POST/PUT route
// below to read whatever the frontend sent in the request body.
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) req.destroy(); // basic guard against huge payloads
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// Serves the frontend's actual files (index.html, app.js, styles.css)
// out of the public/ folder. Any request that isn't for one of the
// /api/* routes below ends up here.
function serveStatic(req, res, pathname) {
  const filePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.join(PUBLIC_DIR, filePath);
  // Prevent path traversal outside the public directory.
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(fullPath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// This one function handles every "/api/..." URL the frontend can call.
// There's no routing library here (see the file-level comment at the
// top) - it's just a series of `if (pathname === '...' && req.method === '...')`
// checks, each one matching a single route from docs/api.md. `query` is
// whatever came after the "?" in the URL (e.g. ?q=vendor), already parsed
// into a plain object by the code near the bottom of this file.
async function handleApi(req, res, pathname, query = {}) {
  try {
    // GET /api/tasks - full prioritized list. Optional ?q=<term> filters
    // by title, subtask text, or source, similar to a Gmail-style search
    // box (see src/search.js).
    if (pathname === '/api/tasks' && req.method === 'GET') {
      const allTasks = await db.getAll();
      const tasks = allTasks.filter((t) => t.status !== 'rejected');
      const ranked = rankTasks(tasks);
      const searchTerm = typeof query.q === 'string' ? query.q : '';
      return sendJson(res, 200, { tasks: filterTasks(ranked, searchTerm) });
    }

    // POST /api/ingest - run the Smart Task Extractor on raw text (does NOT save)
    if (pathname === '/api/ingest' && req.method === 'POST') {
      const { text, source } = await readBody(req);
      if (!text || !text.trim()) return sendJson(res, 400, { error: 'text is required' });
      const suggestion = await extractTask(text, source || 'email');
      return sendJson(res, 200, { suggestion });
    }

    // POST /api/tasks - approve a suggestion (or create a manual task)
    if (pathname === '/api/tasks' && req.method === 'POST') {
      const payload = await readBody(req);
      if (!payload.title || !payload.title.trim()) {
        return sendJson(res, 400, { error: 'title is required' });
      }
      const record = await db.insert({
        title: payload.title,
        deadline: payload.deadline || null,
        subtasks: Array.isArray(payload.subtasks) ? payload.subtasks : [],
        source: payload.source || 'manual',
        importance: payload.importance || 3,
        status: 'approved',
        manualOverride: null,
        extractionReasoning: payload.extractionReasoning || [],
        createdAt: new Date().toISOString(),
      });
      return sendJson(res, 201, { task: record });
    }

    // PUT /api/tasks/:id - edit a task (title, deadline, importance, override, subtasks, status)
    const editMatch = pathname.match(/^\/api\/tasks\/(\d+)$/);
    if (editMatch && req.method === 'PUT') {
      const patch = await readBody(req);
      const updated = await db.update(editMatch[1], patch);
      if (!updated) return sendJson(res, 404, { error: 'task not found' });
      return sendJson(res, 200, { task: updated });
    }

    // DELETE /api/tasks/:id
    if (editMatch && req.method === 'DELETE') {
      const removed = await db.remove(editMatch[1]);
      if (!removed) return sendJson(res, 404, { error: 'task not found' });
      return sendJson(res, 200, { deleted: true });
    }

    // GET /api/google/status - whether the optional Gmail/Calendar
    // integration is configured (env vars present) and authorized
    // (user has completed the OAuth consent flow at least once)
    if (pathname === '/api/google/status' && req.method === 'GET') {
      return sendJson(res, 200, {
        configured: google.isConfigured(),
        authorized: google.isAuthorized(),
        gmailCategories: google.getGmailCategories(),
      });
    }

    // GET /api/google/sync?category=primary|promotions|social|updates|forums|all&q=<search term>
    // Pull recent Gmail + Calendar items through the Smart Task
    // Extractor. Returns suggestions only - nothing is saved, same
    // human-approval rule as /api/ingest. category defaults to
    // "primary" inside src/google (see gmailClient.js for why). q is an
    // optional free-text search, like typing into Gmail's own search bar.
    if (pathname === '/api/google/sync' && req.method === 'GET') {
      const category = typeof query.category === 'string' ? query.category : undefined;
      const searchTerm = typeof query.q === 'string' ? query.q : undefined;
      const validCategories = google.getGmailCategories();
      if (category && category !== 'all' && !validCategories.includes(category)) {
        return sendJson(res, 400, { error: `Unknown category "${category}" - expected one of: ${validCategories.join(', ')}, or "all"` });
      }
      const suggestions = await google.syncAll({ category, searchTerm });
      return sendJson(res, 200, { suggestions });
    }

    return sendJson(res, 404, { error: 'unknown endpoint' });
  } catch (err) {
    return sendJson(res, 500, { error: err.message || 'internal error' });
  }
}

/** Handles the two non-API, non-static Google OAuth routes (redirects/HTML, not JSON). */
async function handleGoogleAuthRoutes(req, res, pathname, query) {
  if (pathname === '/auth/google') {
    if (!google.isConfigured()) {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      return res.end('Google integration is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.');
    }
    res.writeHead(302, { Location: google.getAuthUrl(PORT) });
    return res.end();
  }

  if (pathname === '/oauth2callback') {
    const code = query.get('code');
    const error = query.get('error');
    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end(`Google declined the connection: ${error}`);
    }
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('Missing authorization code.');
    }
    try {
      await google.handleOAuthCallback(code, PORT);
      res.writeHead(302, { Location: '/?google_connected=1' });
      return res.end();
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end(`Failed to complete Google authorization: ${err.message}`);
    }
  }

  res.writeHead(404);
  res.end('Not found');
}

// The actual web server. Every incoming request lands here first, and
// gets sent to exactly one of three places based on its URL:
//   - Google's OAuth redirect routes (only meaningful if Google
//     integration is configured - see src/google/)
//   - one of the JSON API routes handled above in handleApi()
//   - or, for everything else, a plain static file from public/
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  if (pathname === '/auth/google' || pathname === '/oauth2callback') {
    handleGoogleAuthRoutes(req, res, pathname, new URLSearchParams(parsed.query));
  } else if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname, parsed.query);
  } else {
    serveStatic(req, res, pathname);
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`WorkWise AI running at http://localhost:${PORT}`);
    if (!process.env.OPENAI_API_KEY) {
      console.log('OPENAI_API_KEY not set - Smart Task Extractor is running in heuristic (no-API-key) mode.');
    }
    if (google.isConfigured()) {
      console.log(`Google integration: configured${google.isAuthorized() ? ', connected' : ' - visit /auth/google to connect'}.`);
    } else {
      console.log('Google integration: not configured (optional) - see docs/google-integration.md to enable.');
    }
  });
}

module.exports = server;
