# Individual Contribution Log

```
git log --author=jordanhanna672@gmail.com --oneline main
git shortlog -sne main          # commit counts per author, whole repo
```

## Jordan Hanna — Lead Architect

**Areas owned:**
- Architecture Decision Records: Author of all six ADRs (tech stack, data store/encryption, with deferral, Google integration, Postgres/Render backend, and the ethics and security response.
- Early Architectural Groundwork: The Unit 3 Operation Strategy and Team Roles' executive summary, the layered-microservices-vs-monolith tradeoff analysis, module design principles, and module boundaries/interface contracts.
- Direction of the Ethics and Security Response (ADR 0006): Deciding the extractor needed a pattern-based prompt-injection detector and confidence-based review flagging, and holding the implementation to that design.
- Verification of the encryption-at-rest performance trade-off that backs ADR 0002 (the benchmark confirming the ~10ms->~30ms read-latency cost). 

**Key commits / PRs:**
Commits that are visible are edits mostly in documentation as this entire project was worked on locally and then pushed directly to GitHub:
- All six ADRs (0001-0006) (docs/adr/0001-0006)
- docs/accuracy-baseline-report.md
- docs/performance-benchmark-report.md
- src/security.js

**Summary of contribution:**
As Lead Architect, I owned the project's architectural decision-making and its documentation trail, authoring all siz ADRs, carrying a documentation discipline practices in Unit 3 into every major technical call on WorkWise AI, and directing the team's response to the ethics/security risks the project surfaced (including verifying that performance claims were evidence-backed rather than asserted). My contribution is weighted toward design rationale and technical direction rather than hands-on feature implementation. 

---

## Ti'Asia Gause — Interface Designer

**Areas owned:**
- API specifications and data interface documentation for WorkWise AI.
- Task-management API contracts, task data-layer interfaces, AI/prioritization integration, and API error-handling documentation.

**Key commits / PRs:**
- `cfe2b8d` — Added the WorkWise AI API and Data Interface Documentation, covering task-management endpoints, task data operations, AI/prioritization integration, error handling, and alpha data-store considerations.
- `ee22267` — Updated the `GET /api/tasks` documentation to accurately state that the endpoint returns the current task list excluding rejected tasks.
- Pull Request #2 — `tiasia-interface-docs` — merged into `main`.

**Summary of contribution:**
I managed the API and component interface documentation for WorkWise AI, documenting how the user-facing application connects with task storage, Smart Task Extraction, and task prioritization. I also reviewed the task-list API description for accuracy and refined it before the documentation was merged through Pull Request #2. This work supported my assigned role as Interface Designer by making the system's API and data interfaces clear and consistent for team integration.

---

## Cal Reed — Integration Lead

**Areas owned (suggested starting point based on role — confirm/adjust against your actual commits):**
- Gmail/Calendar integration (src/google/), OpenAI API integration, deployment (render.yaml)

