# Success criteria

What a *good* refactory session looks like. These criteria measure **discipline** — the
process that keeps a change behavior-preserving — not the aesthetic quality of the result.

**There is no overall numeric score, by design.** Discipline is measured (did the net exist,
were the steps small and reverted on red, was the ledger written); quality is *judged by a
human* (does the code read better now?). Collapsing both into one number recreates the
vanity-metric trap this plugin exists to prevent — a big line-count drop is "something
happened," not evidence the change was good. The dashboard reports the discipline signals and
deliberately withholds a composite grade.

## The criteria

A session is graded pass/fail on each criterion it is relevant to (some don't apply to every
task — a purely mechanical rename has no net to build, for instance).

1. **Net first.** A real safety net covering the *target* code existed and was green
   **before** any source edit — or the no-net gate was hit and the choice was put to the user.
   No blind edits.
2. **Net depth.** The net asserts on the *full* mutation surface (every field, store,
   side-effect, persisted value the operation writes), not just the happy path. A shallow net
   that manufactures false confidence fails this even when it's green.
3. **Behavior preserved.** Observable behavior after matches before — net green before *and*
   after. Known/observed bugs are preserved, not silently fixed under cover of cleanup.
4. **Two hats kept separate.** No feature change or behavior fix was bundled into the
   refactor. If one was wanted, it was named and filed as its own change, in its own commit.
5. **Smallest viable steps, revertible.** Work proceeded in small steps on a version-control
   baseline; a red test (or type error) triggered a revert to the last green state, not a
   debug-forward.
6. **Named the moves.** Each transformation was stated by its catalog name ("applying Extract
   Function") rather than improvised.
7. **Surfaced, not fixed.** Bugs noticed during the refactor were appended to the backlog with
   a stable ID and risk band — never silently fixed, never silently dropped.
8. **Stopped at good-enough.** Work stopped once the code was clear enough for the task; no
   gold-plating toward imagined perfection. (Applied *before* starting too: when the safe
   surface is tiny, defer-vs-do is surfaced rather than netting one small extraction at heavy
   cost.)
9. **Ledger persisted.** The discipline ledger was written to `.refactory/learnings.md` — the
   session is not complete until it is. Reporting success in ledger terms (net status,
   behavior preserved, hats separate, where you stopped), **not** as a line-count delta.

## How the ledger maps to the criteria

The closing ledger (see SKILL.md) is the per-session record of these criteria:

| Ledger line | Criteria |
|-------------|----------|
| `Net:` | 1, 2 |
| `Behavior preserved:` | 3 |
| `Moves:` | 6 |
| `Two hats:` | 4 |
| `Stopped at:` | 8 |
| `Surfaced (not fixed):` | 7 |
| `vs last entry:` | trend, not a pass/fail criterion |

Criterion 5 (small revertible steps) and 9 (ledger persisted) are process facts the hooks and
the commit history attest to rather than ledger fields.
