# Catalog 06 — Refactoring APIs

A good module interface separates what callers must know from what they shouldn't. These
reshape function signatures and the contracts between caller and callee. Test after every
numbered step unless noted; revert and shrink the step if tests break.

## Contents
- [Separate Query from Modifier](#separate-query-from-modifier)
- [Parameterize Function](#parameterize-function)
- [Remove Flag Argument](#remove-flag-argument)
- [Preserve Whole Object](#preserve-whole-object)
- [Replace Parameter with Query](#replace-parameter-with-query)
- [Replace Query with Parameter](#replace-query-with-parameter)
- [Remove Setting Method](#remove-setting-method)
- [Replace Constructor with Factory Function](#replace-constructor-with-factory-function)
- [Replace Function with Command](#replace-function-with-command)
- [Replace Command with Function](#replace-command-with-function)

---

## Separate Query from Modifier
**Does:** Split a function that both returns a value and changes state into two functions.

**When:** A function returns a value *and* has side effects. Callers who only want the value
shouldn't be forced to trigger the side effect (Command-Query Separation). Makes Mutable
Data far easier to reason about.

**Mechanics:**
1. Copy the function; name the copy as a query (the populated variable's name is a good hint).
2. Remove all side effects from the new query function. Run static checks.
3. For each call using the return value, replace it with a call to the query, then insert a
   call to the original (modifier) below it. Test after each.
4. Remove return values from the original. Test.
- Tidy any resulting duplication between the query and the modifier.

---

## Parameterize Function
*formerly: Parameterize Method*

**Does:** Merge several near-identical functions that differ only in literal values, using
a parameter.

**When:** Functions repeat the same logic with different baked-in constants (Duplicated Code).
One parameterized function replaces them.

**Mechanics:**
1. Select one of the similar functions.
2. Change Function Declaration (above is catalog 06; see file 01) to add parameters for the
   literals.
3. For each caller, add the literal value. Test.
4. Change the body to use the new parameters. Test after each.
5. For each similar function, replace its calls with calls to the parameterized one. Test
   after each. (If the parameterized form doesn't fit a sibling, adjust it before moving on.)

---

## Remove Flag Argument
*formerly: Replace Parameter with Explicit Methods*

**Does:** Replace a boolean/enum flag that selects behavior with distinct functions.

**When:** A caller passes a literal flag to pick which behavior runs (`book(true)`). Explicit
functions (`premiumBook()`) read better and hide the dispatch. Worst when there are several
flags or the flag is a literal at the call site.

**When not to:** If the flag is genuinely a runtime value (not a literal at call sites),
explicit functions don't help — keep the parameter.

**Mechanics:**
1. Create an explicit function per flag value. (If there's a clear dispatch conditional, use
   Decompose Conditional (05); otherwise create wrapping functions.)
2. For each caller using a literal flag, replace with a call to the explicit function.

---

## Preserve Whole Object
**Does:** Pass an entire object instead of several values pulled from it.

**When:** A caller extracts several values from an object only to pass them as separate
arguments (Long Parameter List, Data Clumps). Passing the object shrinks the signature and
lets the callee ask for what it needs.

**When not to:** If passing the whole object would create an undesirable dependency from the
callee's module onto the object's, keep the values separate.

**Mechanics:**
1. Create an empty function with the desired parameters; give it a searchable name.
2. Fill its body with a call to the old function, mapping new parameters to old ones. Run
   static checks.
3. Adjust each caller to use the new function. Test after each. (Parameter-deriving code may
   become dead — Remove Dead Code (03).)
4. Inline Function (01) on the original.
5. Rename the new function and all its callers.

---

## Replace Parameter with Query
*formerly: Replace Parameter with Method*

**Does:** Remove a parameter the function can determine for itself.

**When:** A parameter's value can be derived from another parameter or the receiver. Fewer
parameters means less for the caller to figure out.

**When not to:** Don't do this if it would add an unwanted dependency to the function, or if
removing the parameter forces the function to reach into something it shouldn't. Keep the
parameter when the caller legitimately owns that decision.

**Mechanics:**
1. If needed, Extract Function (01) on the calculation of the parameter.
2. Replace references to the parameter in the body with the expression that yields it. Test
   after each.
3. Change Function Declaration (file 01) to remove the parameter.

---

## Replace Query with Parameter
*inverse of: Replace Parameter with Query*

**Does:** Pass a value in as a parameter instead of having the function look it up.

**When:** A function references something awkward in its scope — global data, or a
dependency you want to remove. Passing it in makes the function pure and easier to test/move,
shifting the responsibility to the caller.

**Mechanics:**
1. Extract Variable (01) on the query code to separate it from the rest of the body.
2. Extract Function (01) on the body that isn't the query call; searchable name.
3. Inline Variable (01) to remove the variable from step 1.
4. Inline Function (01) on the original function.
5. Rename the new function to the original's name.

---

## Remove Setting Method
**Does:** Remove a field's setter so the field can only be set at construction.

**When:** A field shouldn't change after creation; a setter signals it can. Removing it makes
the field effectively immutable, killing a class of Mutable Data bugs.

**Mechanics:**
1. If the value isn't supplied to the constructor, Change Function Declaration (file 01) to
   add it, and call the setter inside the constructor. (Add all values at once if removing
   several setters.)
2. Replace each setter call outside the constructor with the new constructor value. Test
   after each. (If you can't, because it's a shared reference object being updated, abandon.)
3. Inline Function (01) on the setter; make the field immutable if possible. Test.

---

## Replace Constructor with Factory Function
*formerly: Replace Constructor with Factory Method*

**Does:** Replace direct constructor calls with a factory function.

**When:** A constructor's limitations get in the way — you want a clearer name, to return a
subclass/proxy, or to avoid the `new` keyword's constraints.

**Mechanics:**
1. Create a factory function whose body calls the constructor.
2. Replace each constructor call with a call to the factory. Test after each.
3. Limit the constructor's visibility as much as possible.

---

## Replace Function with Command
*aka: Replace Method with Method Object*

**Does:** Turn a function into an object (a "command") with an execute method.

**When:** A function is complex — many local variables and parameters that obstruct Extract
Function. As an object, its locals become fields, making the internals far easier to
decompose. Commands also support undo, lifecycle, and richer parameterization.

**When not to:** This is heavier machinery; prefer a plain function unless the extra
flexibility is needed. If the function is simple, leave it.

**Mechanics:**
1. Create an empty class named for the function.
2. Move Function (03) into the class; keep the original as a forwarding function until the end.
3. Name the execute method per language convention (else `execute`/`call`).
4. Consider a field per argument, moving arguments to the constructor.

---

## Replace Command with Function
*inverse of: Replace Function with Command*

**Does:** Collapse a command object back into a plain function.

**When:** A command isn't doing enough to justify its weight (Lazy Element / Middle Man) — a
function is simpler.

**Mechanics:**
1. Extract Function (01) on the creation of the command plus the call to its execute method
   (this becomes the replacement function).
2. For each method called by execute, Inline Function (01). (If a supporting function returns
   a value, Extract Variable (01) on the call first, then inline.)
3. Change Function Declaration (file 01) to move all constructor parameters into execute.
4. Alter references to fields in execute to use the parameters. Test after each.
5. Inline the constructor call and execute call into the caller (the replacement function). Test.
6. Remove Dead Code (03) on the command class.
