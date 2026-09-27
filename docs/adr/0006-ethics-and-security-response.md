# ADR 0006: Response to the Unit 6 Ethics & Security discussion

## Status
Accepted.

## Context
The team's Unit 6 discussion ("The Ethics and Security of Our AI
Solution") identified three concrete issues in the Smart Task
Extractor: a STRIDE "Tampering" risk (prompt injection via untrusted
message text), a communication-style bias risk under ACM Code of Ethics
1.4, and an "approval fatigue" risk raised by an AI-generated red-team
critique and judged by the team as the most valid of the three points
raised. This ADR records what was actually implemented in response to
each, rather than leaving the discussion post as the only record of the
team's intentions.

## Decision

### 1. Prompt injection (STRIDE: Tampering)
Added `src/security.js`, a pattern-based detector for common
injection/jailbreak phrasing ("ignore previous instructions," fake
system-message framing, role-hijack attempts). This is deliberately one
layer of defense-in-depth, not a claim of complete protection:
1. The LLM system prompt (`buildSystemPrompt` in `src/extractor.js`)
   now explicitly instructs the model that message content is data to
   analyze, never instructions to follow, regardless of what it claims
   to be.
2. The raw message is wrapped in `<message-to-analyze>` delimiters in
   the API call, reinforcing that separation structurally.
3. `detectInjectionSignals` flags known injection phrasing so a human
   reviewer sees a specific, named warning rather than a suggestion
   that looks like any other.
4. Structurally, even a fully successful injection can only change a
   *suggested* task's title/deadline/subtasks - the extractor has no
   ability to send messages, click links, or take any action, and
   nothing it produces is saved without explicit human approval. This
   bounds the worst case even if layers 1-3 all fail.

### 2. Communication-style bias (ACM Code of Ethics 1.4)
Added `data/communication-style-items.json` (12 items across four
phrasing categories: indirect/hedged, concise/direct, common
non-native-English patterns, passive/impersonal) and extended
`scripts/accuracy-benchmark.js` to score it, producing
[docs/communication-style-accuracy-report.md](../communication-style-accuracy-report.md).

This surfaced a real, evidenced gap that the existing pass/fail metrics
(has_deadline, min_subtasks) did not catch: `guessSubtasks`'s
clause-splitting was treating hedging language itself as if it were a
separate actionable subtask, at a 44% "junk subtask" rate for
indirect/hedged phrasing and 43% for non-native patterns, versus 0% for
concise/direct and passive/impersonal phrasing. This is fixed -
`guessSubtasks` now filters hedge fragments via `isLikelyJunkSubtask`
(shared between `src/extractor.js` and the benchmark script, so both
use the same definition) - and the report documents the before/after
numbers rather than only the current, already-fixed state.

One related gap was found and **deliberately left unfixed in this
pass**: extracted titles are still more often truncated (cut off at 80
characters) for indirect and non-native phrasing, since `guessTitle`
still just takes the first sentence verbatim. This needs its own
focused change (shortening a title without cutting off the actual
actionable content is a different, riskier problem than filtering
already-split fragments) and is documented as an open item rather than
rushed alongside the subtask fix.

### 3. Approval fatigue (the team's highest-priority red-team finding)
Three concrete changes, matching the three mitigations named in the
discussion post:
- **Visible reasoning, extended to extraction**: every suggestion
  already carried a `reasoningLog` explaining the ranking; this now
  extends to the extraction itself, and the dashboard gained a second
  "How was this task extracted?" section (`task.extractionReasoning`)
  that was previously captured but never actually displayed anywhere -
  a real gap found and fixed while building this.
- **Flagging lower-confidence extractions instead of uniform styling**:
  every suggestion now carries `needsReview`/`flagReasons`, computed
  from confidence and injection signals. A flagged suggestion gets a
  visually distinct warning banner and border rather than looking like
  every other suggestion - directly addressing "a human-in-the-loop
  step only works if the human is actually looking."
- **A way to actually track edit/rejection rates**: there was
  previously no way to edit a suggestion at all - only approve as-is or
  reject outright - which made "track edit rates" impossible to do
  meaningfully. Suggestion cards now have editable title, deadline, and
  subtask fields; approving a suggestion after editing it appends a
  note to the saved task's extraction reasoning, so edit activity is
  visible in the data rather than only inferred.

Also addressed, from the red-team critique's third point (silent
failure on negation): `guessDeadline` now checks for negation cues
("never mind," "cancelled," "no longer need") in the same sentence as a
matched deadline phrase, and treats a negated match as no deadline
rather than reviving a cancelled one.

## Consequences
- **Positive**: all three issues raised in the discussion post have a
  concrete, tested, working implementation, not just a written
  commitment. Two additional real bugs were found in the process of
  building this (the extraction reasoning never being displayed; a
  false positive in the initial hedge-filter that would have deleted a
  legitimate "Please draft..." subtask) and both were caught and fixed
  before shipping, with regression tests added for each.
- **Negative / honest limitations**:
  - The injection pattern list is not exhaustive - it targets common,
    well-documented phrasings, not every possible phrasing of the same
    idea. A "no signals found" result means "nothing obvious," not "safe."
  - The communication-style dataset is 12 items, written by the team,
    not real messages from a diverse workforce. It was enough to find
    and fix one real bug - which is more evidence than a purely
    theoretical concern would have produced - but is not a substitute
    for testing against real, external phrasing before treating this
    risk as closed.
  - The title-truncation gap found by the same benchmark is real and
    remains open (see above).
  - LLM mode was not separately re-tested against the communication-
    style dataset or the injection patterns in this pass - both are
    reasonable next steps before assuming LLM mode's behavior mirrors
    or differs from heuristic mode's on either concern.
- **Future work**: re-run the communication-style benchmark against
  real, externally-sourced messages (not team-authored) before the
  final release, per the team's own stated validation plan; consider a
  focused fix for title truncation; consider testing LLM mode
  specifically against both the injection patterns and the
  communication-style dataset.
