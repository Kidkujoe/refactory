# Reference 09 — Getting Code Under Test

The skill's core rule is "a net before you touch anything." On clean, pure code that's
easy. On real code it's often the hard part: the code reaches out to the world (network,
database, filesystem, clock, randomness) or is too tangled to instantiate in a test. This
file is how you create a net anyway. The bind is real — you usually need a small change to
make the code testable, but changing untested code is the thing you're trying to avoid. The
way out is to make the *smallest, safest* enabling change first, then test, then refactor
freely.

## The order of operations

1. **Try to test it as-is first.** Don't assume you need a seam. Many functions are purer
   than they look — pass inputs, assert outputs.
2. **If it has a hidden dependency, create a seam** (a place to substitute behavior without
   editing logic). The safest seams are the most mechanical refactorings, which is why the
   skill leans on them here.
3. **Pin behavior with a characterization test** through that seam.
4. **Now refactor** under the net.

## Seams — the safe enabling moves

A *seam* is a point where you can change what the code does without editing it in place.
Creating one is itself a low-risk refactoring from the catalog:

- **Parameterize the dependency** — Replace Query with Parameter (`06`). A function that
  calls `Date.now()` or `fetch()` internally becomes one that takes the value (or a
  function) as an argument. The original behavior is preserved by passing a default; the
  test passes a fake. This is the single most useful move for untestable code.
- **Extract the pure core** — Extract Function (`01`) / Split Phase (`01`). Pull the
  decision/calculation away from the I/O so the logic becomes a pure function you can test
  directly, leaving a thin I/O shell. (This is the same tactic React uses in `08`.)
- **Encapsulate the access point** — Encapsulate Variable (`01`) on a global or singleton
  so reads/writes go through a function you can override in a test.
- **Inject the collaborator** — pass a dependency in (constructor or parameter) instead of
  constructing it inside. The default keeps production behavior; the test supplies a double.

Each of these is behavior-preserving and small — exactly the kind of change you can make
with reasonable confidence even before a full net exists, because it doesn't touch logic.

## Stubbing the usual offenders

| Dependency | The problem | Make it testable by |
|------------|-------------|---------------------|
| Clock (`Date.now`, `new Date()`) | Output changes every run | Pass the time in (Replace Query with Parameter), or inject a clock function; in tests use the framework's fake timers |
| Randomness | Non-deterministic | Inject the RNG / seed it; pass the random value in |
| Network / HTTP | Slow, flaky, external | Extract the call behind an interface; mock it in tests, or wrap with the framework's request-mocking |
| Database | State, setup cost | Inject a repository interface; use an in-memory/fake implementation, or a transactional test DB |
| Filesystem | Side effects, environment | Inject the fs operations, or pass content in/out as values |
| Environment / config | Hidden global input | Read it once at a boundary and pass the value down (Replace Query with Parameter) |

The recurring pattern in every row: **push the impure thing to the edge and pass its result
in**, so the part you want to refactor becomes pure and directly testable.

## Characterization tests (pinning behavior you don't fully understand)

When refactoring legacy code, you often don't *know* the intended behavior — only that it
must not change. Characterization tests capture *what the code currently does*, bugs and
all (the skill's rule 2: preserve behavior, don't fix bugs under cover of refactoring).

1. Write a test that calls the code with representative inputs.
2. Assert against whatever it actually returns *right now* — capture the real output and
   lock it in, rather than what you think it "should" be. (For large outputs, an
   approval/snapshot test that records the current output is efficient.)
3. Cover the branches you're about to touch, plus edge cases (empty, zero, negative,
   boundary values).
4. Run them green before refactoring. If a "wrong-looking" value appears, preserve it
   anyway and note it to the user as a possible latent bug — fix it separately, under its
   own change, with its own test.

## When there's genuinely no seam

Some code can't be cracked without a risky structural change first (a giant function that
constructs everything it touches, with no injection point). Options, least-risky first:

- Make the *one* enabling change with extreme care and the smallest possible diff (e.g.,
  extract a single pure function), eyeballing it and leaning on the compiler if typed —
  then test the extracted piece.
- Add an end-to-end / integration test at a higher level (drive the whole module from
  outside) to get *some* net, even if coarse, before working inside.
- If neither is feasible, tell the user plainly: this code can't be refactored safely
  without first investing in testability, and that investment is itself the task. Don't
  proceed with structural refactoring on a blind spot.
