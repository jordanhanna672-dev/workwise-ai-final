# Performance Benchmark Report

Generated: 2026-09-20T21:51:17.717Z
AI extraction mode during this run: **heuristic**
Samples per measurement: 20
Environment: single local instance, no concurrent load (see "Limitations" below)

## GET /api/tasks (baseline API response time)

| Stat | ms |
|---|---|
| Min | 0.33 |
| Avg | 1.53 |
| p50 | 0.57 |
| p95 | 17.13 |
| Max | 17.13 |

## POST /api/ingest (AI extraction latency)

| Stat | ms |
|---|---|
| Min | 0.40 |
| Avg | 0.86 |
| p50 | 0.56 |
| p95 | 3.16 |
| Max | 3.16 |

## Reading these numbers

- In **heuristic mode**, ingest latency should be close to baseline API latency, since no network call is made — the cost is just regex/string processing.
- In **llm mode**, ingest latency is dominated by the OpenAI API round-trip (typically several hundred ms to a few seconds), not by anything in this codebase. If you're establishing a "baseline for the prototype" per the backlog's Week 4 performance requirement, run this script once in each mode and record both — the gap between them *is* the cost of the AI feature.

## Limitations of this benchmark

- Single sequential requests, not concurrent load — this measures latency, not throughput or scalability under many simultaneous users. That's a reasonable scope for a prototype baseline, not for a production capacity claim.
- Runs against the JSON-file data store, which does not represent PostgreSQL's performance characteristics under real concurrent access.
- LLM-mode numbers will vary run to run based on OpenAI's live API load and are not something this project controls.

## How to reproduce

```
node scripts/performance-benchmark.js                     # heuristic mode
node --env-file=.env scripts/performance-benchmark.js     # llm mode, if OPENAI_API_KEY is set
```
