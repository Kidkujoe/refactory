# Catalog 01 — A First Set of Refactorings

The everyday workhorses. Almost every larger refactoring decomposes into these.
Every entry follows: **what it does → when to use / when not to → mechanics
(small, test-verified steps) → companions**. Test after every numbered step unless
noted; if a step breaks tests, revert and take a smaller step.

## Contents
- [Extract Function](#extract-function)
- [Inline Function](#inline-function)
- [Extract Variable](#extract-variable)
- [Inline Variable](#inline-variable)
- [Change Function Declaration](#change-function-declaration)
- [Encapsulate Variable](#encapsulate-variable)
- [Rename Variable](#rename-variable)
- [Introduce Parameter Object](#introduce-parameter-object)
- [Combine Functions into Class](#combine-functions-into-class)
- [Combine Functions into Transform](#combine-functions-into-transform)
- [Split Phase](#split-phase)

---

## Extract Function
*formerly: Extract Method · inverse of: Inline Function*

**Does:** Pull a fragment of code into its own function named after its *intent*.

**When:** The dominant test is the separation of intention from implementation — if
you must pause to work out *what* a fragment does, extract it and name it after the
"what." Length and reuse are secondary; even a one-line body is worth extracting if
the name adds clarity. A comment that explains a block is a strong hint: the comment
often becomes the function name.

**When not to:** If you can't find a name more meaningful than the code itself, don't
extract. If extraction would require passing so many assigned-to locals that the result
is no clearer, abandon it and simplify variables first (Replace Temp with Query, Split
Variable).

**Mechanics:**
1. Create a new function; name it by intent (what, not how).
2. If the language supports nested functions, nest it inside the source function first —
   that minimizes the out-of-scope variables to handle. (Move Function later if needed.)
3. Copy the fragment into the new function.
4. Scan the copied code for variables local to the source that won't be in scope; pass
   them as parameters.
5. A variable used only inside the fragment but declared outside → move the declaration in.
6. A variable *assigned to* inside the fragment: if there's one, treat the fragment as a
   query and return its value. If there are too many assigned-to locals, abandon and apply
   Split Variable / Replace Temp with Query first, then retry.
7. Replace the original fragment with a call to the new function. Test.

**Companions:** Replace Temp with Query (02), Introduce Parameter Object, Split Variable (04).

---

## Inline Function
*inverse of: Extract Function*

**Does:** Replace calls to a function with its body, then delete the function.

**When:** The body is as clear as the name (needless indirection), or a group of badly
factored small functions should be inlined into one and re-extracted more sensibly, or a
tangle of pure delegation obscures the real work.

**When not to:** If you hit recursion, multiple return points, or inlining a method into
another object without accessors — these complications are a sign *not* to do this
refactoring.

**Mechanics:**
1. Check it isn't polymorphic (a method overridden in subclasses can't be inlined this way).
2. Find all callers.
3. Replace each call with the function's body. Test after each replacement. (Need not be
   done all at once — tricky callers can wait.)
4. Delete the function definition.

For an awkward multi-line inline, move one statement at a time with Move Statements to
Callers (03).

---

## Extract Variable
*formerly: Introduce Explaining Variable · inverse of: Inline Variable*

**Does:** Name a sub-expression with a local variable to explain it.

**When:** An expression is hard to read, or you want a named hook for debugging. If the
name is meaningful only inside this function, a variable is right; if it has broader
meaning, prefer a function (Extract Function) so the name is reusable.

**When not to:** If the name has wider applicability, a function is usually better than a
local. If the expression has side effects, do not extract it as a value (see step 1).

**Mechanics:**
1. Ensure the expression has no side effects.
2. Declare an immutable variable set to a copy of the expression.
3. Replace the original expression with the variable. Test.
4. If the expression recurs, replace each occurrence, testing after each.

---

## Inline Variable
*formerly: Inline Temp · inverse of: Extract Variable*

**Does:** Replace a variable with the expression it holds, then remove it.

**When:** The variable's name says no more than the expression itself, or the variable is
getting in the way of refactoring nearby code.

**Mechanics:**
1. Check the right-hand side of the assignment has no side effects.
2. If not already immutable, make it so and test (confirms single assignment).
3. Replace the first reference with the RHS expression. Test.
4. Repeat for each reference.
5. Remove the declaration and assignment. Test.

---

## Change Function Declaration
*aka: Rename Function · formerly: Rename Method / Add Parameter / Remove Parameter*

**Does:** Change a function's name or parameter list (and update callers).

**When:** A function name doesn't reveal intent (the most common, most valuable rename),
or the parameter list should gain/lose/restructure arguments. A good function name is
often found by writing the comment you'd use to describe it, then naming the function that.

**Mechanics — Simple** (use when you can change declaration + all callers in one go):
1. If removing a parameter, confirm it isn't referenced in the body.
2. Change the declaration to the desired form.
3. Find all references to the old declaration; update each. Test.
- Separate distinct changes (rename vs. add param) into separate steps. If trouble, revert
  and use migration mechanics.

**Mechanics — Migration** (many/awkward callers, polymorphic, or published API):
1. If needed, refactor the body to ease the next step.
2. Extract Function on the body to create the new function (give it a temporary searchable
   name if it'll share the old name; add any new params via simple mechanics). Test.
3. Apply Inline Function to the old function so callers route through the new one.
4. If you used a temporary name, Change Function Declaration again to restore it. Test.
- For a published API, pause after creating the new function: deprecate the old, let
  clients migrate, remove the old later.

---

## Encapsulate Variable
*formerly: Encapsulate Field / Self-Encapsulate Field*

**Does:** Route all access to a piece of data through getter/setter functions.

**When:** Data has wide reach (global, exported, mutable). Encapsulating gives a single
place to monitor and control access — the *first* move against Global Data and Mutable
Data, because you can't sensibly restructure data you can't observe being used.

**When not to:** For a variable with tiny scope (a couple of lines), the ceremony isn't
worth it.

**Mechanics:**
1. Create encapsulating functions to read and update the variable.
2. Run static checks.
3. Replace each reference with the appropriate function call. Test after each.
4. Restrict the variable's visibility. (If you can't fully hide it, rename it and test to
   flush out remaining references.)
5. Test. If the value is a record, consider Encapsulate Record (02).

---

## Rename Variable
**Does:** Give a variable a clearer name.

**When:** A name doesn't communicate purpose. Naming is one of the hard problems; a good
name saves future confusion. Difficulty finding a name can signal a deeper design issue.

**When not to:** A variable published to other code bases can't be freely renamed.

**Mechanics:**
1. If the variable is used widely, consider Encapsulate Variable first.
2. Find all references and change each.
- If it's immutable, you can copy to a new name and migrate references gradually, testing
  after each.
3. Test.

---

## Introduce Parameter Object
**Does:** Replace a recurring group of parameters with a single object.

**When:** The same clump of data items travel together through many signatures (Data
Clumps). Grouping them shrinks parameter lists, clarifies relationships, and gives a home
for behavior that belongs with that data (often surfacing Feature Envy you can then move in).

**Mechanics:**
1. If no suitable structure exists, create one (prefer a class — easier to add behavior;
   make it a value object). Test.
2. Use Change Function Declaration to add a parameter for the new structure. Test.
3. Adjust each caller to pass the correct instance. Test after each.
4. For each element, replace use of the original parameter with the structure's element,
   then remove that parameter. Test.

---

## Combine Functions into Class
**Does:** Group functions that operate on common data into a class, with the data as fields.

**When:** Several functions share the same data/arguments. A class captures the shared
data as fields, simplifies calls, and gives a place for related logic and derived values.

**Mechanics:**
1. Apply Encapsulate Record (02) to the shared data record. (If the shared data isn't yet
   a record, use Introduce Parameter Object to group it.)
2. Move each function that uses the record into the class via Move Function (03); drop
   arguments that are now members.
3. Extract logic that manipulates the data via Extract Function and move it in.

---

## Combine Functions into Transform
**Does:** Move a set of derivations into one transform function that enriches a record.

**When:** Several functions derive values from the same data and you want those
derivations computed and named in one place. (Choose a class via Combine Functions into
Class instead if the source data is updated — a transform risks stale copies.)

**Mechanics:**
1. Create a transform function that takes the record and returns it (usually a deep copy;
   add a test that the original record is unaltered).
2. Move one derivation's body into the transform as a new field; point client code at the
   new field. (Extract Function first if the logic is complex.) Test.
3. Repeat for the other derivations.

---

## Split Phase
**Does:** Separate code that does two different things into two sequential phases that
communicate through an intermediate data structure.

**When:** One block mixes two concerns (e.g., parsing then calculating; calculating then
formatting). Splitting lets each phase be understood and changed independently — a strong
remedy for Divergent Change.

**Mechanics:**
1. Extract the second-phase code into its own function. Test.
2. Introduce an intermediate data structure as an extra argument to that function. Test.
3. For each parameter of the second phase: if the first phase uses it, move it into the
   intermediate structure. Test after each. (If a parameter shouldn't be used by the
   second phase, extract each usage into a field of the intermediate structure and use
   Move Statements to Callers (03) on the populating line.)
4. Apply Extract Function on the first-phase code, returning the intermediate structure.
   (Reasonable to extract it into a transformer object.)
