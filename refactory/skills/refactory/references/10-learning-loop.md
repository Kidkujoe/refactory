# Reference 10 — Accumulated Lessons (the honest "learning loop")

## What this is, plainly

**The model does not train.** Nothing in this file updates weights. "Learning" here means
exactly two things, no more:

1. Accumulating short, blunt lessons that get **loaded back into context** so the agent acts
   on better instructions (a lab notebook, not a growing brain).
2. **Promoting** the durable lessons into the instructions that always load — the project's
   guidance or the skill itself — which is the only part that *compounds* across sessions and
   survives. This is a human-approved instruction edit, not self-training.

If lessons are never promoted and never read back, the log is a diary nobody mines — delete
it rather than pretend it does something. Its entire value is as raw material for improving
the instructions.

## The store

A project-local, version-controlled file: `.refactory/learnings.md` at the repo root. Two
parts, different jobs:

- **`## Lessons`** (top) — the useful artifact. Short, prioritized, **imperative** rules.
  Loaded into context at session start by the SessionStart hook (only this section is
  injected). Imperative rules in context get followed; narrative does not. Guard its
  signal-to-noise ruthlessly — once it's long enough to skim past, it has stopped working.
- **`## Session log`** (below) — raw, append-only ledger entries. Raw material for
  distillation and human review. NOT injected (it would be noise).

## File format

```
# refactory learnings

## Lessons (read these first — imperative, prioritized)
- NEVER refactor optimistic-cache mutations without a behavior net — silent data desync, only visible on reload.
- Source-text grep tests (assert the file CONTAINS a string) are NOT a behavior net — ignore them as a net; they false-fail on renames and pass through real breakage.
- Extract the pure data-shaping logic out of live-data pages and test THAT; don't refactor the subscription/timer plumbing blind.
- (keep this list short; prune aggressively)

## Session log
<!-- Either ordering is accepted: append new entries at the bottom (oldest-first) or prepend
them at the top (newest-first). The hooks key off each entry's `### YYYY-MM-DD` date, not its
position, so auto-archive always removes the oldest by date and the Stop hook always inspects
the newest by date. Keep the date in every `###` header — an undated entry is never archived
(kept, fail-safe) and won't be recognised as "this session's" close-out. -->
### 2026-05-29 — tracking page (PR #NNN)
- Net: NONE — user declined per gate (option b), manual smoke owed before merge
- Behavior preserved: UNVERIFIED
- Moves: Extract Custom Hook x4 (sticky, deep-links, query, selection)
- Two hats: kept separate
- Stopped at: LOW/MEDIUM band; HIGH band (mutations, prefs, custom cols) deferred
- Compared to last time: better — stopped at the gate instead of proceeding
- Lesson candidate: "live-data pages — extract pure logic first" (promote if it recurs)
```

## The loop

1. **Read** — lessons arrive via the SessionStart hook (or read the file). Let them inform
   the session.
2. **Append** — at session end, add the ledger as a session-log entry. Add a *lesson
   candidate* only if it generalizes. Most sessions add an entry, not a lesson.
3. **Distill** (the judgment half is yours; the bookkeeping half is now mechanical) — promote
   recurring candidates into terse imperative lines in `## Lessons`; prune one-offs and
   stale/contradicted notes. The SessionStart hook handles the data-movement part for you:
   past 15 session-log entries it auto-archives the oldest (by `###` date) to `.refactory/archive/`, and it
   warns when Lessons drift past the terseness budget (~12 bullets, ≤2 lines each). What it
   cannot do is the judgment — *which* patterns deserve to become Lessons. That part is the
   five-minute pass the housekeeping nudge keeps asking for.
4. **Promote** (the compounding step) — for each durable lesson, place it where it will load:
   - *Project-specific* → stays in this repo's `## Lessons` (or the project `CLAUDE.md`).
   - *General* (true of refactoring everywhere) → run **`/refactor promote`**: it reads every
     `[PROMOTE]`-tagged lesson, sanity-checks it against the overgeneralization trap, and
     produces the exact ready-to-approve diff against the skill's own files — so approving is
     the only effort left. This is how the skill gets better across all projects. The human
     approval is deliberately kept: the command removes the friction, not the gate.

## The lesson lifecycle (four verbs, reviewed — not promote-once-and-forget)

Promotion used to be a one-way door: a lesson went up into the skill and stayed there forever.
That quietly bloats the always-loaded set until the load-bearing rules get skimmed past — the
exact failure the terseness budget prevents one tier down. So every lesson, **including
already-promoted ones**, is subject to recurring review with four possible verdicts:

- **Keep** — still earns its slot. Leave it.
- **Promote** — proven general → lift it up a tier (session log → Lessons, or Lessons → skill
  via `/refactor promote`, human-gated).
- **Demote** — no longer broadly true, or never recurred outside one repo → move it down a tier
  (skill → project Lessons, or Lessons → session log). The reverse of promote; it had no path
  before.
- **Retire** — stale, superseded, or dead → move it to `.refactory/archive/` (cold storage).

