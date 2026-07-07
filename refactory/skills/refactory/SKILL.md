---
name: refactory
description: >-
  Disciplined, behavior-preserving code refactoring using a catalog of named
  refactorings. Use PROACTIVELY: while reading, writing, reviewing, or
  editing code, when you notice a smell — duplicated code, a long or
  confusingly-named function, long parameter list, tangled conditionals, feature
  envy, primitive obsession, a switch repeated across places, mutable global
  state, a class doing too much — flag it by name and offer the fix. Also trigger
  when the user says "clean this up", "this is messy/ugly", "refactor",
  "simplify", "tidy", "reduce duplication", "better way to structure this", or
  "make this more readable/maintainable", or asks to improve code without
  changing behavior. Provides a named catalog of 61 refactorings with
  step-by-step mechanics, a smell→refactoring lookup table, and the safety
  discipline (test after every small step; never mix refactoring with feature
  changes) that keeps changes behavior-preserving. Don't wait for the word
  "refactor" — naming a smell you spotted is part of the job.
---

# Refactory

Refactoring is restructuring code to make it easier to understand and cheaper to
change **without changing its observable behavior**. This skill helps you do that
the way it is meant to be done: as a series of small, individually-safe steps, each
verified before the next. The whole value proposition collapses if the steps are
large or unverified — a broken intermediate state is the failure mode this discipline
exists to prevent.

## The discipline (read this first — it is the whole point)

These rules are what separate refactoring from "rewriting and hoping." Follow them
even under time pressure; they make you faster, not slower, because you never spend
time debugging a big tangled change.

1. **Two hats, never both at once.** At any moment you are *either* adding/changing
   behavior *or* refactoring — never both in the same step. If you notice you want a
   feature change mid-refactor, finish or pause the refactor, switch hats
   deliberately, then make the change. Mixing them is the single most common way an
   automated agent introduces a silent bug. Keep them in separate commits where it's
   cheap to. **Watch the specific rationalizations that lead here:** "it's my own new
   code so bundling it is fine" (no — file it separately), "I'm already in this file"
   (no), and especially **during merge resolution** — changing a function's contract
   while resolving a merge (e.g. fire-and-forget → returns-a-promise) is a behavior change
   smuggled in under cover of a merge, not a refactoring. If you spot a feature or a
   behavior fix while refactoring, name it to the user and file it as its own change.

2. **Behavior must be preserved.** The user-observable result after refactoring must
   match before. "Observable" is deliberately loose: performance characteristics and
   internal interfaces may shift (Extract Function changes the call stack; Change Function
   Declaration changes a signature) — only what a user would notice must hold. *Observed*
   behavior, including known bugs, must be preserved: don't quietly fix a bug someone has
   seen under cover of cleanup. A truly *latent* bug (nobody has observed it) may in
   principle be fixed — but by default file it as a separate, clearly-labeled change rather
   than judging "is this observed?" mid-refactor and risking a behavior change you didn't
   mean to make.

