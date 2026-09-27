# Team Working Agreement

A Week 1 deliverable per the original backlog. Fill in the bracketed
sections with your team's actual agreed practices before the final
submission — this file as shipped is a filled-in *template*, not a
placeholder to leave as-is, since "evidence of collaborative teamwork" is
explicitly graded in the final criteria.

## Branching

- `main` is always in a working, CI-green state.
- Work happens on feature branches named `<initials>/<short-description>`,
  e.g. `jr/deadline-fix`.
- Branches are deleted after merge to keep the branch list clean.

## Pull requests & code review

- Every change to `main` goes through a PR, even small ones — this is
  what produces the "commit history and code review" evidence the final
  criteria asks for.
- At least **one other team member** reviews and approves before merging.
- CI (lint + test + coverage + benchmarks) must be green before merge.
- PR descriptions should say *why*, not just *what* — the diff already
  shows what changed.

## Commit conventions

Meaningful commit messages, present tense, one logical change per commit
where practical:

```
fix: correct weekday deadline math for "next <weekday>" phrasing
feat: add AES-256-GCM encryption at rest for the task store
docs: add API documentation and architecture diagrams
test: add held-out accuracy benchmark for the Smart Task Extractor
```

Avoid non-descriptive messages like "fix stuff" or "wip" on `main` —
squash or reword before merging if a branch's history is messy.

## Meetings & communication

- [ ] Team stand-up cadence: `[fill in — e.g. "async in Slack every Mon/Wed/Fri"]`
- [ ] Primary communication channel: `[fill in]`
- [ ] Task/issue tracking: `[fill in — e.g. "GitHub Projects board" or "Jira"]`

## Task ownership

- [ ] How work is assigned: `[fill in — e.g. "self-assign from the board each week"]`
- [ ] What happens if someone is blocked or falls behind: `[fill in]`

## Definition of done

A task/feature is "done" when:
1. Code is merged to `main` via a reviewed PR
2. Tests exist for new logic and CI is green
3. Relevant docs (`README.md`, `docs/api.md`, etc.) are updated if behavior changed
4. It's been manually exercised at least once by someone other than the author