### Grade to a verdict, never a score
Judge each lesson against four questions, then pick a verb. Do NOT compute a number — a
"7/10 lesson" recreates the vanity-metric trap this skill refuses everywhere else. The
questions only inform the verb:
1. **Did it recur?** Applied/cited again, or a one-off? One-off → demote or retire.
2. **Is it still true?** Does it still match the current code and tools? If it names a file,
   flag, or API that no longer exists, it's a retire/demote candidate until re-verified. (The
   SessionStart hook flags these automatically — see Hygiene below.)
3. **Is it general?** Universal refactoring truth → skill tier. One-repo quirk → project tier.
4. **What's the cost of forgetting it?** A data-loss/safety lesson outranks a style nit; high
   cost survives eviction, trivia goes first.

### Retirement is reversible — but a return is a re-audition
Retire means *park in cold storage*, not delete (the archive is move-not-delete already). A
retired lesson can come back when its situation recurs — but it re-enters as a **candidate**
and must be re-verified against current reality, never auto-restored as established fact. Why:
a lesson retired because it went *stale or wrong* must not be trusted verbatim if the situation
flips back; one retired merely because it went *quiet* can wake up nearly as-is. Either way it
proves itself on the way back in.

If the same lesson keeps bouncing retire ⇄ revive, that is a signal, not the loop working: the
lesson is worded too vaguely or too situationally. **Rewrite it** so it's clearly either
always-relevant or clearly tied to a named trigger — don't keep toggling it.

### The promoted tier has a budget too (one in, one out, all the way up)
The Lessons section already runs on a fixed budget (~12, "one in, one out"). Apply the same to
the **skill tier**: the always-loaded skill guidance is a fixed shelf, so promoting a new
general lesson into it should force the question *"is this newcomer worth more than the weakest
thing already here?"* If yes, demote or retire that weakest one — move the detail to a reference
file (cold storage, read on demand) to make room. The budget exists to **force the comparison**,
not to drop good lessons just to hit a count. Getting in costs something; that pressure is what
keeps the hot set sharp.

### Repurpose, don't duplicate (the way back up from cold storage)
Cold storage is a spring, not just a parking lot: a parked lesson that becomes relevant again
should be **repurposed**, not silently rewritten as a fresh duplicate. Two layers catch a repeat:

- **Word-overlap (mechanical, always-on).** The SessionStart hook compares live Lessons against
  parked ones in `.refactory/archive/retired-lessons.md` and flags a strong textual match — a
  reworded repeat of something you already parked. Conservative by design (quiet beats noisy).
- **Meaning-match (judgment, at review).** During `/refactor review` (and before any `promote`),
  check the parked lessons for one that means the same thing even if worded differently — the
  agent is the meaning-engine, so this needs no embeddings or external service. The archive is
  small; read it inline. If it has grown large, dispatch a **read-only subagent** to scan it and
  return just the matches, keeping the main context clean.

When a match is found, **repurpose**: bring the parked lesson back as a re-audition candidate
(prove it still holds against current reality), fold any new nuance into it, and rewrite it once
so it stops cycling — never keep a near-duplicate alongside it.

**Backfill — never leave a live slot empty while value sits parked.** When a slot opens up (a
retire or demote drops the live count below budget), pull the **highest-value still-relevant**
parked lesson back up to fill it (re-audition applies — prove it still holds). The budget is a
floor to keep *full of the best*, not just a ceiling: an empty slot with good lessons in cold
storage is wasted signal. Skip parked lessons that are themselves stale (they would just
re-retire).

### Who does what (the actor split)
- **The hook only flags.** It cannot edit a lesson, move one, or promote — it has no approval gate.
- **A subagent only scouts.** It reads the archive (or any heavy pile) and returns matches/candidates.
  It never writes, moves, demotes, retires, or promotes.
- **The main agent does every actual move, and the promote — on your approval.** Promotion is
  human-gated by design; only the agent in the conversation can hold that gate, so it is never
  delegated to a subagent. Demote and retire are likewise the main agent's writes; a subagent may
  *suggest* them, never *do* them.

Parked lessons live as clean bullets in `.refactory/archive/retired-lessons.md` — one line each,
dated, with a one-line reason — so both the word-overlap flag and the meaning-match scan have a
tidy corpus to compare against.

### The dedup observer (gray-zone-gated, independent verification)
Word-overlap has two failure modes: it **leaks** reworded duplicates (false negative) and, if
tuned aggressively, could **wrongly merge** two genuinely-different lessons (false positive — the
worse one, it silently destroys a distinct lesson). An **observer** closes both, without becoming
background noise, by letting the cheap layer decide when the expensive one is needed:

- **Route by the overlap score.** Clearly unrelated (near-zero overlap) → auto-accept as new.
  Clearly the same (very high overlap) → auto-repurpose. Only the **gray zone in between** — high
  enough to suspect, low enough to be unsure — is sent to the observer. How often that is depends
  on how repetitive the incoming lessons are: on a normal stream it is a minority; on a
  duplicate-heavy stream it can be ~40%. The point is it never fires on the clear cases, so it is
  gated by genuine uncertainty rather than running on every entry (no `watch.js`-style crying wolf).
  Keep the auto-merge threshold high (favor more observer calls over a wrong merge).
