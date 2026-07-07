---
description: Control refactory's guarded mode, fix phase, and lesson lifecycle (on | off | status | backlog | fix | review)
argument-hint: "on | off | status | backlog | fix | review"
---

The user invoked `/refactor $ARGUMENTS`. Act on the argument:

- **on** — Arm a guarded refactor. Create `.refactory/guard.json` in the project root with
  `{"net": "pending"}` (create the `.refactory/` directory if needed), and in the same step
  ensure `guard.json` is gitignored (write `.refactory/.gitignore` containing `guard.json`;
  do NOT ignore `learnings.md` or `backlog.md`). Confirm armed; the next step is the net
  decision (A/B/C/D) before any source edit.

- **off** — Disarm. Before deleting `.refactory/guard.json`, check whether this session armed
  but never produced a discipline-ledger entry in `.refactory/learnings.md`. If so, state why
  the refactor is being abandoned and record a one-line note first. Then delete
  `.refactory/guard.json` and confirm disarmed.

- **status** — Read `.refactory/guard.json` if it exists and report: armed or not; the
  recorded `net` decision and `decision` letter; the `target`; the `test_quality`. If absent,
  say guarded mode is off.

- **backlog** — Read `.refactory/backlog.md` and show the open surfaced bugs, ordered
  highest-risk-first, with their IDs, risk bands, and one-line descriptions. If none, say the
  backlog is empty.

- **fix** — Start the **fix phase** (separate from refactoring). Read `.refactory/backlog.md`,
  order open bugs highest-risk-first, and for each dispatch a fresh, context-isolated fixer
  via the Task tool using the dispatch template in `references/11-fixer-handoff.md`. Fix one
  bug at a time. For any fix touching rollback/restore, optimistic cache, snapshot, or
  persistence ordering, require independent verification — read off the diff, NOT a
  self-assigned risk band — and prefer routing it to real external review. A behavior-changing
  fix is not done until its PR's review threads are pulled and triaged (a green check is not a
  review); record `reviewed:` on the backlog item. Update each item's status when done. Do
  this only after a refactor has landed — not during refactoring.

- **promote** — Close the learning loop's compounding step. Read `.refactory/learnings.md`,
  collect every lesson tagged `[PROMOTE]`, and for each one produce a **concrete,
  ready-to-approve edit** to the skill itself — the exact file (usually a reference like
  `references/10-learning-loop.md` or the relevant catalog/discipline file), the exact text
  to add or change, shown as a before/after diff — so that approving is the only effort left.
  Before proposing, sanity-check each lesson against the overgeneralization trap: is it
  genuinely true of refactoring everywhere, or a one-repo/one-stack observation dressed up as
  a law? Say which, and drop or narrow the ones that don't generalize. On the user's approval:
  apply the edit, remove the `[PROMOTE]` tag from the lesson, and note in it where it was
  promoted to. Never apply without approval — promotion is the one human-gated step by design;
  this command removes the friction, not the gate. If no `[PROMOTE]` tags exist, say so.
  Before promoting, scan `.refactory/archive/retired-lessons.md` for a parked lesson that says the
  same thing — if found, repurpose it (re-audition) rather than promote a duplicate. Promotion is
  reversible — see `demote`/`retire` and the lifecycle in `references/10-learning-loop.md`. Only
  you (the main agent) apply the promote, on the user's approval; a subagent may scout the archive
  but never promotes.

- **review** — Run the lesson-lifecycle pass over `.refactory/learnings.md` (and, when a lesson
  is general, the skill's own references). For each lesson grade it against the four questions in
  `references/10-learning-loop.md` — did it recur, is it still true, is it general, what's the
  cost of forgetting — and assign exactly ONE verb: keep, promote, demote, or retire. Output one
  verdict per lesson with a one-line reason; never a numeric score (no fitness metric, by
  design). Start from anything the SessionStart hook flagged (a named path that no longer exists;
  a live lesson that matches a parked one). Before adding or promoting any lesson, scan the parked
  lessons in `.refactory/archive/retired-lessons.md` for one that means the same thing — repurpose
  it (re-audition) rather than create a duplicate; read the file inline, or dispatch a read-only
  subagent to scan it and return matches if it has grown large. Apply demotions and retires on the
  user's nod; promotions still route through `promote` (the one human-gated step). Keep the budget
  in mind: a tier at its cap (~12) means a new entry costs an old one its slot. You (the main
  agent) make every move; a subagent may only scout and report. For any dedup call that lands in
  the gray zone (the candidate resembles a parked/live lesson but you are not sure it is the same),
  invoke the **observer**: spawn an independent read-only subagent with just the candidate and its
  nearest match and ask it to argue same-vs-different against your proposed verdict. Skip the
  observer for the obvious cases (no resemblance, or an exact match) so it stays quiet. On the
  observer disagreeing, you decide; it only flags. Backfill empty slots: if retiring or demoting
  drops the live count below the budget, pull the highest-value still-relevant parked lesson back
  up to fill it (re-audition it first; skip parked lessons that are themselves stale).

- **demote** — Move a lesson DOWN a tier because it's no longer broadly true, or never recurred
  outside one repo: skill → this repo's `## Lessons`, or `## Lessons` → `## Session log`. The
  reverse of `promote`. If the demotion pushes it out of the live tiers entirely (e.g. budget
  eviction of a still-true-but-outranked lesson), park it as a clean dated bullet with a one-line
  reason in `.refactory/archive/retired-lessons.md`. State the lesson and where it landed.

- **retire** — Park a stale or superseded lesson as a clean dated bullet (with a one-line reason)
  in `.refactory/archive/retired-lessons.md` (move, never delete). A retired lesson may return
  later, but only as a re-verified candidate — never auto-restored as fact. If a lesson keeps
  bouncing retire/revive, don't toggle it: rewrite it to be clearly always-relevant or clearly
  trigger-scoped.

- **dashboard** — Generate and show the discipline dashboard. Run the generator that ships
  with this plugin: `node "<plugin root>/hooks/refactory-dashboard.js" .` from the project
  root (the script finds `.refactory/` itself). Relay its terminal summary to the user and
  point them at `.refactory/dashboard.html` for the interactive view (time filtering,
  click-through to the raw entries behind every number). Notes for relaying honestly: there
  is deliberately no overall score (discipline is measured; quality is judged — see
  SUCCESS_CRITERIA.md); numbers marked "inferred" were pattern-matched from prose and are
  approximate, "extracted" ones came from structured data blocks and are solid. The HTML is
  also regenerated automatically whenever a guarded session's close-out completes.

- **verify** — Run the hook self-test: `node "<plugin root>/hooks/refactory-verify.js"`.
  It exercises every hook with simulated inputs in a throwaway temp dir and reports PASS/FAIL
  per check on this machine (this Node, this OS). Relay the results honestly, including the
  residual it states itself: the one thing it cannot prove is that the host agent honors a
  deny/block — that needs the 30-second live test (arm a refactor, leave the net pending,
  attempt a source edit, confirm you're blocked). Suggest running this once after install or
  update, and any time enforcement seems not to fire.

- **(no argument or anything else)** — Briefly explain the subcommands.

Keep the response short. Do not start refactoring from this command alone — it only controls
the guard state, the fix phase, and the lesson lifecycle.