3. **You need a safety net before you touch anything.** Refactoring without a way to
   detect mistakes is not refactoring — it's gambling. Before transforming:
   - Find the existing tests that cover the code. Run them; confirm they pass (a green
     baseline). If they don't pass, stop — fix or characterize first.
   - **Check the net actually covers what you're about to change.** A green suite only
     proves the *tested* behavior survives. If the specific function/branch you're
     refactoring isn't exercised by any test, a green run after your change is a false
     reassurance — it can break the untested path silently. Confirm coverage of the
     *target* (read the tests, or use a coverage tool on the file), not just overall
     green. Untested target → treat it as the no-tests case below, not as covered.
   - If there are **no** tests for the target, that is your first task: write
     characterization tests that pin down current behavior (including edge cases),
     and only then refactor. Say so to the user rather than refactoring blind.
   - **Reach for the cheapest net first.** Before building a heavy integration/render net
     with lots of mocks, ask: *can the logic I care about be pulled into a pure function and
     unit-tested directly?* A pure-function unit net is near-free (often a handful of
     assertions, zero mocks); a render net for a UI component can cost ~3x that in module
     mocks (stores, server actions, router). So when the valuable logic can be isolated as a
     pure extraction and tested on its own, do that — it's both a better net and a cleaner
     refactor. Only build the heavy mocked net when the behavior genuinely can't be isolated
     from its framework/IO. This ordering — pure-unit net first, heavy net only when forced —
     saves real effort on every netting decision, on any stack.
   - **Net depth, not just net existence.** A shallow net is *worse than no net* — it
     manufactures confidence while a real bug ships under it. Before writing the net, **enumerate
     the complete mutation surface** (every field, store, side-effect, persisted value the
     operation writes) and assert on *all* of it; enumerate adversarially (other stores,
     rollback/restore paths, cached copies, persisted prefs, ordering). Net-first without
     net-depth is the central failure mode. Full reasoning + the `surface`/`asserted` recording
     format: `references/12-net-discipline.md`.
   - If the code **resists** being put under test (it hits the network, a database, the
     filesystem, the clock, randomness, or is too tangled to instantiate), read
     `references/09-getting-code-under-test.md` before proceeding — you usually have to
     create a seam or stub a dependency *first*. Don't skip the net because it's awkward.
   - **First rule out the two cases that resolve *without* the gate (check these before stopping).**
     The gate is friction, not safety, when the change carries no real risk of silent behavior change.
     Two common situations qualify, and halting on them is a false positive the eval surfaced:
     1. **No-judgment mechanical jobs** — a symbol rename, a find-and-replace, a codemod-shaped
        migration. These are made *provably right* by an exact tool, so they don't need a behavior
        net and don't trip this gate. Resolve them via the tool ladder under "Purely mechanical jobs"
        (When NOT to refactor) — run the tool, sanity-check, done. The gate is only for changes that
        require *judgment* about whether behavior is preserved. (If a "rename" turns out to need
        judgment — e.g. it would also rewrite an exported property key and thus a published contract —
        that part is no longer mechanical: surface that specific decision, but don't let it block the
        safe mechanical remainder.)
     2. **LOW-risk targets you can net for near-free.** If the code is LOW-risk (pure functions,
        read-only data, a pure transformation — see the risk taxonomy) *and* its current behavior can
        be pinned with a cheap characterization test (a handful of assertions, no heavy mocks), the
        cheapest-net rule already says: build that net. So **build it and proceed**, telling the user
        what you did — don't stop to ask permission for something near-free and safe. (Arming the
        guard, then resolving `net` to `green` by writing that test, is exactly this path.) Reserve
        the hard stop below for when the net is genuinely expensive, impossible, or the target is
        MEDIUM/HIGH-risk.
   - **The no-net gate (mandatory — a hard stop, not a flag).** Once the two no-gate cases above
     are ruled out: if you are about to refactor with no automated net and aren't creating one
     first, **end your turn and ask** — do not edit any source file in the same turn. Put the
     choice to the user, in one line: *"I have no automated way to verify this refactor preserves
     behavior. Options: (a) I write a characterization test / smoke test first, (b) you accept the
     risk and I proceed carefully, (c) we don't refactor this. Which?"* Then **stop and wait** —
     silence is not consent, and "flag and proceed" or "I'll smoke-test at the end" are exactly
     the failures this gate prevents. Be especially strict on UI, animation, async/optimistic
     -update, and glue code. A source-text-only test suite (greps for names/literals) is **not** a
     behavior net — treat it as no net. Full rationale: `references/12-net-discipline.md`.

4. **Smallest viable steps, each on a revertible baseline.** The catalog mechanics are
   small numbered steps for a reason. Do one, run the tests, then the next. **The revert
   path must be real, not notional:** use version control as the safety line — confirm a
   clean working tree (or stash unrelated changes) before starting, commit after each
   green step, and on a red test (or, in a compiled language, a type error) `git reset
   --hard`/`git stash` back to the last green commit and redo in smaller steps. Don't
   debug forward. If the project isn't under version control, say so and establish some
   form of checkpoint (at minimum a copy of the file) before touching anything — without
   a revert mechanism the discipline is hollow. Unlike a tired human, you have no excuse
   to skip the baby steps; take them every time, and shrink them further the trickier the
   code.

5. **Name the move.** State which named refactoring you're applying ("applying Extract
   Function here") before doing it. Naming builds shared vocabulary with the user and
   forces you to pick a known-safe procedure rather than improvising.

## Step 0 — read the language and environment before touching code

The catalog is written in JavaScript, but the moves are about functions, data, and
types, not syntax. So before refactoring, get your bearings — these are orienting
questions, not a checklist to march through:

