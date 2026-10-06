# Team Working Agreement

## Branching

- `main` is always in a working, CI-green state.
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
where practical. 

Avoid non-descriptive messages like "fix stuff" or "wip" on `main` —
squash or reword before merging if a branch's history is messy.

## Meetings & communication

- [ ] Team stand-up cadence: A connected call
- [ ] Primary communication channel: Text
- [ ] Task/issue tracking: Text

## Task ownership

- [ ] How work is assigned: Backlog
- [ ] What happens if someone is blocked or falls behind: Check in, question, and offer to assist.

## Definition of done

A task/feature is "done" when:
1. Code is merged to `main` via a reviewed PR
2. Tests exist for new logic and CI is green
3. Relevant docs (`README.md`, `docs/api.md`, etc.) are updated if behavior changed
4. It's been manually exercised at least once by someone other than the author
