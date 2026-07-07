# refactory

A Claude Code plugin for **disciplined, behavior-preserving code refactoring**.

`refactory` gives the agent a catalog of **61 named refactorings** (step-by-step
mechanics), a **code-smell trigger table**, and — most importantly — the **safety
discipline** that keeps changes from breaking things: establish a test net first, take
the smallest steps, run tests after each, revert on red, and never mix a refactoring with
a behavior change.

It is designed to be used **proactively**: while reading or editing code for any task, the
agent flags smells by name and offers the relevant fix, rather than waiting to be asked.

## What's inside

- **Smell → fix trigger table** — 24 code smells mapped to the refactorings that resolve them.
- **The catalog** — 61 refactorings across eight families:
  - basics (extract/inline, rename, change declaration, parameter object, split phase)
  - encapsulation, moving features, organizing data
  - simplifying conditionals, refactoring APIs, dealing with inheritance
  - React / Next.js (component & hook extraction, lift state, derived-state-in-state, client boundary)
- **Getting code under test** — how to build a safety net when code resists testing
  (seams, stubbing the clock/network/db/filesystem/randomness, characterization tests).
- **The discipline** — two hats, behavior preservation, version-control-backed revert,
  net *depth* (not just existence), rigor scaled to stakes, and audience-adaptive feedback
  (plain language for non-technical users).
- **Guarded mode** — a self-arming enforcement layer (hooks) that makes the net-first gate
  and the closing ledger mechanical instead of skippable, active only while a refactor is armed.
- **Fix phase** — refactoring *surfaces* bugs but never fixes them; each is filed to a backlog
  and fixed separately, on demand, by a fresh context-isolated fixer.
- **Learning loop** — a per-project `.refactory/learnings.md` lab notebook whose lessons are
  reloaded each session, with a deliberate approval gate before any lesson becomes a skill edit.

## Install (via Claude Code plugin marketplace)

1. Add this repository as a marketplace:
   ```
   /plugin marketplace add Kidkujoe/refactory
   ```
2. Install the plugin:
   ```
   /plugin install refactory@refactory-marketplace
   ```
3. The `refactory` skill is now available; Claude will consult it automatically when you
   work on code, or you can prompt it directly ("refactor this", "this is messy", etc.).

To update later: `/plugin marketplace update refactory-marketplace`

### Manual install (without the marketplace)

Copy `refactory/skills/refactory/` into your Claude Code skills directory
(`~/.claude/skills/refactory/`). The skill body (SKILL.md + the `references/` folder) is
self-contained. The `commands/` and `hooks/` (guarded mode) only run when installed as a
full plugin.

## Validate (if editing)

From the repo root, with Claude Code installed:
```
claude plugin validate .
```

## How it behaves

When you ask it to clean up code (or it spots a smell on its own), it will:
1. Find or establish a test safety net **before** changing anything — and check the tests
   actually cover the code being changed, not just that the suite is green.
2. Name the smells it sees and the refactorings that address them.
3. Apply them in small, version-controlled steps, running tests after each and reverting
   on any failure.
4. Preserve observable behavior throughout, and report what changed — in plain language
   if you're not a developer.

### Explicit refactor requests — guarded mode

When you ask for a refactor, the skill **arms a guard** (`.refactory/guard.json`). While the
net is unresolved, a `PreToolUse` hook blocks edits to source files (tests, docs, and
`.refactory/` stay editable) until you've decided how to net the change — write a
characterization test, accept the risk, defer, or refactor only the low-risk slice. A `Stop`
hook then refuses to end the turn until the discipline ledger is written. Nothing about this
runs unless a refactor is armed; you can always override with `/refactor on|off|status`.

### Refactoring a whole project

Ask it to "refactor this project" and it won't attempt one giant rewrite. Instead it
**audits** the codebase (looking for duplication, change-ripple, coupling, and hot spots —
not just local smells), **groups related issues** into chunks, writes a prioritised
`REFACTORING_PLAN.md` to your repo, then works **one chunk at a time, checking in with you
between each**. The plan is saved, so a cleanup can span sessions and your team can see it.

### The `/refactor` command

`/refactor on | off | status | backlog | fix | review` controls the guard, inspects the
surfaced-bug backlog, and starts the separate fix phase. See `refactory/commands/refactor.md`.

### Hooks

The plugin wires three hooks (`refactory/hooks/hooks.json`):
- **SessionStart** → `refactory-load-lessons.js` injects the current project's distilled lessons.
- **PreToolUse** (Edit/Write) → `refactory-gate.js` enforces the net-first gate while armed.
- **Stop** → `refactory-ledger-check.js` blocks close-out until the ledger is recorded.

The old fire-on-every-edit duplicate-block watcher (`refactory-watch.js`) is **disabled by
default** — it was noisy and low-precision, and a noisy flag is worse than none. The script
is kept in the repo as a reference only. If you don't want any hooks, delete `refactory/hooks/`.

## Repository layout

```
.
├── .claude-plugin/
│   └── marketplace.json          # marketplace catalog
├── marketplace.json              # same catalog (root copy)
└── refactory/                    # the plugin
    ├── .claude-plugin/
    │   └── plugin.json           # plugin manifest
    ├── commands/
    │   └── refactor.md           # the /refactor command
    ├── hooks/
    │   ├── hooks.json            # SessionStart + PreToolUse gate + Stop ledger-check
    │   ├── refactory-load-lessons.js
    │   ├── refactory-gate.js
    │   ├── refactory-ledger-check.js
    │   ├── refactory-verify.js
    │   ├── refactory-dashboard.js
    │   └── refactory-watch.js    # legacy watcher, not wired in
    └── skills/
        └── refactory/
            ├── SKILL.md          # the skill (always-loaded body)
            └── references/       # the catalog + discipline docs, loaded on demand
```

## License & credits

Licensed under MIT (see `LICENSE`). The refactoring and smell vocabulary and mechanics are
derived from the established refactoring literature — see `CREDITS.md`.