- **How does this project run its tests, and can you run them?** The safety net (rule 3)
  is only real if you can execute it. If there's a compiler (TypeScript, Rust, Java, Go),
  it's a second oracle — treat a type error like a red test and revert.
- **What can the language express?** The procedural core (extract/inline, rename, change
  declaration, slide, split loop, simplify conditionals, parameterize) applies almost
  everywhere. The inheritance family (`07`) and Replace Conditional with Polymorphism
  assume classes — where there are interfaces/traits but no inheritance (Go, Rust), keep
  the *intent* and reinterpret the mechanics through the local mechanism; where there are
  no objects (C), skip them. In general: keep the goal, drop or adapt steps that assume a
  feature the language lacks.
- **Is there a framework with its own smells and safety-net rules?** For React/Next.js,
  read `references/08-react-nextjs.md`.

## How thorough to be

Test-after-every-step is the safe default. How *often* you verify is a judgment call you
scale to the stakes — load-bearing production code deserves the smallest steps and a test
after each; for routine code with a fast suite, testing after each whole refactoring is
usually fine; for code the user confirms is disposable, they may opt out of the net
entirely. When unsure, verify more. This dial only adjusts verification frequency — it
never relaxes the invariant that behavior must be preserved (rule 2).

## Adapt to your audience

Read how the person writes and match it. The refactoring vocabulary ("Feature Envy",
"Split Phase") is a feature for developers and a wall for everyone else.

- **Technical user** (uses code terms, asks about specific functions): keep naming the
  moves as you do now.
