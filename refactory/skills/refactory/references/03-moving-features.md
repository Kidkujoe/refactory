# Catalog 03 — Moving Features

Relocating elements between contexts: functions, fields, statements, loops. These fix
misplaced behavior (Feature Envy, Insider Trading, Shotgun Surgery). Test after every
numbered step unless noted; revert and shrink the step if tests break.

## Contents
- [Move Function](#move-function)
- [Move Field](#move-field)
- [Move Statements into Function](#move-statements-into-function)
- [Move Statements to Callers](#move-statements-to-callers)
- [Replace Inline Code with Function Call](#replace-inline-code-with-function-call)
- [Slide Statements](#slide-statements)
- [Split Loop](#split-loop)
- [Replace Loop with Pipeline](#replace-loop-with-pipeline)
- [Remove Dead Code](#remove-dead-code)

---

## Move Function
*formerly: Move Method*

**Does:** Move a function to the context (module/class) it most belongs with.

**When:** A function references another module's data more than its own (Feature Envy), or
two modules pass too much data between them (Insider Trading). Move it to live with the
data it uses.

**Mechanics:**
1. Examine the program elements the function uses in its current context; decide whether
   any should move too. (Move a called function first if it should also move — start with
   the least-dependent in a cluster. If a high-level function is the sole caller of
   subfunctions, inline them, move, and re-extract at the destination.)
2. Check whether the function is polymorphic (account for super/subclass declarations).
3. Copy the function to the target; fit it in (pass needed source elements as parameters or
   pass a source reference; rename to suit the new context). Run static analysis.
4. Reference the target function from the source.
5. Turn the source function into a delegating function. Test.
6. Consider Inline Function (01) on the source. (It can remain a delegator indefinitely, but
   remove it if callers can reach the target directly.)

---

## Move Field
**Does:** Move a field to the record/class it logically belongs to.

**When:** A field is updated/used with another object's data, or its current home keeps
forcing changes elsewhere. Good data structure makes the rest of the code follow.

**Mechanics:**
1. Ensure the source field is encapsulated. Test.
2. Create a field (and accessors) in the target. Run static checks.
3. Ensure a reference exists from source object to target object (reuse an existing
   field/method, or add one — possibly temporary).
4. Adjust accessors to use the target field. (If the target is shared between source
   objects, first update the setter to modify both, add Introduce Assertion (05) to catch
   inconsistent updates, then finish once verified.) Test.
5. Remove the source field. Test.

---

## Move Statements into Function
*inverse of: Move Statements to Callers*

**Does:** Move statements that always run alongside a function call *into* that function.

**When:** The same code repeatedly precedes/follows a call — it belongs inside the callee.

**Mechanics:**
1. If the repetitive code isn't adjacent to the call, use Slide Statements to make it so.
2. If the target function is called only by the source, cut the code from the source, paste
   into the target, test — done.
3. Otherwise Extract Function on one call site, extracting both the call and the statements
   to move; give it a transient grep-able name.
4. Convert every other call to use the new function. Test after each.
5. Inline Function (01) the original into the new function, removing the original.
6. Rename Function (06) the new function to the original's name (or a better one).

---

## Move Statements to Callers
*inverse of: Move Statements into Function*

**Does:** Push statements out of a function back into its callers.

**When:** A function that once captured a coherent behavior now does something the callers
need to vary — the shared bit and the varying bit should split.

**Mechanics:**
1. Simple case (one/two callers, simple function): cut the line(s) from the called function
   and paste into the callers. Test — done.
2. Otherwise Extract Function on the statements you *don't* want to move; transient grep-able
   name. (If overridden by subclasses, extract in all so the remaining method is identical
   everywhere, then remove the subclass methods.)
3. Inline Function (01) on the original function.
4. Change Function Declaration (06) to rename the extracted function to the original's name.

---

## Replace Inline Code with Function Call
**Does:** Replace a hand-written fragment with a call to a function that already does it.

**When:** Inline code duplicates the behavior of an existing function. Calling it removes
duplication and lets the reader rely on the function's name.

**Mechanics:**
1. Replace the inline code with a call to the existing function. Test.

---

## Slide Statements
*formerly: Consolidate Duplicate Conditional Fragments*

**Does:** Reorder statements so related code sits together.

**When:** Related code is intermingled with unrelated code. Often a preparatory step for
Extract Function (which needs the code contiguous first). Declaring variables just before
first use is a common application.

**When not to:** Don't slide across interfering statements (see the constraints below) —
abandon if there's interference.

**Mechanics:**
1. Identify the target position. Check statements between source and target for
   interference; abandon if any:
   - can't slide backward before anything it references is declared;
   - can't slide forward past anything that references it;
   - can't slide over a statement that modifies an element it references;
   - a modifying fragment can't slide over another statement referencing the modified element.
2. Cut the fragment and paste it at the target. Test.
- If tests fail, slide less code or move a smaller fragment.

---

## Split Loop
**Does:** Split a loop doing two things into two loops each doing one.

**When:** A single loop computes several independent things, making it hard to name or
reuse (Long Function). Splitting lets each be understood, and later each loop can become a
named function or pipeline. (Yes, this means two passes — address performance separately,
and only if profiling shows it matters.)

**Mechanics:**
1. Copy the loop.
2. Identify and eliminate duplicate side effects across the two copies. Test.
3. When done, consider Extract Function (01) on each loop.

---

## Replace Loop with Pipeline
**Does:** Replace an imperative loop with collection-pipeline operations (map/filter/etc.).

**When:** A loop obscures which elements are selected and what's done with them (the Loops
smell). A pipeline reads top-to-bottom as a sequence of transformations.

**Mechanics:**
1. Create a new variable for the loop's collection (often a copy of an existing variable).
2. From the top, replace each bit of loop behavior with a pipeline operation in the
   derivation of that collection variable. Test after each.
3. Once all behavior is moved out, remove the loop. (If it fed an accumulator, assign the
   pipeline result to the accumulator.)

---

## Remove Dead Code
**Does:** Delete code that is never executed.

**When:** Unused code (often Speculative Generality whose moment never came). Even
commented-out code is noise — version control remembers it.

**Mechanics:**
1. If the dead code is reachable from outside (e.g., a public function), search for callers
   to confirm none remain.
2. Remove the dead code. Test.