- **The observer is an independent, read-only verifier.** Spawn a subagent with just the candidate
  and its nearest match and one job: *"same lesson or genuinely different? Make the case against the
  proposed verdict."* Independent context is the point — the same agent reviewing itself just
  rubber-stamps. It returns agree/disagree + reason; it never writes, merges, or promotes.
- **It is symmetric.** The same check catches a missed duplicate (verdict was "new") and a wrong
  merge (verdict was "same") — one mechanism, both failure modes.

On disagreement the observer surfaces the case to the main agent, which makes the call (and any
promote stays human-gated). The observer flags; it never acts.

Run this pass with `/refactor review`.

## What this loop must not do

- **No model training claim.** It loads instructions; it does not make the model smarter.
- **No autonomous code mutation.** Records and advises; never edits code on its own.
- **No fitness score / auto keep-discard.** Refactoring has no objective quality metric;
  inventing one recreates the vanity-metric trap (`SUCCESS_CRITERIA.md`).
- **No promotion without human approval.** General lessons become skill edits only when the
  user approves the exact change.
- **No false confidence.** Lessons are heeded by judgment, which is never guaranteed. The
  loop makes good behavior better-supported, not certain.

## Writing good lessons (the quality bar)

A bad lesson is worse than no lesson — it gets injected next session as established fact and
manufactures false confidence, the exact thing the skill exists to prevent. Hold the line:

- **Never overgeneralize from a small sample.** "I checked 3 of ~90 test files and they were
  greps" does NOT license "the tests here are overwhelmingly greps." Write the *method*, not a
  verdict: "verify test quality per-file before trusting it as a net — don't assume either
  way." The failure mode is assuming from a sample; the fix is "stop assuming, check," not a
  better assumption. If a claim's evidence is N cases, the lesson may only speak to those N.
- **Capture judgment lessons, not just mechanical ones.** It's easy to write down "here's the
  jsdom template" (documentation) and skip "I built a 10-mock net to protect one dedup — size
  the safe surface before netting" (judgment). The judgment lessons are higher-leverage
  because they change *decisions*; favor them. Documentation-style notes are fine but belong
  as pointers, not as imperative Lessons.
- **The model lesson is concrete, imperative, born from a real failure** — e.g. "run
  `git status` before the baseline commit so transient files don't ride into the PR." Terse,
  actionable, evidenced. Aim every Lesson at that shape.
- **Tag promotion candidates with `[PROMOTE]`.** When a lesson is general (true of refactoring
  everywhere, not just this repo), append `[PROMOTE]` to it. That's a flag for the human to
  approve folding it into the skill's own `references/` — not an automatic move. Example:
  "Source-text grep tests are not a behavior net — classify per-file. [PROMOTE]"

## Hygiene (keep the file loadable)

- **Prune superseded entries.** A "paused at gate" entry followed by a "COMPLETE" entry for the
  same work is redundant — fold or drop the paused one. Two entries for one session is noise.
- **Compaction is now mechanical (v1.11.0).** The session log is raw material; past 15 entries
  the SessionStart hook auto-moves the oldest (by `###` date) to `.refactory/archive/learnings-archive.md` and
  keeps the recent 15 live, so the file stays skimmable *without anyone deciding to*. Archiving
  is pure data movement — no judgment, no behavior change — which is exactly why it's safe to
  automate. (The honest history: the advisory nudge fired for weeks over a 42-entry log and
  nothing acted on it. Enforced steps stick; advisory steps get skipped — the loop's own
  design wasn't exempt from the skill's own thesis.)
- **One in, one out.** Once Lessons is at its budget (~12), adding a new lesson requires
  demoting, merging, or retiring an existing one. Which lesson loses its slot is a judgment
  call — that's exactly why this is a written rule, not a hook. The cap is what keeps the
  section worth reading. The same budget applies one tier up, to the skill itself — see
  **The lesson lifecycle** above, and run the pass with `/refactor review`.
- **End every persisted entry with the `refactory-data` block** (the machine-readable HTML
  comment in the ledger template). It's invisible in rendered markdown, stripped before
  injection, and it's what makes the dashboard's numbers solid ("extracted") instead of
  approximate ("inferred" from prose). Exact format (v1.12.0):

  ```
  <!-- refactory-data
  net: green | accepted-risk | none | pending
  net_kind: behavior | grep | none
  net_first: yes | no
  self_grade: better | worse | neutral
  two_hats: held | violated
  gate_stop: yes | no
  moves: Extract Function, Extract Component
  -->
  ```
- **Distillation still needs you — but only for the judgment.** The hook clears the clutter
  and counts the overdue; choosing *which* recurring patterns become Lessons is yours. Do the
  pass while the file is small — it's five minutes then, archaeology later.
