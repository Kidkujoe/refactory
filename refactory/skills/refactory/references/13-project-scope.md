# Project-scope mode — refactoring a whole project / codebase / repo

Read this when the user asks to "refactor this project / codebase / repo." The one-line rule
(in SKILL.md): **never one giant sweep — audit read-only, segment into safe chunks, checkpoint
between them.** Acting wholesale is forbidden; auditing broadly is encouraged. Full workflow:

1. **Audit (read-only — change nothing yet).** Survey for both local smells *and the
   relationships between them*, which is where the real leverage is:
   - **Duplication across files** — the same logic in several places (one fix, not five).
   - **Change ripple / Shotgun Surgery** — "a change here forces edits in many files." Often the
     highest-value cleanups because they make future work cheaper.
   - **Coupling / Insider Trading** — modules that lean on each other's internals.
   - **Hot spots** — code many features route through, where a cleanup pays off widely.
2. **Group related findings into single work items.** If one piece of duplicated logic appears in
   checkout, cart, and invoice, that is *one* item ("unify the pricing logic"), not three — doing
   them together is the point. The plan should reflect how the code actually connects, not a flat
   file-by-file checklist.
3. **Propose a prioritized, segmented plan — and let the user shape it.** Each segment is a
   bounded, independently-shippable chunk with its own safety-net status noted (tested / untested
   / hard-to-test). Suggest an order *with a rationale* (high-leverage cross-cutting items first,
   or quick wins first, or "wherever you're about to build next") but let the user reorder. Don't
   bake in one fixed priority rule.
4. **Be honest about audit depth.** A real audit means actually tracing the code, not skimming.
   State what you examined and what you didn't, and mark relationships you *suspect* but haven't
   verified as such — don't hand over a confident-looking map built from a shallow look.
5. **Write the plan to a file in the repo** (e.g. `REFACTORING_PLAN.md`) with checkboxes, so it
   survives across sessions and is visible to the team. Update it as items complete.
6. **Work one segment at a time, each as a normal refactoring run** (the explicit-mode loop: net
   first, small steps, revert on red, behavior preserved).
7. **Checkpoint between segments by default.** Finish a segment, report it, tick the plan, and
   wait for the user's go-ahead before the next. Only run several segments back-to-back if the
   user explicitly asks; pace is their call, but checkpoint-and-wait is the safe default.
8. **Treat the plan as provisional.** If a segment turns out bigger than it looked, or has no
   safety net and needs tests built first, say so and adjust — don't pretend the original list
   was perfect.

This keeps a whole-project request productive (a genuine, relationship-aware diagnosis and a
managed sequence of safe chunks) without ever attempting the unsafe wholesale rewrite.