- **Non-technical user** (says "my code's a mess, clean it up", no jargon): lead in plain
  language; keep refactoring names as a quiet aside or drop them. Translate the three
  things that actually matter to them:
  - **What was wrong** — in plain terms ("one piece of code was doing several unrelated
    jobs, which makes it easy to break by accident").
  - **What you did** — ("I split it into separate, clearly-labelled pieces, *without
    changing what your app does*").
  - **How you know it's safe** — reframe tests as confidence, not mechanics: "I recorded
    exactly how it behaved before and checked that's still true — 12 checks, all passing"
    rather than "characterization tests green."
- **Surface decisions in plain terms.** Especially the no-safety-net case: "There's no
  automatic way to confirm I haven't changed how your app works. I can build one first
  (safer, a little slower) or proceed carefully — which would you prefer?"
- **Be honest about the ceiling.** A non-technical user gains *informed trust* (they
  understand what happened and why it's safe), not the ability to *review* the diff.
  Don't imply they've verified the change themselves.

## Proactive mode — flagging smells while you work

This skill is meant to be used proactively. As you read or edit code for *any* task,
keep the smell catalog in the back of your mind. When you spot a smell:

1. **Name it, briefly, in passing** — e.g., "heads up: `processOrder` looks like
   Feature Envy — it reaches into `customer` for five fields. Move Function would put
   it where the data lives." One or two sentences. Don't derail the user's actual task.
2. **Point to the fix** (the named refactoring) but **don't transform unprompted.**
   Flagging is free; restructuring someone's code mid-task without consent is not.
   Offer; let them decide now or later.
3. **Don't pile on.** Mention the one or two most valuable smells, not every nit. A
   wall of flags is noise. Respect that the user came for something else.
4. **Honor "not now."** If the user declines or ignores a flag, drop it — don't
   re-raise the same smell repeatedly in the same session.

Use `references/smells.md` as the lookup from symptom → candidate refactorings.

## Explicit mode — when asked to refactor

When the user asks you to clean up, simplify, or refactor code, run this loop:

0. **Arm the guard (do this first, automatically).** The moment you recognize a refactoring
   request, create `.refactory/guard.json` with `{"net": "pending"}` *before* reading or
   editing anything. You arm it — the user should never have to. Recognize a refactor from:
   (a) the user's words — *refactor, restructure, extract, decompose, split, clean up / clean
   this, reorganize, break apart / break up, tidy, pull out into, move to its own, split
   into*; (b) **your own** about-to-happen catalog move — if you're about to say "I'll Extract
   a Component/Hook here," "applying Split Phase," etc., that announcement is itself the
   trigger, so arm first; (c) heuristic — you're about to work a file of ~300+ lines and your
   plan mentions extract/audit/smells. Arming is cheap; a false arm just means one decision
   prompt the user can wave off with `/refactor off`. When in doubt, arm.
   - **In the same action, keep the sentinel out of version control.** `guard.json` is
     transient state and must never be committed (it caused a four-PR cleanup once). When you
     create `.refactory/`, write `.refactory/.gitignore` containing the lines `guard.json`,
     `dashboard.html`, and `events.log` (derived/telemetry artifacts, regenerable or local-only — committing it would
     produce a meaningless diff at every session close-out) — and crucially, **do not**
     gitignore `learnings.md` or `backlog.md`; those are source data, meant to be tracked and
     shared. The rule: derived artifacts are ignored, source data is tracked. (Solo +
     memory-store setups may keep learnings outside the repo; see the learning-loop reference.)
   - **Bootstrap the log on first arm.** If `.refactory/learnings.md` doesn't exist, scaffold
     it with an empty `## Lessons` and `## Session log` skeleton, so the loop is live from
     session one rather than only helping next time.
1. **Read the target and locate the safety net** (discipline rule 3). Establish a green
   baseline or write characterization tests first. Classify any existing tests honestly:
   *behavior* (exercises real behavior), *constraint-check* (asserts on source text — NOT a
   net), or *none*. Source-text greps count as none.
2. **Triage the safe surface, then put the net decision to the user — and wait** (this is
   the armed guard's real job — see "Guarded refactor mode"). Before pitching any net,
   **size what's actually refactorable**: of the file's lines, how much is HIGH-risk (needs a
   real net, often deferred), how much is *already* extracted, and how much is the genuine
   LOW/MEDIUM target. This is the "worth-it" check, and it's the one the discipline was
   weakest on: a 425-line file can have a tiny safe surface, and building a heavy net to
   protect one small extraction may not be worth it *now* versus waiting and netting the HIGH
   band properly in one pass. So when the safe slice is small, **say so out loud and surface
   defer-vs-do before building anything** — make the user the decider on whether the slice is
   worth isolating, not just on how to make it safe. Then present the four options, each with
   a **rough cost**, and record the pick in `.refactory/guard.json`. Ask **once** per session;
   don't re-ask on later edits unless the target file changes. (This applies criterion #8,
   "stopped at good-enough," *before* starting — not just as a closing self-report.)
3. **Identify smells.** Consult `references/smells.md`. Name what you find and what
   each points to, with a risk band per item (see the risk taxonomy in guarded mode). If the
   scope is large, propose a prioritized order — comprehension-improving renames and
   extractions first, structural/high-risk moves later.
4. **Look up the mechanics.** Open the relevant catalog file (see map below) and follow
   the numbered steps for the chosen refactoring exactly. The mechanics encode the safe
   ordering and the edge cases.
5. **Transform in small steps, testing after each.** Revert on any red (rule 4).
6. **Report** the discipline ledger, persist it, then **disarm** (`/refactor off` / delete
   `.refactory/guard.json`) — and if you armed but never produced a ledger, say why before
   disarming.

## Project-scope mode — when asked to refactor a whole project/codebase/repo

A request like "refactor this project" must **not** become one giant sweep — that's the trap the
discipline exists to prevent. Instead: **audit read-only first** (find duplication-across-files,
change-ripple, coupling, hot spots — and the *relationships* between them, where the leverage
is), **group related findings into single work items** (one fix, not five), **write a
prioritized segmented plan to a file** (e.g. `REFACTORING_PLAN.md`), then **work one segment at a
time** as a normal refactoring run, **checkpointing between segments** by default. Acting
wholesale is forbidden; auditing broadly is encouraged. Full workflow:
`references/13-project-scope.md`.

## When NOT to refactor (guardrails against over-eagerness)

- **No safety net, no refactor.** See rule 3.
- **Purely mechanical jobs deserve the exact tool, not hand-edits — and resolve this BEFORE the
  no-net gate.** A no-judgment transformation (rename a symbol across the codebase, a mechanical
  find-and-replace, a codemod-shaped migration) is not a behavior-risky refactor: it's done
  *provably right and near-free* by deterministic tooling, where LLM hand-editing is slower,
  costlier, and can introduce typos. Because it can't silently change behavior when an exact tool
  does it, it does **not** trip the no-net gate — don't stop to ask for a safety net you don't need.
  (If the job mixes a mechanical part with a real judgment call — e.g. a rename that would also
  rewrite an exported property key, a published contract — split them: do the safe mechanical part,
  and surface only the genuine decision.) The ladder:
  (1) if an exact tool is runnable from the shell (a codemod, `git grep`-driven rename script,
  language-server rename via CLI), **run it yourself** and sanity-check the result — the user
  shouldn't need to know it happened; (2) if the exact tool is click-only in their editor,
  **walk them through it step by step** — teach, don't refer; (3) only when no exact tool
  fits, hand-edit — declared as such, under the usual net, in small checked batches. The
  moment the job needs judgment (should this be renamed? is it safe?), that's this skill's
  territory again.
- **In the middle of adding a feature** — switch hats cleanly; don't interleave.
- **Speculative generality.** Don't add parameters, hooks, or abstraction layers for
  needs that don't exist yet (YAGNI). Build for today's understood needs, excellently;
  refactor when the need actually arrives. Adding flexibility *is* a behavior/design
  change, not a refactoring.
- **Performance.** Don't hand-optimize during refactoring. Write clear, tunable code;
  optimize later under a profiler, measuring — never speculating — and in small
  reverted-on-regression steps.
- **Not every smell needs action.** Smells are prompts for judgment, not commands.
  Explanatory comments, a lone switch, an immutable data record, implementation-reuse
  subclassing — these are often fine. `references/smells.md` notes the common
  false positives.
- **Published APIs.** When callers live outside your control, prefer the migration-style
  mechanics (add new, deprecate old, let clients move) over breaking changes.
- **Know when to stop.** Deciding when to stop matters as much as deciding when to start.
  Once the code is clear enough for the task at hand and reads cleanly, stop — don't
  gold-plate toward imagined perfection. More refactoring is not automatically better, and
  over-polishing is itself a failure mode.

## Report what you did (the discipline ledger)

A refactoring task is **not complete until the ledger is written** — treat persisting it as
part of the work, not an optional closing flourish. At the end of a refactoring session (or
each segment of a project-scope run), close with a short, honest self-report against the
safety criteria. This is not decoration — it makes the one thing that's easy to skip (the
safety net) impossible to leave unstated. Keep it to a few lines, e.g.:

```
refactory ledger
- Net: <green N tests / characterization tests added / NONE — proceeded on user risk per (b)>
- Behavior preserved: <yes — net green before & after / unverified, see Net>
- Moves: <Extract Function, Replace Derived State with Computed Value, ...>
- Two hats: <kept separate / bug filed as #NNN, not bundled>
- Stopped at: <good-enough for the task / more flagged but not done>
- Surfaced (not fixed): <latent issues made visible, if any>
- vs last entry: <better / worse / neutral — and one phrase why>
```

When persisting the entry to `.refactory/learnings.md`, also append the machine-readable
`<!-- refactory-data ... -->` block (the dashboard reads it; format in
`references/10-learning-loop.md`).

Report success in these terms — net status, behavior preserved, hats kept separate, where you
stopped — **not** as a line-count drop (a 300→90 reduction is a "something happened" note, not
evidence the change was good). If the Net line says NONE, say so plainly and up front. See
`SUCCESS_CRITERIA.md` (plugin root) for the full rubric.

## Surfaced bugs → the fix phase (a separate fixer)

Refactoring *surfaces* bugs but never *fixes* them — fixing is a behavior change, forbidden
mid-refactor by two-hats. Every surfaced bug is appended to `.refactory/backlog.md` (tracked;
stable ID + risk band + blast-radius note + `status: open`) — never silently fixed, never
silently dropped. The fix phase is **separate and user-triggered** (`/refactor fix`), run
*after* the refactor lands: a fresh, context-isolated fixer per bug, highest-risk-first, with
effort scaled to blast radius and independent verification triggered by what the diff touches
(rollback / optimistic cache / persistence / snapshot), not a self-assigned band. A
behavior-changing fix isn't done until its review threads are read. Full protocol — the
backlog format, dispatch template, trivial-fix rules, new-bug-during-fix cases, and honest
limits — is in `references/11-fixer-handoff.md`; read it before dispatching.

## Learn across sessions (accumulated lessons → better instructions)

Be clear-eyed: **the model does not train.** "Learning" means written lessons reloaded as
context, plus — the only step that compounds — promoting durable ones into the instructions.
A lab notebook, not a growing brain. The store is `.refactory/learnings.md`: a terse
imperative **`## Lessons`** section at the top (the SessionStart hook injects *only* this —
keep it sharp; long lessons get skimmed past and stop working) and a raw **`## Session log`**
below (never injected; raw material).

The loop: **Read** (hook injects Lessons) → **Append** (the ledger becomes a dated entry;
add a lesson candidate only if something generalizes) → **Distill** (judgment: which
recurring patterns become Lessons; the bookkeeping — archiving past 15 entries, terseness
warnings — is mechanized) → **Promote** (project-specific lessons stay here or in
`CLAUDE.md`; genuinely general ones get tagged `[PROMOTE]`, and `/refactor promote` turns
them into ready-to-approve skill edits — the approval gate is deliberate). What the loop
must not do: no autonomous code mutation, no fitness scores, no false confidence. Format and
full protocol: `references/10-learning-loop.md`.

## Guarded refactor mode (self-arming enforcement)

The skill's gate and ledger are instructions that can be skipped under pressure; the plugin
ships hooks that make them mechanical while a guarded refactor is **armed** (a
`.refactory/guard.json` sentinel exists). Absent the sentinel they do nothing. **You arm it
yourself** the moment you recognize a refactor (Step 0); when in doubt, arm. While `net` is
`pending`, the PreToolUse hook **denies edits to source files** (test files, `.refactory/`, and
non-source docs like `*.md`/`NOTES`/`REFACTORING_PLAN` stay editable). Hook behavior, the
net-depth inventory, the Stop-hook close-out, disarm hygiene, and honest limits are in
`references/14-guarded-mode.md`.

**Don't reflexively dump the four-option menu — resolve it yourself when the situation allows
(this is the conservative relaxation the eval motivated):**
- If the job is a **no-judgment mechanical** one (rename, find-replace, codemod), it shouldn't have
  needed the gate at all: do it with the exact tool and either disarm or record `net: "green"` with a
  note that no behavior net was required. Don't ask.
- If the target is **LOW-risk** (pure/read-only logic) and a behavior net is **cheap** (a few
  assertions, no heavy mocks), prefer option A *and just do it*: write the characterization test,
  set `net` to `green`, and proceed — telling the user you built a quick net first. Stopping to ask
  permission for a near-free, safe net is the over-stopping failure.
- **Reserve the four-option menu for when it's a real decision**: MEDIUM/HIGH-risk targets, or a net
  that is genuinely expensive/impossible. There, present these options — once per session — with a
  rough cost on each, and record the pick:

```
No automated behavior net covers this. Safe surface here: <X lines HIGH-risk / Y already
extracted / Z the real LOW target>. How do you want to proceed?
  A. I write characterization/smoke tests first   (cost: ~N tests + ~M module mocks; real net)
  B. You accept the risk, I proceed carefully      (cost: fast; behavior UNVERIFIED)
  C. Don't refactor this now — wait and net the HIGH band properly in one pass (cost: none now)
  D. Hybrid — refactor only the LOW/MEDIUM band now (cost: ~N tests for the slice); defer HIGH
Pick one by letter.
```

Quantify the cost concretely — "A ≈ 6 tests + ~10 module mocks because the save/DnD paths make
it heavy," not "A is heaviest." The user can't weigh the choice without the price tag. And when
the LOW slice is small, make the C-vs-D tradeoff explicit (is one extraction worth a bespoke net
the eventual HIGH-band PR will partly redo?) rather than defaulting to D.

Record the answer in `guard.json`, e.g. `{"net": "accepted-risk", "decision": "B",
"target": "app/.../page.tsx"}`. Set `net` to `green` (option A, once tests exist) or
`accepted-risk` (option B) to unblock edits. **On option D (hybrid), also record the deferred
HIGH band you are NOT touching**, e.g. `{"net": "green", "decision": "D", "deferred":
["app/lib/optimistic-cache.ts", "app/state/**"]}` — so the recorded state is honest about what
was left un-netted (the gate does not yet enforce this boundary; the field makes the deferral
visible and is logged at close-out as evidence for whether D-style hybrids are common enough to
justify enforcing scope later). Ask **once** per session; only re-ask if the target file changes.
When `net` is `green`, also record the net-depth inventory (`surface`/`asserted`); at end of turn
the Stop hook blocks finishing until the ledger + backlog + inventory close-out is complete —
see `references/14-guarded-mode.md` for both.

**Risk taxonomy** (use it to band smells in the audit, and to scope option D):
- **HIGH** — state machines, optimistic mutations with rollback, write queues, async/timer
  sequences, drag-and-drop, WebSockets. Silent-corruption surface; never refactor netless.
- **MEDIUM** — derived URL/query state, selection pruning, subtle timing/effect ordering.
- **LOW** — pure render, read-only data, pure transformation pipelines. Safe to extract.

**Manual controls** (override the auto-arming either direction):
- `/refactor on` — arm explicitly.  `/refactor off` — disarm (logs why).  `/refactor status`
  — show armed state, the recorded net decision, and the target.

Disarm hygiene (forced log on disarm; end-of-session reflection for un-armed edit bursts) and the
hooks' honest limits are in `references/14-guarded-mode.md`.

## Catalog map

Each refactoring entry gives: what it does, when to use / **when not to**, the
step-by-step mechanics, and companion refactorings. Open the file you need; don't load
all of them.

| File | Family | Refactorings |
|------|--------|--------------|
| `references/smells.md` | **Smell → fix lookup** | 24 smells, the proactive trigger table |
| `references/01-basic.md` | A First Set | Extract/Inline Function, Extract/Inline Variable, Change Function Declaration, Encapsulate Variable, Rename Variable, Introduce Parameter Object, Combine Functions into Class/Transform, Split Phase |
| `references/02-encapsulation.md` | Encapsulation | Encapsulate Record/Collection, Replace Primitive with Object, Replace Temp with Query, Extract/Inline Class, Hide Delegate, Remove Middle Man, Substitute Algorithm |
| `references/03-moving-features.md` | Moving Features | Move Function/Field, Move Statements into Function/to Callers, Replace Inline Code with Function Call, Slide Statements, Split Loop, Replace Loop with Pipeline, Remove Dead Code |
| `references/04-organizing-data.md` | Organizing Data | Split Variable, Rename Field, Replace Derived Variable with Query, Change Reference to Value, Change Value to Reference |
| `references/05-conditionals.md` | Simplifying Conditionals | Decompose Conditional, Consolidate Conditional Expression, Replace Nested Conditional with Guard Clauses, Replace Conditional with Polymorphism, Introduce Special Case, Introduce Assertion |
| `references/06-apis.md` | Refactoring APIs | Separate Query from Modifier, Parameterize Function, Remove Flag Argument, Preserve Whole Object, Replace Parameter with Query/Query with Parameter, Remove Setting Method, Replace Constructor with Factory Function, Replace Function with Command/Command with Function |
| `references/07-inheritance.md` | Inheritance | Pull Up/Push Down Method & Field, Pull Up Constructor Body, Replace Type Code with Subclasses, Remove Subclass, Extract Superclass, Collapse Hierarchy, Replace Subclass/Superclass with Delegate |
| `references/08-react-nextjs.md` | **React / Next.js** | Extract Component, Extract Custom Hook, Lift State Up, plus React/Next smells (derived state in state, prop drilling, god components, misplaced `'use client'` boundary) and the framework-aware safety-net strategy |
| `references/09-getting-code-under-test.md` | **Getting code under test** | How to build a net when code resists testing — seams, stubbing the clock/network/db/filesystem/randomness, characterization tests, what to do when there's no seam |
| `references/10-learning-loop.md` | **Learning loop** | The `.refactory/learnings.md` store, the read-before/append-after protocol, the distillation step, and what the loop must not do |
| `references/11-fixer-handoff.md` | **Fixer handoff** | The surfaced-bug backlog format, the separate user-triggered fix phase, the fresh-context fixer dispatch template (tiered by blast radius), and optional independent verification |
| `references/12-net-discipline.md` | **Net discipline** | Net-depth (mutation-surface enumeration + `surface`/`asserted` recording), the no-net gate's full rationale, and why a source-text-only suite isn't a net |
| `references/13-project-scope.md` | **Project-scope mode** | The full audit→group→segmented-plan→one-segment-at-a-time→checkpoint workflow for whole-codebase requests |
| `references/14-guarded-mode.md` | **Guarded mode** | Hook enforcement detail, the net-depth inventory, the Stop-hook close-out, disarm hygiene, and the hooks' honest limits |

The mechanics are language-agnostic (the source uses JavaScript, but the steps apply to
any language with functions, and most to any with classes). Adapt the concrete syntax;
keep the ordering and the test-after-each-step rhythm.
