# Catalog 02 — Encapsulation

Controlling what each part of a program can see and touch. These hide data structures
behind interfaces so you can change internals safely. Test after every numbered step
unless noted; revert and shrink the step if tests break.

## Contents
- [Encapsulate Record](#encapsulate-record)
- [Encapsulate Collection](#encapsulate-collection)
- [Replace Primitive with Object](#replace-primitive-with-object)
- [Replace Temp with Query](#replace-temp-with-query)
- [Extract Class](#extract-class)
- [Inline Class](#inline-class)
- [Hide Delegate](#hide-delegate)
- [Remove Middle Man](#remove-middle-man)
- [Substitute Algorithm](#substitute-algorithm)

---

## Encapsulate Record
*formerly: Replace Record with Data Class*

**Does:** Replace a bare record/data structure with a class exposing accessors.

**When:** A mutable record is used widely. A class lets you hide which values are stored
vs. derived and gives a place to control updates — the immediate fix for a public-field
Data Class.

**When not to:** An immutable record used as a result of a computation (e.g., the output of
Split Phase) doesn't need this — immutable data is safe to expose directly.

**Mechanics:**
1. Encapsulate Variable (01) on the variable holding the record; give the accessors easily
   searchable names.
2. Replace the variable's content with a simple class that wraps the record; add an
   accessor returning the raw record and make the encapsulating functions use it. Test.
3. Add new functions that return the object rather than the raw record.
4. For each user, replace use of the raw-record function with the object-returning one,
   reading fields via accessors (create them as needed). Test after each. (For complex/
   nested records, do updating clients first; give read-only clients a copy or read-only
   proxy.)
5. Remove the raw-data accessor and the searchable raw-record functions. Test.
6. If fields are themselves structures, apply Encapsulate Record / Encapsulate Collection
   recursively.

---

## Encapsulate Collection
**Does:** Wrap access to a collection so callers can't mutate it directly.

**When:** A class exposes a collection field; callers modifying it directly bypass the
owner's ability to track changes (a Mutable Data hazard).

**Mechanics:**
1. Encapsulate Variable (01) on the collection reference if not already done.
2. Add functions to add and remove elements.
3. If there's a setter, Remove Setting Method (06) if possible; otherwise make it copy the
   provided collection. Run static checks.
4. Find all references; where callers mutate the collection, switch them to the add/remove
   functions. Test after each.
5. Change the getter to return a protected view (read-only proxy or copy). Test.

---

## Replace Primitive with Object
*formerly: Replace Data Value with Object / Replace Type Code with Class*

**Does:** Turn a primitive carrying domain meaning into its own small class.

**When:** A string/number is doing the work of a domain concept (money, phone number,
range, temperature with units) — the Primitive Obsession smell. A real type centralizes
display, validation, and behavior.

**Mechanics:**
1. Encapsulate Variable (01) if not already.
2. Create a simple value class taking the existing value in its constructor and providing
   a getter. Run static checks.
3. Change the setter to store a new instance of the value class (adjust the field type).
4. Change the getter to return the value class's getter result. Test.
5. Consider Rename Function (06) on the accessors to better reflect their meaning.
6. Consider Change Reference to Value (04) or Change Value to Reference (04) to clarify the
   new object's role.

---

## Replace Temp with Query
**Does:** Replace a temporary variable with a method that recomputes its value.

**When:** A temp names the result of an expression and you want that name reusable beyond
the current function, or the temp is blocking an Extract Function. Turning it into a query
removes a local that complicates extraction. Works best inside a class.

**When not to:** Only when the variable is computed once and the computation is repeatable
without side effects (see steps 1 and 3).

**Mechanics:**
1. Check the variable is fully determined before use and yields the same value each time.
2. If it can be made read-only, do so. Test.
3. Extract the assignment into a function (temporary name if it can't share the variable's
   name). Ensure the function is side-effect-free; if not, apply Separate Query from
   Modifier (06). Test.
4. Inline Variable (01) to remove the temp.

---

## Extract Class
*inverse of: Inline Class*

**Does:** Split one class into two when it has grown to hold separable responsibilities.

**When:** A class has too many fields/methods or changes for multiple reasons (Large
Class, Divergent Change, Temporary Field, Data Clumps). Look for subsets of data/behavior
that vary together, or common field name prefixes.

**Mechanics:**
1. Decide how to split responsibilities.
2. Create a new child class for the split-off responsibilities. (Rename the parent if its
   name no longer fits.)
3. Instantiate the child when constructing the parent; link parent → child.
4. Move Field (03) for each field to move. Test after each.
5. Move Function (03) for methods, starting with lower-level (callee) ones. Test after each.
6. Review both interfaces; drop unneeded methods, rename to fit.
7. Decide whether to expose the child; if so consider Change Reference to Value (04).

---

## Inline Class
*inverse of: Extract Class*

**Does:** Fold a class that no longer earns its keep back into another.

**When:** A class has been shrunk by refactoring until it does too little (Lazy Element),
or two classes' responsibilities should be merged before re-splitting differently.

**Mechanics:**
1. In the target class, create functions for all public functions of the source class;
   each just delegates to the source.
2. Change all references to source methods to use the target's delegators. Test after each.
3. Move all functions and data from source into target, testing after each, until source
   is empty.
4. Delete the source class.

---

## Hide Delegate
*inverse of: Remove Middle Man*

**Does:** Add a method to a server object so clients don't navigate to its delegate.

**When:** Clients chain through an object to reach another (Message Chains), coupling them
to the navigation structure. A delegating method on the server decouples them.

**Mechanics:**
1. For each method on the delegate, create a delegating method on the server.
2. Adjust clients to call the server. Test after each change.
3. If no client needs the delegate anymore, remove the server's accessor for it. Test.

---

## Remove Middle Man
*inverse of: Hide Delegate*

**Does:** Let clients call the delegate directly when a server does little but forward.

**When:** A class has become a Middle Man — too many methods that just delegate onward. The
forwarding is now more burden than benefit.

**Mechanics:**
1. Create a getter for the delegate.
2. For each client use of a delegating method, replace it by chaining through the accessor.
   Test after each.
3. When a delegating method has no remaining callers, delete it.
- With automated tools: Encapsulate Variable (01) on the delegate field, then Inline
  Function (01) on the delegating methods.

---

## Substitute Algorithm
**Does:** Replace the body of a function with a clearer algorithm producing the same result.

**When:** You see a simpler way to do what a function does. Easier to swap a whole clear
algorithm than to tease an existing one toward the new shape.

**When not to:** Only swap when you can capture the current behavior in tests first; if the
function isn't cleanly isolated, restructure it into one complete function before substituting.

**Mechanics:**
1. Arrange the code to be replaced so it fills a complete function.
2. Prepare tests using this function only, capturing its behavior.
3. Prepare the alternative algorithm. Run static checks.
4. Run tests comparing old vs. new output. If identical, done; otherwise keep the old
   algorithm as a reference for testing and debugging.
