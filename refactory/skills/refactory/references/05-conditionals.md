# Catalog 05 — Simplifying Conditional Logic

Conditionals are where complexity accretes fastest. These clarify, consolidate, or
replace branching. Test after every numbered step unless noted; revert and shrink the
step if tests break.

## Contents
- [Decompose Conditional](#decompose-conditional)
- [Consolidate Conditional Expression](#consolidate-conditional-expression)
- [Replace Nested Conditional with Guard Clauses](#replace-nested-conditional-with-guard-clauses)
- [Replace Conditional with Polymorphism](#replace-conditional-with-polymorphism)
- [Introduce Special Case](#introduce-special-case)
- [Introduce Assertion](#introduce-assertion)

---

## Decompose Conditional
**Does:** Extract the condition and each branch of a complex conditional into named functions.

**When:** A conditional's test or branches are hard to read. Naming them ("isSummer(date)"
rather than the raw comparison) makes the *why* visible and hides the *how*.

**Mechanics:**
1. Apply Extract Function (01) on the condition, and on each leg of the conditional.

---

## Consolidate Conditional Expression
**Does:** Combine several conditionals that share the same result into one.

**When:** A sequence of checks all lead to the same action — combining them states the
single underlying reason, and sets up an Extract Function to name it.

**When not to:** If the conditions are genuinely independent reasons (not one combined
concept), leave them separate.

**Mechanics:**
1. Ensure none of the conditionals have side effects (apply Separate Query from Modifier
   (06) first if any do).
2. Combine two conditions with a logical operator — sequences with `or`, nested `if`s with
   `and`. Test.
3. Repeat until they form a single condition.
4. Consider Extract Function (01) on the result.

---

## Replace Nested Conditional with Guard Clauses
**Does:** Convert nested conditionals into flat guard clauses for exceptional cases.

**When:** Nesting obscures the normal path. Guard clauses say "this is an unusual case,
handle and leave" up front, leaving the main flow unindented and clear. Use when branches
are *not* equally weighted — one is the happy path.

**Mechanics:**
1. Select the outermost condition to replace and turn it into a guard clause. Test.
2. Repeat as needed.
3. If all guard clauses return the same result, use Consolidate Conditional Expression.

---

## Replace Conditional with Polymorphism
**Does:** Move the legs of a conditional into overriding methods of subclasses.

**When:** The same switch/if-cascade on a type appears in multiple places (Repeated
Switches), or you want to separate base logic from variant logic. Polymorphism lets you add
a new case by adding a class rather than editing every switch.

**When not to:** A single, localized conditional doesn't justify a class hierarchy. Don't
reach for polymorphism just because a `switch` exists — the trigger is *repetition* or a
clear base/variant split.

**Mechanics:**
1. If no classes exist for the polymorphic behavior, create them plus a factory function
   returning the correct instance.
2. Use the factory in calling code.
3. Move the conditional function to the superclass (Extract Function (01) first if it isn't
   self-contained).
4. Pick a subclass; create an overriding method; copy that leg's body into it and adjust. Test.
5. Repeat for each leg.
6. Leave a default in the superclass method — or make it abstract / throw if every case must
   be handled by a subclass.

---

## Introduce Special Case
*aka: Introduce Null Object*

**Does:** Replace repeated checks for a special value with a dedicated object that responds
appropriately.

**When:** Many places compare a value against the same special case (often `null`) and react
the same way (Repeated Switches / scattered null checks, Temporary Field). A special-case
object captures that common behavior in one place.

**Mechanics:**
1. Start from a container with the subject property whose special value clients compare against.
2. Add a special-case check property to the subject, returning `false`.
3. Create a special-case object with that property returning `true`.
4. Extract Function (01) on the special-case comparison; route all clients through it.
5. Introduce the special-case object (returned from a call or via a transform).
6. Change the comparison function to use the check property. Test.
7. Use Combine Functions into Class (01) or Combine Functions into Transform (01) to move the
   common special-case behavior into the new element (often a literal record of fixed values).
8. Inline Function (01) on the comparison function where still needed.

---

## Introduce Assertion
**Does:** Make an assumed-true condition explicit with an assertion.

**When:** A section of code only works under an assumption that isn't stated. An assertion
documents the assumption and fails fast if it's violated — and aids other refactorings
(e.g., verifying a derived variable matches its query).

**Note:** Assertions must not affect program behavior, so adding one is always
behavior-preserving. They communicate; they are not error handling for expected conditions.

**Mechanics:**
1. Where a condition is assumed true, add an assertion stating it.
