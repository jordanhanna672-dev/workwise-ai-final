'use strict';
/**
 * Performance benchmark (Week 6 deliverable).
 *
 * Measures two things against a running instance of the server:
 *   1. Plain API response time (GET /api/tasks) - baseline app responsiveness
 *   2. AI extraction latency (POST /api/ingest) - the cost of the AI feature specifically
 *
 * This starts its own server instance on an unused port so it can be run
 * standalone (`node scripts/performance-benchmark.js`) without you needing
 * to have `npm start` running in another terminal first.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4123; // distinct from the default dev port so this can run alongside it
const N_REQUESTS = 20;
const REPORT_PATH = path.join(__dirname, '..', 'docs', 'performance-benchmark-report.md');

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const start = process.hrtime.bigint();
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: urlPath,
        method,
        headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => {
          const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
          resolve({ status: res.statusCode, ms, body: chunks });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    p50: p(0.5),
    p95: p(0.95),
  };
}

async function main() {
  // Boot a fresh server instance for the benchmark. server.js only
  // auto-listens when run as the main module (`node server.js`), so when
  // required as a library here we start it explicitly on our own port.
  delete require.cache[require.resolve('../server')];
  const server = require('../server');
  await new Promise((resolve, reject) => {
    server.listen(PORT, resolve);
    server.once('error', reject);
  });

  console.log(`Benchmark server running on port ${PORT}...`);

  // --- 1. Plain API latency: GET /api/tasks ---
  const apiSamples = [];
  for (let i = 0; i < N_REQUESTS; i++) {
    const { ms, status } = await request('GET', '/api/tasks');
    if (status !== 200) throw new Error(`GET /api/tasks returned ${status}`);
    apiSamples.push(ms);
  }
  const apiStats = stats(apiSamples);

  // --- 2. AI extraction latency: POST /api/ingest ---
  const sampleMessages = [
    'Can you send the Q3 report and slides by Friday? Also loop in Priya.',
    'Reminder: sprint planning tomorrow at 10am, bring your estimates.',
    'The vendor contract needs review, redlining, and sign-off by 2026-10-01.',
    'hey can you take a look at this PR sometime',
    'Please submit the expense report by end of month.',
  ];
  const ingestSamples = [];
  for (let i = 0; i < N_REQUESTS; i++) {
    const text = sampleMessages[i % sampleMessages.length];
    const { ms, status } = await request('POST', '/api/ingest', { text, source: 'email' });
    if (status !== 200) throw new Error(`POST /api/ingest returned ${status}`);
    ingestSamples.push(ms);
  }
  const ingestStats = stats(ingestSamples);
  const mode = process.env.OPENAI_API_KEY ? 'llm' : 'heuristic';

  server.close();

  const report = `# Performance Benchmark Report

Generated: ${new Date().toISOString()}
AI extraction mode during this run: **${mode}**
Samples per measurement: ${N_REQUESTS}
Environment: single local instance, no concurrent load (see "Limitations" below)

## GET /api/tasks (baseline API response time)

| Stat | ms |
|---|---|
| Min | ${apiStats.min.toFixed(2)} |
| Avg | ${apiStats.avg.toFixed(2)} |
| p50 | ${apiStats.p50.toFixed(2)} |
| p95 | ${apiStats.p95.toFixed(2)} |
| Max | ${apiStats.max.toFixed(2)} |

## POST /api/ingest (AI extraction latency)

| Stat | ms |
|---|---|
| Min | ${ingestStats.min.toFixed(2)} |
| Avg | ${ingestStats.avg.toFixed(2)} |
| p50 | ${ingestStats.p50.toFixed(2)} |
| p95 | ${ingestStats.p95.toFixed(2)} |
| Max | ${ingestStats.max.toFixed(2)} |

## Reading these numbers

- In **heuristic mode**, ingest latency should be close to baseline API latency, since no network call is made — the cost is just regex/string processing.
- In **llm mode**, ingest latency is dominated by the OpenAI API round-trip (typically several hundred ms to a few seconds), not by anything in this codebase. If you're establishing a "baseline for the prototype" per the backlog's Week 4 performance requirement, run this script once in each mode and record both — the gap between them *is* the cost of the AI feature.

## Limitations of this benchmark

- Single sequential requests, not concurrent load — this measures latency, not throughput or scalability under many simultaneous users. That's a reasonable scope for a prototype baseline, not for a production capacity claim.
- Runs against the JSON-file data store, which does not represent PostgreSQL's performance characteristics under real concurrent access.
- LLM-mode numbers will vary run to run based on OpenAI's live API load and are not something this project controls.

## How to reproduce

\`\`\`
node scripts/performance-benchmark.js                     # heuristic mode
node --env-file=.env scripts/performance-benchmark.js     # llm mode, if OPENAI_API_KEY is set
\`\`\`
`;

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, report, 'utf8');

  console.log(`GET /api/tasks   — avg ${apiStats.avg.toFixed(2)}ms, p95 ${apiStats.p95.toFixed(2)}ms`);
  console.log(`POST /api/ingest — avg ${ingestStats.avg.toFixed(2)}ms, p95 ${ingestStats.p95.toFixed(2)}ms (mode: ${mode})`);
  console.log(`Report written to ${path.relative(process.cwd(), REPORT_PATH)}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
