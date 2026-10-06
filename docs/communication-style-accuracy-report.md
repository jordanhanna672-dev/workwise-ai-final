# Communication-Style Accuracy Report

Mode: **heuristic**
Dataset: `data/communication-style-items.json` (12 items across 4 phrasing categories)

## Why this exists

Written in direct response to the team's Unit 6 Ethics & Security
discussion, which raised a specific concern under ACM Code of Ethics
clause 1.4 ("Be fair and take action not to discriminate"): the
extractor's patterns were built and tuned almost entirely against
direct, fairly formal English phrasing ("Please send this by Friday").
Real workplace communication varies far more than that — across
non-native English speakers, more indirect communication norms, and
people who write concisely with little social framing. A "neutral"
extraction pipeline that quietly performs worse for any of these groups
produces an unequal outcome even though nothing in the code explicitly
treats anyone differently.

This benchmark does not diagnose *why* any gap exists, and it does not
claim to represent any real demographic group precisely — it tests
**phrasing patterns**, not people.

## The headline finding: pass/fail metrics hid the real gap (now fixed)

The same has_deadline / min_subtasks metrics used in
[accuracy-baseline-report.md](./accuracy-baseline-report.md) score this
dataset at **100% on every category**. Taken alone, that looks like "no
bias found" — and that was exactly the trap during development.
Manually inspecting the real output surfaced something those metrics
completely missed: **for indirect/hedged and non-native-pattern
phrasing, the extractor's clause-splitting was treating hedging
language itself as if it were a separate actionable subtask.**

Before the fix, on this same dataset: indirect/hedged phrasing produced
junk subtasks like *"This isn't urgent or anything"* and *"but whenever
you get a moment"* at a **44% junk-subtask rate (4/9)**; non-native
phrasing produced fragments like *"is very important for team meeting"*
and *"please to send when is possible"* at a **43% rate (3/7)**.
Concise/direct and passive/impersonal phrasing were unaffected (0%
both). This was a real, evidenced instance of the ACM 1.4 risk the
team's ethics discussion raised: someone writing in an indirect or
non-native style wasn't getting an extraction failure that looked
obviously broken — they were getting a *worse, noisier* result that
still passed a shallow accuracy check, which is arguably harder to
notice and fix than an outright miss.

**Fix applied:** `src/extractor.js`'s `guessSubtasks` now filters
hedging/filler fragments (`isLikelyJunkSubtask`) out of its output
before returning, falling back to the unfiltered list only if filtering
would remove every subtask. The current run, after that fix:

| Category | Junk subtasks / total | Titles truncated (>80 chars) |
|---|---|---|
| Indirect / hedged phrasing ("I was wondering if maybe...", "if that's not too much trouble") | 0/5 (0%) | 3/3 |
| Very concise / low-padding phrasing ("Report. Friday. Need slides too.") | 0/6 (0%) | 0/3 |
| Common non-native-English phrasing patterns (simplified grammar, article omission) | 0/4 (0%) | 2/3 |
| Passive / impersonal phrasing ("The report needs to be finalized...") | 0/6 (0%) | 0/3 |

Junk-subtask rate is now 0% across every category in this dataset. One
gap remains, deliberately not patched in the same pass (see "Honest
takeaway" below): **title truncation is still higher for indirect and
non-native phrasing** — `guessTitle`'s "take the first sentence"
approach still produces a long, truncated title for verbose phrasing
styles, which is a real but differently-scoped problem from the
subtask-splitting bug above.

Concrete examples from the current run:
- **style-01** (indirect_hedged): title `"I was wondering if maybe you might have a chance to take a look at the budget..."`
- **style-02** (indirect_hedged): title `"This isn't urgent or anything, but whenever you get a moment, it would be gre..."`
- **style-03** (indirect_hedged): title `"I don't want to be a bother, but I was hoping we could possibly find some tim..."`
- **style-07** (non_native_pattern): title `"Please you can send report before Friday come, is very important for team mee..."`
- **style-09** (non_native_pattern): title `"Team is waiting for the numbers from budget, please to send when is possible,..."`

## Pass/fail metrics by category (for completeness — see caveat above)

| Category | Items | Deadline accuracy | Subtask accuracy | Both correct |
|---|---|---|---|---|
| Indirect / hedged phrasing ("I was wondering if maybe...", "if that's not too much trouble") | 3 | 100.0% | 100.0% | 100.0% |
| Very concise / low-padding phrasing ("Report. Friday. Need slides too.") | 3 | 100.0% | 100.0% | 100.0% |
| Common non-native-English phrasing patterns (simplified grammar, article omission) | 3 | 100.0% | 100.0% | 100.0% |
| Passive / impersonal phrasing ("The report needs to be finalized...") | 3 | 100.0% | 100.0% | 100.0% |


## What's graded

- **Deadline detection / subtask count** (table above): coarse presence/count checks, kept for consistency with the other accuracy reports. **Shown here specifically to demonstrate that these checks are not enough on their own** — see the headline finding above.
- **Junk subtask rate**: the real signal for this report. A subtask is flagged as likely junk if it's short (≤6 words) and matches a known hedging/filler pattern (see `isLikelyJunkSubtask` in `scripts/accuracy-benchmark.js`) — a best-effort heuristic, not a precise measurement.
- **Title truncation**: whether the extracted title had to be cut off at 80 characters, a rough proxy for whether `guessTitle`'s "just take the first sentence" approach produces something readable for a given phrasing style.

## Honest takeaway and next step

The junk-subtask gap was real, evidenced, and has a fix in place with
before/after numbers to show for it. The title-truncation gap is real,
evidenced, and **deliberately left unfixed in this pass** — shortening
`guessTitle`'s output for verbose phrasing without accidentally
cutting off the actual actionable content is a different, riskier change
than filtering already-split subtask fragments, and deserves its own
focused pass with its own before/after validation rather than being
rushed in alongside this fix. LLM mode should also be checked
separately for both gaps before assuming it doesn't share them — a
language model asked for "actionable subtasks" may or may not correctly
discard hedging language on its own, and that's untested here.

This is a 12-item, single-team-authored dataset. It was enough to find
and fix one real bug, which is more than a hypothetical concern would
have produced — but it is not enough to be the last word on this
category of risk. The team's own stated plan (testing extraction
accuracy across varied phrasing styles before the final release) should
include real messages from people outside the team, not just
team-authored approximations of what varied phrasing looks like, and
should re-run this same benchmark against that real data before
declaring the concern resolved.

## How to reproduce

```
node scripts/accuracy-benchmark.js
```

This runs alongside the tuning-set/held-out-set benchmark and regenerates
both reports in the same command.
