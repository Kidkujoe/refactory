# Reference 11 — Surfaced-bug backlog & the fixer handoff

Refactory's job is to *surface* bugs and preserve behavior — never to fix bugs mid-refactor
(that's the two-hats rule). But surfaced bugs still need fixing. This reference defines (a)
the structured backlog refactory writes surfaced bugs into, and (b) how a **separate fixer**
picks them up — dispatched as a fresh, context-isolated agent via the Task tool, the pattern
proven in subagent-driven frameworks (you craft exactly the context the fixer needs; it never
inherits the refactor session's history; this keeps it focused and preserves your own context
for coordination).

## Phase separation is the safety property

The fix phase is **separate from and after** the refactor phase, and **user-triggered** — never
interleaved. This is not bureaucracy: keeping them apart is what makes "did the cleanup break
it?" and "did the fix break it?" two separate, answerable questions. Refactor fully, land it,
confirm behavior preserved, *then* run the fix phase as its own step.

## The backlog file

`.refactory/backlog.md` at the repo root — **tracked in version control** (unlike the
transient `guard.json`; like `learnings.md`, it's shared state). Refactory appends a record
for every bug it surfaces but doesn't fix. Each gets a stable ID, a risk band, and a
blast-radius note, and is checked off when fixed.

```
# refactory backlog (surfaced, not fixed)

- [ ] BUG-003  risk:HIGH  found:2026-05-29 affiliate page, during Extract Hook
      where: useTrackingBookingMutations.ts — saveInvoice optimistic update
      what:  no rollback on DB failure → silent UI/DB desync, only visible on reload
      blast: shared cache; touches every list that reads invoices — NOT isolated
- [ ] BUG-004  risk:LOW   found:2026-05-29 affiliate page, during Extract Component
      where: AffiliateCard.tsx line ~80
      what:  dead variable `prevTotal` never read
      blast: local to one component, pure — isolated
- [x] BUG-001  (fixed 2026-05-30, PR #181, reproduction test added)
```

Risk bands come from the taxonomy: HIGH = optimistic mutations, state machines, write queues,
async/timer sequences, DnD, WebSockets; LOW = pure render, read-only, pure pipelines.

## Running the fix phase

When the user triggers the fix phase (e.g. `/refactor fix`), the coordinator reads the
backlog, orders items **highest-risk-first**, and for each open bug dispatches a **fresh
fixer** via the Task tool using the template below. Dispatch one bug at a time; do not pause
between low-risk fixes, but do surface HIGH-risk decisions to the user.

### Fixer dispatch template (the prompt sent to the fresh agent)

> You are a bug-fixer with a single, isolated task. You have no context from any prior
> session — only what's below. Fix exactly this one bug and nothing else.
>
> **Bug:** {paste the backlog record — where, what, risk, blast}
>
> **Step 1 — Confirm the blast radius before trusting "isolated."** Cheaply check: how many
> callers does this touch? Is the code pure (inputs→outputs) or does it touch shared state,
> a cache, the DB, async timing? Most damaging "simple" fixes were wrongly assumed isolated.
> Establish isolation; don't feel it. Also cheap and worth it: grep `.refactory/` (including
> `archive/`) for the file you're about to touch — a past bug in the same area is a risk-band
> signal, and how it failed last time is free intelligence.
>
> **Step 2 — Pick the path by blast radius (scale effort to risk):**
> - **Simple + isolated + LOW** (one caller, pure, no shared state): fix it directly. Run
>   the cheap path's three non-negotiables (v1.13.0 — "trivial" is the most abused word in
>   fixing, and the most damaging "simple" fixes were the ones wrongly *assumed* isolated):
>   1. **Show the isolation, don't feel it** — state what the quick check found ("1 caller,
>      pure, touches nothing shared"). If you can't show it in a few seconds, it was never a
>      trivial fix — that's the answer, not an obstacle.
>   2. **Leave a one-line record** in `backlog.md` even for inline fixes ("BUG-014: typo in
>      date formatter — fixed inline, 1 caller confirmed, commit abc123"). One sentence; it
>      makes the fix visible to the dashboard, findable by the history grep, and — if the
>      "trivial" judgment later proves wrong — traceable as a lesson.
>   3. **The diff cancels the shortcut automatically** — if the "trivial" fix touches
>      rollback/restore, optimistic cache, persistence ordering, or any shared/persisted
>      state, it loses trivial status on the spot (the same diff-triggered escalation as
>      verification). The decision comes from what the change touches, not from how small it felt.
>   With those three met: run whatever tests exist plus a quick sanity check that the obvious
>   thing still works, and commit (its own commit, always). No reproduction-test ceremony —
>   that would be over-engineering.
> - **Tangled / wide / HIGH-risk:** use the verify-and-iterate loop:
>   1. **Enumerate the mutation surface first** (net-depth — the failure that ships fix bugs):
>      list *everything* this operation writes — every field, store, side-effect, persisted
>      value, rollback/restore path. A fix verified against an incomplete surface passes green
>      and is still wrong (real case: a "prune" stripped three things; the net asserted one; the
>      half-fix shipped). The reproduction test and its assertions must cover the *whole*
>      surface, not just the symptom you first saw.
>   2. Write a test that *reproduces* the bug (fails now, because the bug exists), asserting on
>      the full surface from step 1.
>   3. Make the fix.
>   4. Run the reproduction test (is the bug gone?) **and** the surrounding suite (did
>      anything else break?).
>   5. Bug-test green AND nothing else red → keep it, commit (its own revertible commit).
>   6. Something else went red → **revert to the last green commit.** The red test tells you
>      *what* broke; understand it, form a better fix, try again. Iterate until both hold.
>   - If the area has no tests and resists having any written (untestable HIGH-risk), do NOT
>     ship an unverified fix. Stop and surface the choice: (A) build a test harness first,
>     (B) the user explicitly accepts an unverified fix, (C) defer. Record which.
>
> **Note on the "net":** the reproduction test + surrounding suite are not a blocker — they
> are the *instrument* that makes "revert when it breaks" possible. Without a way to detect
> "fixed" and "regressed," you cannot revert-on-regression; you can only break things quietly.
> But a *shallow* net is worse than none: it says "fixed!" while the bug ships. Net depth (the
> full surface, step 1) is what makes the instrument trustworthy.
>
> **Step 3 — Report back:** update the backlog item to fixed (with the commit/PR) or
> deferred/needs-decision, and note one lesson if it generalizes. **For any behavior-changing
> fix, the item is not "done" until its PR's review threads have been pulled and triaged** —
> a green CI check is not a review. Read the actual review comments (e.g.
> `gh pr view <n> --json reviews,comments`), classify each finding (regression I introduced →
> fix here; pre-existing surfaced → new backlog item; nit → address or note; reviewer wrong →
> reply), and record `reviewed: <summary>` on the backlog item — the summary must **name the
> actual findings** ("reviewed: 2 nits fixed, 1 false positive on memoization, no regressions
> flagged"), because a bare "reviewed: done" is self-attestation with extra steps. Evidence across sessions: the
> net + self-judgment caught *none* of the fix-phase bugs; external review caught *all* of them.
> Treat external review as the real safety net for behavior changes, not a formality.
>
> **If you discover another bug while fixing this one,** don't reflexively fix it inline — but
> don't reflexively file-and-ignore it either. Ask the deciding question: *can I fix and verify
> my assigned bug correctly without also changing this one?*
> - **Same bug, two symptoms** (fixing the root cause makes both disappear): it was never two
>   bugs. Treat it as one fix with a description covering both symptoms and one net that
>   exercises both. This is correct scoping, not bundling.
> - **Entangled — distinct bugs, but you can't cleanly fix or verify yours without the other
>   in play:** STOP and re-scope; don't silently widen the work. Surface the entanglement and
>   the options — (a) one combined fix with one net covering both, (b) fix the other first as
>   its own item then return, (c) the coordinator decides the order. Widening the fix is a
>   deliberate decision with a net that covers the wider change, never a reflex because you
>   were already in there.
> - **Merely nearby — independent** (proximity, not entanglement; fixing yours doesn't touch
>   its correctness): you don't need a whole separate dispatch for it. If it's **trivial and
>   you can confirm in a few seconds that it's isolated** (one caller, pure, no shared state),
>   fix it in the same session — but as its **own separate commit** with a one-line note, never
>   folded into your assigned bug's commit. The property that matters is "each change is one
>   known, reviewable, revertible thing," and a separate *commit* gives you that; a separate
>   *agent dispatch* is just the expensive way to get the same thing. If it's **not trivial, or
>   you can't quickly confirm it's isolated**, then log it as a *new* backlog item (own ID, risk
>   band, blast-radius) for its own dispatch later — the heavier path is earned by the risk, not
>   spent by default. "Same file/feature" is not "entangled."
>
> Scale the cost to the actual risk, not to a blanket rule: a provably-trivial fix costs one
> extra commit (nearly free); reserve the backlog-and-dispatch machinery for bugs whose risk
> justifies it. The only non-negotiable even for a trivial fix is the few-second isolation
> check — that's what catches the "looked like a typo, was actually load-bearing" case.
>
> The trap to avoid is the unilateral, unscoped "it's related, I'll just fix it too" — most bad
> bundles felt related at the time. "Related" means *make the decision explicit*, not *skip
> making it*. So: separate **commit** always (never bundle two fixes into one commit); separate
> **dispatch** only when the bug is non-trivial or its isolation can't be quickly confirmed.

### Independent verification — triggered by the change, not a self-assigned band

After a fixer reports done, an independent check often follows. The trigger must NOT be a
self-declared risk band — that safeguard fails exactly when it's needed, because the agent
that lowballs the risk is the one that needed catching (real case: data-loss fixes were all
self-classified LOW/MEDIUM, so the verifier never fired and the bugs shipped). Instead,
**trigger on the nature of the change, read from the diff** — it is mandatory when the fix
touches any of:

- **rollback / restore / undo** paths
- **optimistic cache** updates or snapshot-and-restore
- **persistence ordering** (what's written, in what order, on success vs failure)
- **anything that writes shared/persisted state** (stores, prefs, DB mutations)

These are detectable from the diff and they are precisely the surfaces that ship silent
bugs. For them, prefer **real external review** (the PR reviewer / CI review bot, threads
read and triaged — see Step 3) over a self-dispatched agent: the evidence is that external
review caught the fix bugs the agent's own checks missed. A second fresh agent is a useful
addition (it catches the "I convinced myself" self-delusion the original fixer can't), but it
shares the original's ceiling if handed the same shallow surface — so for the trigger
surfaces above, route to external review, don't only self-verify. Strengths-then-issues; the
coordinator decides.

## Honest limits

- **Dispatch reliability is platform-dependent.** Task-dispatch works well on Claude Code but
  isn't uniform across agents; on some it falls back to manual. This is verified by
  construction here, not by long battle-testing — confirm it actually dispatches on your setup.
- **The fixer inherits the judgment ceiling.** Hooks/structure can enforce that a fix is
  committed and tests were run; they cannot guarantee the fix is *correct* or that the
  blast-radius call was *right*. That's why HIGH-risk fixes get independent verification and
  surface decisions rather than auto-shipping.
- **Revert needs a detector.** The whole keep/revert/iterate loop is only possible because
  there's a way to tell fixed-vs-broken. For genuinely untestable code, that detector doesn't
  exist, so "fix safely" degrades to "decide knowingly" — never "fix blindly."
