# Net discipline — depth, the no-net gate, and false nets

Read this when discipline rule 3 ("safety net before you touch anything") needs its full
reasoning and edge cases. SKILL.md carries the operative rules; this file carries the *why*.

## Net depth, not just net existence

A green net only proves the change satisfies *the spec you wrote* — and a shallow net is
*worse than no net*, because it manufactures confidence ("tests pass!") while a real bug ships
under it. The discipline: **before writing the net, enumerate the complete mutation surface** —
every field, store, side-effect, and persisted value the operation writes — and assert on *all*
of it. Record it: in `.refactory/guard.json`, set `"surface"` to that list and `"asserted"` to
what the net checks (or `"surface": "none"` for a pure behavior-preserving move with no mutated
state). The guard enforces that your net covers everything you *listed* — but it **cannot** tell
whether your list is complete; that's the judgment that fails. So enumerate adversarially: *what
else does this touch — other stores, rollback/restore paths, cached copies, persisted prefs,
ordering?* A real example of the trap: a "prune" that strips three things, netted with an
assertion on only one — the incomplete fix passed green and shipped. Net-first without net-depth
is the central failure mode.

## The no-net gate — full rationale

Once the two no-gate cases (mechanical jobs; LOW-risk you can net cheaply) are ruled out: if you
are about to refactor with no automated net and aren't creating one first, **end your turn and
ask** — do not edit any source file in the same turn.

The user's silence is not consent; mentioning the absence and continuing in the same turn is a
violation of this rule, not compliance with it. "Flag and proceed" is exactly the failure this
gate exists to prevent. Do **not** substitute "I'll smoke-test at the end" — that is not a net,
and deferring it past a merge ships broken behavior unnoticed. UI, animation,
async/optimistic-update, and glue code are where skipping it is most tempting and most dangerous,
so be especially strict there. It does **not** fire on a mechanical job or a LOW-risk target you
can cheaply net yourself; halting on those is the over-stopping failure, the mirror image of
skipping the gate when it matters.

Only after the user answers: if they accept the risk (option b), proceed with the most
mechanical, lowest-risk moves and lean on the compiler as a partial oracle — the risk is now
their logged choice, not a gap you hid. (When the optional guarded-refactor hook is active, this
gate is enforced mechanically — see "Guarded refactor mode" — but honor it regardless.)

## A false net is not a net

A passing test suite that only asserts on *source text* (greps for variable names or literals)
is **not** a behavior net — it false-fails on legitimate renames/extractions and passes through
real breakage. Treat that as no net.
