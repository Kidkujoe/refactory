# Changelog

## 1.16.0

Audit fixes — correctness, honest claims, and light instrumentation. No new user-facing
features; the guarded-mode contract is unchanged except where noted.

### Fixed
- **Session-log ordering (#1)** — the docs said "newest first" but both hooks assumed
  oldest-first file order: `refactory-load-lessons.js` archived the *newest* entries and
  `refactory-ledger-check.js` inspected the *oldest* as "this session's". Both are now
  order-agnostic — they key off each entry's `### YYYY-MM-DD` date (archive oldest-by-date,
  select current entry as newest-by-date), with a fail-safe fallback to file order for
  undated headers. `references/10-learning-loop.md` updated to say either ordering is accepted.
- **Gate deny message (#2)** — no longer tells the agent to "present the structured net
  decision and wait" unconditionally; it now mirrors SKILL.md's relaxation (mechanical jobs
  and cheaply-nettable LOW-risk targets are resolved without asking; A/B/C/D only for real
  decisions).
- **Gate exemption holes (#4a–c)** — removed `mdx` from the non-source allowlist (MDX is
  executable JSX); anchored `e2e`/`playwright` in the test-file pattern to path *segments*
  (so `playwright-app/src/main.ts` is no longer exempted); added `NotebookEdit` to the
  PreToolUse matcher and `notebook_path` handling in the gate.
- **Stop-hook wording (#5)** — README/SKILL/guarded-mode text now says the Stop hook "nudges
  once with a combined checklist" (loop-safe, never a trap), matching the actual behavior
  instead of implying it blocks until fixed.

### Added
- **Option-D instrumentation (#3)** — agents record hybrid deferrals as `guard.json`
  `"deferred": [paths/globs]`; the Stop hook logs one close-out event per session with the
  decision letter and deferred count. Evidence-gathering before deciding whether scope
  enforcement is worth building — the gate does **not** enforce the boundary.
- **Trust-boundary note + Lessons cap (#7f)** — README documents that `.refactory/learnings.md`
  is injected into context at SessionStart (treat like `CLAUDE.md`); the injected `## Lessons`
  section is capped at ~2000 chars with a "run `/refactor review` to distill" notice.

### Documentation
- **Honest limits (#4d)** — `references/14-guarded-mode.md` states the gate only sees
  file-editing tools, not Bash/shell writes (`>`, `>>`, `tee`, `sed -i`, `git apply`, `patch`);
  it is a discipline aid, not a sandbox. The `deferred` field is recorded but not enforced.
- **/refactor subcommands (#7a)** — the command frontmatter now lists all eleven subcommands
  (`on｜off｜status｜backlog｜fix｜promote｜review｜demote｜retire｜dashboard｜verify`).

### Tests
- `refactory-verify.js` extended from 10 to 25 self-checks: both session-log orderings, the
  three gate-exemption fixes, the option-D close-out event, and the injected-Lessons cap.

### Deferred to follow-up PRs
- CI matrix + cross-manifest version-consistency check (audit #7e).
- SKILL.md slim-down: move eval-postmortem narration into references (audit #8).
