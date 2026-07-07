# Catalog 04 — Organizing Data

Untangling how data is stored, named, and shared. These reduce the risks of Mutable Data
and clarify Mysterious Names. Test after every numbered step unless noted; revert and
shrink the step if tests break.

## Contents
- [Split Variable](#split-variable)
- [Rename Field](#rename-field)
- [Replace Derived Variable with Query](#replace-derived-variable-with-query)
- [Change Reference to Value](#change-reference-to-value)
- [Change Value to Reference](#change-value-to-reference)

---

## Split Variable
*formerly: Remove Assignments to Parameters / Split Temp*

**Does:** Give each distinct responsibility of a reused variable its own variable.

**When:** A single variable is assigned more than once for unrelated purposes (not as an
accumulator). One variable should mean one thing; reuse for two things invites the Mutable
Data smell.

**When not to:** Don't split a *collecting* variable (`i = i + x`, sums, concatenation,
stream writes, collection building) — repeated assignment there is legitimate.

**Mechanics:**
1. Rename the variable at its declaration and first assignment; if possible declare the new
   one immutable.
2. Change all references up to the second assignment. Test.
3. Repeat in stages — rename at each assignment and update references to the next
   assignment — until the final one.

---

## Rename Field
**Does:** Rename a field of a record/class.

**When:** A field name doesn't communicate its meaning (Mysterious Name). Field names shape
how the whole program talks about the data, so they're worth getting right.

**Mechanics:**
1. If the record has limited scope, just rename all accesses and test — skip the rest.
2. Otherwise, if not encapsulated, apply Encapsulate Record (02).
3. Rename the private field inside the object; adjust internal methods. Test.
4. If the constructor uses the name, Change Function Declaration (06) to rename it.
5. Rename Function (06) on the accessors.

---

## Replace Derived Variable with Query
**Does:** Remove a stored value that can be computed on demand.

**When:** A variable holds data derivable from other data and is kept in sync by update
code — a prime source of Mutable Data bugs. Computing it removes the chance of staleness.

**When not to:** If the source data is itself mutable and the calculation must reflect a
snapshot, keep judgment about whether a query is appropriate. Pure derivations from
immutable sources are the safe case.

**Mechanics:**
1. Identify all update points for the variable; use Split Variable (above) to separate each
   if needed.
2. Create a function that calculates the value.
3. Use Introduce Assertion (05) to assert the variable and the calculation agree wherever
   the variable is used (Encapsulate Variable (01) first if you need a home for the
   assertion). Test.
4. Replace each reader of the variable with a call to the new function. Test.
5. Remove Dead Code (03) on the declaration and updates.

---

## Change Reference to Value
*inverse of: Change Value to Reference*

**Does:** Turn an embedded reference object into an immutable value object.

**When:** A small object inside another is treated as a value (compared by content,
replaced wholesale). Making it an immutable value avoids aliasing bugs and is easier to
reason about, especially across processes.

**When not to:** If the object must be *shared* so updates are seen by all holders, it's a
reference, not a value — use Change Value to Reference instead.

**Mechanics:**
1. Check the candidate class is immutable or can become so.
2. For each setter, apply Remove Setting Method (06).
3. Provide a value-based equality method using the object's fields (override the
   hashcode/equality functions your language provides).

---

## Change Value to Reference
*inverse of: Change Reference to Value*

**Does:** Replace copies of a logical entity with references to a single shared instance.

**When:** The same real-world entity is represented by multiple physical copies, and an
update to one should be seen by all (e.g., a customer referenced by many orders). A single
shared object keeps them consistent.

**Mechanics:**
1. Create a repository for instances of the related object (if none exists).
2. Ensure the constructor can look up the correct instance.
3. Change the host object's constructors to obtain the related object from the repository.
   Test after each change.
