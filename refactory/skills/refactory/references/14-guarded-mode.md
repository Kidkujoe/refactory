# Guarded refactor mode — full enforcement detail

SKILL.md carries the operative parts (arm the guard, the relaxation rules, the four-option net
menu, the risk taxonomy, manual controls). This file carries the supporting detail: how the
hooks behave, the net-depth inventory, disarm hygiene, and honest limits.

## How the hooks enforce it

The skill's gate and ledger are instructions, which can be skipped under pressure. The plugin
ships hooks that make them mechanical while a guarded refactor is **armed** (a
`.refactory/guard.json` sentinel exists). They never touch normal coding — absent the sentinel,
they do nothing.

While `net` is `pending`, the PreToolUse hook **denies edits to source files** (test files,
`.refactory/`, and non-source docs like `*.md`/`NOTES`/`REFACTORING_PLAN` stay editable).

Record the answer in `guard.json`, e.g. `{"net": "accepted-risk", "decision": "B",
"target": "app/.../page.tsx", "test_quality": "constraint-check"}`. Set `net` to `green` (option
A, once tests exist) or `accepted-risk` (option B) to unblock edits. Ask **once** per session;
only re-ask if the target file changes.

On **option D (hybrid)**, also record `"deferred"`: the HIGH band you are deliberately not
netting/touching, as file paths or globs — e.g. `{"net":"green","decision":"D","deferred":
["app/state/optimistic-cache.ts","app/state/**"]}`. This keeps the recorded state honest about
what was left un-netted. The gate does **not** currently enforce this boundary (see Honest
limits); the field is a truthful record and is logged at close-out (its count) so we can see how
often hybrid refactors happen before deciding whether scope enforcement is worth building.

## Net-depth inventory (when net is green)

When `net` is `green`, also record the net-depth inventory (see references/12-net-discipline.md):
`"surface"` = the full list of what the operation mutates (every field/store/side-effect/
persisted value), and `"asserted"` = what the net actually checks — or `"surface": "none"` for a
pure behavior-preserving move. e.g. `{"net":"green","decision":"A","surface":["bookingIds",
"activeSections","sectionToggles"],"asserted":["bookingIds","activeSections","sectionToggles"]}`.

At end of turn the Stop hook blocks finishing until the close-out is complete: (1) the ledger is
persisted to `learnings.md`; (2) any surfaced bugs are logged to `backlog.md`; (3) when `net` is
`green`, the inventory exists and `asserted` covers the whole `surface` (it checks coverage of
what you *listed* — it can't verify the list is *complete*, so enumerate adversarially); and
(4) a fixed backlog item citing a PR carries a `reviewed:` note (a green check is not a review).

## Disarm hygiene & reflection

- **Forced log on disarm** — if a session armed but produced no ledger, before disarming, state
  why (e.g. "decided not to refactor after audit") and record it. This catches the "armed, then
  abandoned, no net check ever happened" path.
- **End-of-session reflection** — if a session made many edits to one file but never armed, note
  in the close-out: "this may have been a refactor that didn't get gated — consider `/refactor
  on` next time." (This is the only silent-miss backstop; there is deliberately no per-edit
  probe, because a flag that fires on every edit just trains ignoring it.)

## Honest limits

The hooks enforce *structural* facts (a net decision was recorded; the ledger was written) — not
judgment (whether the net is adequate, whether two hats held). Self-arming fires the guard
automatically, but it's still the skill choosing to arm; if the skill doesn't recognize the
refactor, nothing arms (fail-open — no worse than today, and the end-of-session reflection is the
catch). And the PreToolUse block depends on your Claude Code honoring a hook `deny`; if it
doesn't, arming and the A/B/C/D prompt still happen, but the edit isn't physically blocked. The
test that the whole chain works: once armed, refuse to answer A/B/C/D, try to edit — you should
be stopped.

The gate only sees **file-editing tools** (Edit/Write/MultiEdit/NotebookEdit). It does **not**
cover writes made through **Bash/shell** — a redirection (`>`, `>>`), `tee`, `sed -i`, `git
apply`, `patch`, or a code-generating script can modify source while a refactor is armed and the
gate will never see it. Detecting those reliably would mean parsing arbitrary shell, which is
leaky by nature, so it is deliberately not attempted: the gate is a discipline aid, not a sandbox.
While armed, keep source changes in the editing tools so the net-first gate actually applies.

The `deferred` field (option D) is recorded and its count is logged, but the gate does **not**
enforce it — an edit to a deferred HIGH-band file is not blocked. It documents intent and gathers
evidence; it is not a scope guard.
