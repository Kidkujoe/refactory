# Code Smells — The Trigger Table

A smell is a surface symptom that *often* (not always) points to a refactoring worth
doing. Smells are heuristics for human-style judgment, not metrics: there is no
threshold that makes a function "too long." Use them as prompts to look closer,
then decide. When you spot one while reading or editing code, name it, then consult
the suggested refactorings (with their catalog file) before transforming.

The fix column lists refactorings by name; find their mechanics in the catalog files
noted in parentheses after the first mention. Catalog files live in this directory:
`01-basic.md`, `02-encapsulation.md`, `03-moving-features.md`, `04-organizing-data.md`,
`05-conditionals.md`, `06-apis.md`, `07-inheritance.md`.

## Band the risk first (the primary navigation axis)

Before picking a move, classify the *code surface* you're in by risk — this is the axis that
actually drives the decision (net rigor, defer-vs-do), more than which smell it is or whether
it's frontend/backend. Risk attaches to the **surface, not the smell**: a Long Function is
low-risk in pure-render code and high-risk in an optimistic-mutation path, so band the code,
then use the table below to pick the move.

- **HIGH** — optimistic mutations with rollback, state machines, write queues, async/timer
  sequences, drag-and-drop, WebSockets. Silent-corruption surface. Never refactor netless;
  often defer (option C/D) unless a real behavior net exists.
- **MEDIUM** — derived URL/query state, selection pruning, subtle effect/timing ordering.
  Refactor with care and a net for the affected behavior.
- **LOW** — pure render, read-only data, pure transformation pipelines. Safe to extract; a
  cheap pure-function unit net usually suffices (see "cheapest net first" in the skill).

(A frontend/backend tag was considered and set aside: in practice the slice is obvious from
the file path and didn't aid navigation, whereas the risk band has to be derived every time.
If backend-heavy use later shows a slice tag helps, revisit it then — don't assume from
frontend-only evidence.)

## Quick lookup

| # | Smell | What it looks like | Primary fixes |
|---|-------|--------------------|---------------|
| 1 | Mysterious Name | A name that doesn't say what the thing is/does | Change Function Declaration (06), Rename Variable (04), Rename Field (04) |
| 2 | Duplicated Code | Same/similar structure in more than one place | Extract Function (01), Slide Statements (03), Pull Up Method (07) |
| 3 | Long Function | A function you must scroll or pause to understand | Extract Function (01), Replace Temp with Query (02), Introduce Parameter Object (01), Preserve Whole Object (06), Replace Function with Command (06), Decompose Conditional (05), Replace Conditional with Polymorphism (05), Split Loop (03) |
| 4 | Long Parameter List | Many params, or params derivable from each other | Replace Parameter with Query (06), Preserve Whole Object (06), Introduce Parameter Object (01), Remove Flag Argument (06), Combine Functions into Class (01) |
| 5 | Global Data | State mutable from anywhere, no access trail | Encapsulate Variable (01) |
| 6 | Mutable Data | Updates cause spooky action at a distance | Encapsulate Variable (01), Split Variable (04), Slide Statements (03), Extract Function (01), Separate Query from Modifier (06), Remove Setting Method (06), Replace Derived Variable with Query (04), Combine Functions into Class/Transform (01), Change Reference to Value (04) |
| 7 | Divergent Change | One module changed for many unrelated reasons | Split Phase (01), Move Function (03), Extract Function (01), Extract Class (02) |
| 8 | Shotgun Surgery | One change forces edits scattered across modules | Move Function (03), Move Field (03), Combine Functions into Class/Transform (01), Inline Function/Class (01/02) |
| 9 | Feature Envy | A function more interested in another module's data | Move Function (03), Extract Function (01) |
| 10 | Data Clumps | Same group of data items travel together everywhere | Extract Class (02), Introduce Parameter Object (01), Preserve Whole Object (06) |
| 11 | Primitive Obsession | Strings/numbers used where a domain type belongs | Replace Primitive with Object (02), Replace Type Code with Subclasses (07), Replace Conditional with Polymorphism (05), Extract Class (02), Introduce Parameter Object (01) |
| 12 | Repeated Switches | Same switch/if-cascade duplicated in many places | Replace Conditional with Polymorphism (05) |
| 13 | Loops | Imperative loops obscuring what's selected/transformed | Replace Loop with Pipeline (03) |
| 14 | Lazy Element | A class/function not pulling its weight | Inline Function (01), Inline Class (02), Collapse Hierarchy (07) |
| 15 | Speculative Generality | Hooks/abstraction for needs that never arrived | Collapse Hierarchy (07), Inline Function/Class (01/02), Change Function Declaration (06), Remove Dead Code (03) |
| 16 | Temporary Field | A field set only in some circumstances | Extract Class (02), Move Function (03), Introduce Special Case (05) |
| 17 | Message Chains | client.a().b().c() coupling client to navigation | Hide Delegate (02), Extract Function (01), Move Function (03) |
| 18 | Middle Man | A class that mostly just delegates onward | Remove Middle Man (02), Inline Function (01), Replace Superclass/Subclass with Delegate (07) |
| 19 | Insider Trading | Modules trading too much private data | Move Function (03), Move Field (03), Hide Delegate (02), Replace Subclass/Superclass with Delegate (07) |
| 20 | Large Class | A class doing too much; too many fields/methods | Extract Class (02), Extract Superclass (07), Replace Type Code with Subclasses (07) |
| 21 | Alternative Classes w/ Different Interfaces | Interchangeable-in-spirit classes with mismatched APIs | Change Function Declaration (06), Move Function (03), Extract Superclass (07) |
| 22 | Data Class | Fields + getters/setters and nothing else | Encapsulate Record (02), Remove Setting Method (06), Move Function (03), Extract Function (01) |
| 23 | Refused Bequest | Subclass ignores most of what it inherits | Push Down Method (07), Push Down Field (07), Replace Subclass/Superclass with Delegate (07) |
| 24 | Comments | Comments compensating for unclear code | Extract Function (01), Change Function Declaration (06), Introduce Assertion (05) |

## Notes on judgment (when NOT to act)

- **Comments are not always a smell.** Comments that explain *why* (intent, a non-obvious
  constraint, a link to a decision) are valuable. Only comments that paper over code that
  could *say it itself* are the smell. Don't strip explanatory comments.
- **Repeated Switches / conditionals** are not automatically wrong. A single switch is
  usually fine. The smell is the *same* switch duplicated. Don't polymorphize a one-off.
- **Data Class** is legitimate as an immutable result record (e.g., the output of a
  Split Phase). Immutable data holders don't need encapsulation or behavior moved in.
- **Refused Bequest** is only mildly smelly when subclassing for implementation reuse;
  it screams only when the subclass also *refuses the interface* (won't honor the
  superclass contract). Use judgment before restructuring a hierarchy.
- **Speculative Generality** — confirm it's actually unused before deleting. If the only
  callers are tests, that confirms it; delete tests and the dead code.

## How to use this while coding (proactive mode)

1. As you read or edit code, keep this table in the back of your mind.
2. When something matches, *name the smell out loud* to the user — naming builds shared
   vocabulary and makes the suggestion concrete ("this looks like Feature Envy:
   `calculateTax` reaches into `order` for five fields").
3. Point to the candidate refactoring(s), but do not transform without a green test
   suite and (per the skill's workflow) user assent. Flagging is cheap; transforming
   silently is not.
