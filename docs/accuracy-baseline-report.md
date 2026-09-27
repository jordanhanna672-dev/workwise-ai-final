# Smart Task Extractor — Accuracy Baseline Report

Generated: 2026-09-20T21:51:17.511Z
Mode: **heuristic** (heuristic = no OPENAI_API_KEY set; llm = real API call)

This report scores two separate datasets:

1. **Tuning set** (`data/seed-mock-items.json`, 25 items) — used during development to find and fix gaps in the pattern matching. High accuracy here mainly confirms known phrasing categories still work after changes; it is not a generalization measure.
2. **Held-out set** (`data/holdout-items.json`, 8 items) — written afterward and never used to tune the extractor. This is the more honest signal for how the extractor handles phrasing it wasn't specifically built for.

See also [communication-style-accuracy-report.md](./communication-style-accuracy-report.md) for a third dataset specifically testing phrasing-style diversity (indirect/hedged, concise, non-native-English patterns, passive/impersonal) — written in response to the team's Unit 6 Ethics & Security discussion (ACM Code of Ethics 1.4).

## Tuning set results

| Metric | Result |
|---|---|
| Deadline detection accuracy | **100.0%** (25/25) |
| Subtask-count accuracy | **100.0%** (25/25) |
| Both correct | **100.0%** |
| Run time | 6ms (0.2ms/item) |

### Tuning set failures
None — every item in this set passed both checks.

## Held-out set results (generalization signal)

| Metric | Result |
|---|---|
| Deadline detection accuracy | **75.0%** (6/8) |
| Subtask-count accuracy | **100.0%** (8/8) |
| Both correct | **75.0%** |
| Run time | 0ms (0.0ms/item) |

### Held-out set failures (genuine gaps, not yet fixed)
- **holdout-03** (email): expected deadline=true, got=false ⚠️ deadline mismatch; expected ≥3 subtasks, got 3
- **holdout-04** (chat): expected deadline=true, got=false ⚠️ deadline mismatch; expected ≥0 subtasks, got 2

## What's graded

- **Deadline detection**: did the extractor correctly decide a deadline exists (or doesn't)? This does not grade the exact date, only presence/absence — exact-date correctness is covered separately by the unit tests in `tests/extractor.test.js`.
- **Subtask count**: did the extractor produce at least as many subtasks as a human labeler expected? Producing more than expected is not penalized; producing fewer is.

## Honest takeaway

The gap between the tuning-set score and the held-out score is the real
headline number here, not either score in isolation. A large gap means the
heuristic rules are overfit to phrasing we happened to think of; a small gap
means the underlying approach generalizes reasonably well. Any held-out
failures above are legitimate, undocumented gaps in the current heuristic
mode (e.g., phrasing like "within 48 hours" or "close of business" is not
yet recognized) and are good candidates for the next iteration — or for LLM
mode, which is not limited to hand-written patterns.

## How to reproduce

```
node scripts/accuracy-benchmark.js
```

Or, with real LLM extraction enabled:

```
node --env-file=.env scripts/accuracy-benchmark.js
```

Re-run after any change to `src/extractor.js` and compare against this baseline. If you fix a held-out failure, consider moving that phrasing pattern into a *new* held-out example rather than the tuning set, so the held-out set keeps measuring genuine generalization rather than becoming something else that's been tuned to.
