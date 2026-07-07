# Catalog 07 — Dealing with Inheritance

Moving features up and down hierarchies, and swapping inheritance for delegation when it
stops fitting. These address Refused Bequest, Large Class, and misused inheritance. Test
after every numbered step unless noted; revert and shrink the step if tests break.

## Contents
- [Pull Up Method](#pull-up-method)
- [Pull Up Field](#pull-up-field)
- [Pull Up Constructor Body](#pull-up-constructor-body)
- [Push Down Method](#push-down-method)
- [Push Down Field](#push-down-field)
- [Replace Type Code with Subclasses](#replace-type-code-with-subclasses)
- [Remove Subclass](#remove-subclass)
- [Extract Superclass](#extract-superclass)
- [Collapse Hierarchy](#collapse-hierarchy)
- [Replace Subclass with Delegate](#replace-subclass-with-delegate)
- [Replace Superclass with Delegate](#replace-superclass-with-delegate)

---

## Pull Up Method
**Does:** Move a method shared by subclasses up to the superclass.

**When:** Subclasses have methods that do the same thing (Duplicated Code across siblings).

**Mechanics:**
1. Inspect the methods to ensure they're identical (refactor them until their bodies match
   if they merely do the same thing).
2. Check all calls/field references inside resolve to features callable from the superclass.
3. If signatures differ, Change Function Declaration (06) to align them.
4. Create the method in the superclass; copy one body over. Run static checks.
5. Delete one subclass method. Test.
6. Keep deleting subclass methods until all are gone.

---

## Pull Up Field
**Does:** Move a field common to subclasses up to the superclass.

**When:** Subclasses each declare an equivalent field (sometimes under different names).

**Mechanics:**
1. Inspect all users of the field to ensure consistent use.
2. If names differ, Rename Field (04) to unify them.
3. Create the field in the superclass (accessible to subclasses).
4. Delete the subclass fields. Test.

---

## Pull Up Constructor Body
**Does:** Move common subclass constructor code into the superclass constructor.

**When:** Subclass constructors share initialization. Constructors have ordering rules, so
they need a different approach than Pull Up Method.

**When not to:** If this gets messy, reach for Replace Constructor with Factory Function (06)
instead.

**Mechanics:**
1. Define a superclass constructor if none exists; ensure subclass constructors call it.
2. Slide Statements (03) to move common statements to just after the `super` call.
3. Remove the common code from each subclass and put it in the superclass; add any
   referenced parameters to the `super` call. Test.
4. For common code that can't move to the start, Extract Function (01) then Pull Up Method.

---

## Push Down Method
*inverse of: Pull Up Method*

**Does:** Move a superclass method down to the subclass(es) that use it.

**When:** A method is relevant to only some subclasses (Refused Bequest) — it doesn't belong
in the shared superclass.

**Mechanics:**
1. Copy the method into every subclass that needs it.
2. Remove it from the superclass. Test.
3. Remove it from each subclass that doesn't need it. Test.

---

## Push Down Field
*inverse of: Pull Up Field*

**Does:** Move a superclass field down to the subclass(es) that use it.

**When:** A field is used by only one or a few subclasses (Refused Bequest, Temporary Field).

**Mechanics:**
1. Declare the field in all subclasses that need it.
2. Remove it from the superclass. Test.
3. Remove it from subclasses that don't need it. Test.

---

## Replace Type Code with Subclasses
*subsumes: Replace Type Code with State/Strategy, Extract Subclass · inverse of: Remove Subclass*

**Does:** Replace a type-code field with subclasses keyed to each code value.

**When:** A type code drives conditional behavior (enables Replace Conditional with
Polymorphism), or some fields/methods are only valid for certain codes (enables Push Down
Field). Subclasses make those relationships explicit (Primitive Obsession, Repeated Switches).

**Choice:** Subclass the class directly (simpler) only if you don't also need the hierarchy
for something else and the type is *immutable*; otherwise apply Replace Primitive with
Object (02) to the type code first and subclass that type object.

**Mechanics:**
1. Self-encapsulate the type code field.
2. Pick one code value; create a subclass for it; override the type-code getter to return
   that literal.
3. Create selector logic mapping the code to the new subclass. (Direct inheritance: use
   Replace Constructor with Factory Function (06), selector in the factory. Indirect: selector
   may stay in the constructor.) Test.
4. Repeat for each code value, adding to the selector. Test after each.
5. Remove the type-code field. Test.
6. Use Push Down Method and Replace Conditional with Polymorphism (05) on methods using the
   type-code accessors; once all are replaced, remove the accessors.

---

## Remove Subclass
*formerly: Replace Subclass with Fields · inverse of: Replace Type Code with Subclasses*

**Does:** Fold a subclass that no longer earns its place back into its superclass as a field.

**When:** A subclass has so little distinct behavior it isn't worth the indirection (Lazy
Element) — a field on the parent captures the difference.

**Mechanics:**
1. Replace Constructor with Factory Function (06) on the subclass constructor. (If clients
   use a data field to pick the subclass, put that decision in a superclass factory method.)
2. If any code tests against the subclass type, Extract Function (01) on the test and Move
   Function (03) it to the superclass. Test after each.
3. Create a field representing the subclass type.
4. Change methods that refer to the subclass to use the new field.
5. Delete the subclass. Test.
- For a group of subclasses, encapsulate them all first (factory, moved type tests), then
  fold them in one at a time.

---

## Extract Superclass
**Does:** Create a shared superclass for two classes with common features.

**When:** Two classes do similar things (Duplicated Code, Alternative Classes with Different
Interfaces). A superclass houses the commonality. (This is often interchangeable
with Extract Class + delegation — pick inheritance when the relationship is genuinely "is a
kind of.")

**Mechanics:**
1. Create an empty superclass; make the originals its subclasses. (Change Function
   Declaration (06) on constructors if needed.) Test.
2. One by one, use Pull Up Constructor Body, Pull Up Method, Pull Up Field to move common
   elements up.
3. Examine remaining subclass methods for common parts; Extract Function (01) then Pull Up
   Method.
4. Review clients of the original classes; consider switching them to the superclass interface.

---

## Collapse Hierarchy
**Does:** Merge a superclass and subclass when they're no longer different enough.

**When:** After refactoring, a class and its parent/child have grown so similar the
distinction adds no value (Lazy Element, Speculative Generality).

**Mechanics:**
1. Choose which class to remove (keep the name that reads best long-term).
2. Use Pull Up / Push Down Field and Method to move all elements into the single class.
3. Adjust references to the removed class to point at the surviving one.
4. Remove the empty class. Test.

---

## Replace Subclass with Delegate
**Does:** Replace a subclass with a delegate object held by the (former) superclass.

**When:** Inheritance is the wrong tool — you can only inherit once, subclasses are rigid,
and the variation is better modeled as a relationship (Refused Bequest, Insider Trading).
Delegation is more flexible, especially when the "type" can change at runtime.

**Mechanics:**
1. If constructors have many callers, Replace Constructor with Factory Function (06).
2. Create an empty delegate class; its constructor takes subclass-specific data and usually a
   back-reference to the superclass.
3. Add a field on the superclass to hold the delegate.
4. Modify subclass creation to initialize the delegate field (in the factory, or constructor
   if it can reliably choose the delegate).
5. Pick a subclass method; Move Function (03) it to the delegate, keeping the source's
   delegating code. (Move needed elements too; for elements that must stay in the superclass,
   give the delegate a back-reference field.)
6. If the source method has outside callers, move the delegating code from subclass to
   superclass, guarded by a check for the delegate's presence; otherwise Remove Dead Code (03).
   (If multiple subclasses start duplicating, Extract Superclass on the delegates.) Test.
7. Repeat until all subclass methods are moved.
8. Change all callers of the subclass constructor to use the superclass constructor. Test.
9. Remove Dead Code (03) on the subclass.

---

## Replace Superclass with Delegate
*formerly: Replace Inheritance with Delegation*

**Does:** Replace inheritance from a superclass with delegation to it.

**When:** A subclass uses only part of the superclass, or shouldn't honor its full interface
(Refused Bequest). The classic test: is the subclass really "a kind of" the superclass, or
just borrowing its implementation? If the latter, delegate.

**Mechanics:**
1. Create a field in the subclass referring to a new instance of the (former) superclass.
2. For each superclass element, create a forwarding function in the subclass that delegates
   to the field. Test after each consistent group (e.g., get/set pairs only test once both
   exist).
3. When all superclass elements are forwarded, remove the inheritance link.
