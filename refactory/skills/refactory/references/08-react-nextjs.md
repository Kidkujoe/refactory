# Catalog 08 — React / Next.js

The language is JavaScript/TypeScript, so the whole base catalog applies inside component
and hook bodies. This file adds the framework-specific layer: React-shaped versions of
familiar refactorings, smells that only exist in React/Next, and — most importantly — how
to establish a safety net when components and server code resist plain unit tests.

This reflects current Next.js conventions (App Router default; Server Components by
default with `'use client'` only where you need state, effects, event handlers, or
browser APIs; `params`/`searchParams` are Promises in recent versions). Conventions move
quickly here — verify against the project's installed version rather than assuming.

## Contents
- [Safety net in React/Next (read first)](#safety-net-first)
- [React/Next smell → fix lookup](#smell-lookup)
- [Extract Component](#extract-component)
- [Extract Custom Hook](#extract-custom-hook)
- [Lift State Up](#lift-state-up)
- [Replace Derived State with Computed Value](#replace-derived-state-with-computed-value)
- [Move Client Boundary Down](#move-client-boundary-down)

---

<a name="safety-net-first"></a>
## Safety net in React/Next (read first)

The base discipline (rule 3: a net before you touch anything) is unchanged, but the
*route* to a net differs by layer:

- **Pure functions and hooks** — the easy case. If the logic is in (or can be pulled into)
  a plain function or a custom hook, test it directly: a unit test for a function, a
  hook-testing utility for a hook. This is why **extracting logic out of a component is
  often the first refactoring** — it converts untestable JSX-bound logic into testable
  units. Pin behavior there, then restructure.
- **Client components with interaction** — test rendered behavior with a component-testing
  library (React Testing Library + Jest/Vitest): render, assert on what the user sees,
  fire events, assert again. Lean on the TypeScript compiler as a second oracle.
- **Server Components, routes, server actions** — these often *cannot* be unit-tested
  meaningfully (async server components, request context, data fetching). Use end-to-end
  tests (e.g., Playwright) against a running route to pin behavior, or extract the pure
  data-shaping logic into a tested function and keep the server component a thin shell.
- **No feasible test** — fall back to rule 3's last branch: smallest, most mechanical
  refactorings only (rename, extract), TypeScript as the primary guard, and make the
  thinness of the net explicit to the user.

The recurring tactic: **push logic out of hard-to-test surfaces into easy-to-test ones**
(Split Phase / Extract Function / Extract Custom Hook), test there, then refactor.

---

<a name="smell-lookup"></a>
## React/Next smell → fix lookup

| Smell | What it looks like | Fix |
|-------|--------------------|-----|
| Derived state in state | A `useState` whose value is computed from props/other state and kept in sync with `useEffect` | Replace Derived State with Computed Value |
| God component | One component handling fetching, state, business logic, and a large render | Extract Component, Extract Custom Hook, Split Phase (01) |
| Prop drilling | A prop threaded through many layers that don't use it | Lift State Up / colocate state, or context (judgment — see below) |
| Effect overuse | `useEffect` doing work that belongs in render or in an event handler | Replace Derived State with Computed Value; move work to the handler |
| Mixed concerns in render | Data transformation tangled with JSX | Split Phase (01): shape data above, render below |
| Misplaced client boundary | `'use client'` high in the tree, pulling subtrees needlessly into the client bundle | Move Client Boundary Down |
| Boolean/variant prop | `<Button primary />` style flags switching behavior | Remove Flag Argument (06) → distinct components |
| Duplicated components | Near-identical components differing by a literal | Parameterize Function (06) applied to components/props |
| Long parameter / prop list | Many individually-passed related props | Introduce Parameter Object (01) / Preserve Whole Object (06) |
| Mysterious names | `data`, `item`, `handleClick2` | Rename Variable (04) / Change Function Declaration (06) |

### Judgment notes (don't over-apply)
- **Prop drilling isn't always bad.** A prop passed through two layers is fine; reach for
  context or state colocation only when the threading is genuinely painful. Context has
  its own costs (re-render coupling, harder testing) — it's not a free win.
- **Not every `useEffect` is a smell.** Effects for genuine synchronization with external
  systems (subscriptions, the DOM, network) are correct. The smell is using an effect to
  compute a value that could be derived during render.
- **A small component doing one job is good, not a Lazy Element.** Don't inline components
  just because they're short.

---

<a name="extract-component"></a>
## Extract Component
*React-specific form of Extract Function (01)*

**Does:** Pull a section of JSX (with its related logic) into its own component.

**When:** A component's render is long, or a chunk of it is a self-contained unit with its
own concern (a God component). The test, as with Extract Function, is intent vs.
implementation: if you have to read the JSX to work out what a block *is*, name it.

**When not to:** Don't extract a block that shares so much mutable state with its
surroundings that you'd pass a dozen props and callbacks back and forth — that's the
"too many assigned-to locals" signal from Extract Function. Reconsider the state shape first.

**Mechanics:**
1. Identify the JSX block and the props it needs (the values it reads from the parent's
   scope).
2. Create the new component taking those as props; name it by intent.
3. Move the JSX in; pass the identified values as props (callbacks for events).
4. Replace the original block with the new component. Test (render test / TS compile).

---

<a name="extract-custom-hook"></a>
## Extract Custom Hook
*React-specific form of Extract Function (01), for stateful logic*

**Does:** Move stateful logic (state, effects, derived values) out of a component into a
reusable `useXxx` hook.

**When:** A component mixes substantial stateful logic with rendering, or the same logic
recurs across components (Duplicated Code). A hook isolates the logic, makes it
unit-testable on its own, and shrinks the component to mostly rendering.

**Mechanics:**
1. Identify the cohesive state + effects + handlers to move.
2. Create a `useXxx` function; move that logic in; return what the component needs.
3. Replace the component's inline logic with a call to the hook.
4. Test the hook directly (hook-testing utility) and the component's render. TS compile.

---

<a name="lift-state-up"></a>
## Lift State Up
**Does:** Move state to the closest common ancestor of the components that need it.

**When:** Two sibling components need to share or stay in sync over the same state, or state
lives too low to coordinate. (The inverse — pushing state *down* / colocating it — fixes the
opposite smell, state held higher than necessary, which causes excess re-renders.)

**When not to:** Don't lift state so far up that distant components re-render needlessly;
lift only to the nearest common owner. If lifting would create deep prop drilling,
consider whether the state belongs in context instead — but weigh context's costs.

**Mechanics:**
1. Identify the nearest common ancestor of the components that need the state.
2. Move the `useState` there.
3. Pass the value down as a prop and a setter/handler down as a callback.
4. Remove the now-redundant local state from the children. Test.

---

<a name="replace-derived-state-with-computed-value"></a>
## Replace Derived State with Computed Value
*React-specific form of Replace Derived Variable with Query (04)*

**Does:** Remove a piece of state that mirrors a value computable from props/other state,
computing it during render instead.

**When:** You see `useState` paired with a `useEffect` that resets it whenever inputs
change. This is the most common React state bug — the stored copy goes stale or causes an
extra render. Computing during render makes staleness impossible.

**When not to:** If the computation is genuinely expensive *and* profiling shows it
matters, memoize it (`useMemo`) rather than storing it in state — but measure first; don't
reach for `useMemo` speculatively (that's the performance guardrail from the main skill).

**Mechanics:**
1. Identify the state variable and the effect that keeps it in sync.
2. Replace the state with a value computed during render from the source inputs.
3. Remove the `useState` and the synchronizing `useEffect`. Test.
4. Only if measured-slow: wrap the computation in `useMemo`.

---

<a name="move-client-boundary-down"></a>
## Move Client Boundary Down
*Next.js App Router specific*

**Does:** Push `'use client'` from a high-level component down to the smallest subtree that
actually needs client-side interactivity.

**When:** A `'use client'` directive sits near the top of a tree, forcing everything below
it to ship as client JavaScript even though most of it is static. Server Components are the
default; the client boundary should be as close to the interactive leaves as possible to
keep the client bundle small and preserve server rendering.

**When not to:** Don't fragment a genuinely interactive subtree into awkward pieces just to
shave a few bytes — keep the boundary where the interactivity genuinely begins.

**Mechanics:**
1. Identify which parts of the subtree actually need client features (state, effects,
   handlers, browser APIs).
2. Extract those interactive parts into their own component(s) marked `'use client'`
   (this is Extract Component).
3. Remove `'use client'` from the parent so it returns to being a Server Component.
4. Pass server-fetched data into the client components as props; keep the boundary at the
   leaves. Test (E2E for the route; TS compile). Confirm the interactive behavior still works.

## Building a behavior net for an App-Router page (the common "no render-test net" case)

App-Router page components usually have *no* behavior net — and source-text grep tests don't
count (they assert the file contains a string; they false-fail on renames and pass through
real breakage). When option A (write a net first) is chosen, this is the jsdom + Testing
Library recipe for a client page component, assembled so you don't rediscover it each time:

- **Per-file environment.** Add `// @vitest-environment jsdom` at the top of the test file
  (or set it in config) so the component can render without a browser.
- **Mock the data layer at the module boundary.** Page components pull from stores, server
  actions, and the router. Mock each: the store hooks (return fixture data), the server
  actions (resolve/reject so you can test both success and failure/rollback paths), and
  `next/navigation` (`useRouter`, `useSearchParams`, `usePathname`).
- **Seed every store the selectors reach — transitively.** A page may name 4 stores at the
  call site while its selectors internally read 7 (e.g. it also needs trips/clients/team).
  Missing ones silently zero out derived values and every test fails confusingly. Walk the
  selectors and seed all of them.
- **Test behavior, not structure.** Assert what the user sees / what gets called (rendered
  rows, the action invoked with the right args, the rollback on a rejected action) — never
  that the source contains a string.
- **What this net does and doesn't cover.** jsdom render tests catch logic/state/render
  regressions. They do *not* catch real-browser behavior — drag-and-drop, scroll, animation,
  actual network. Those HIGH-risk surfaces need a Playwright net, which is heavier; that's
  usually why they're deferred (option D) rather than netted in the same pass.

For the test-only-route harness pattern (private segment, `force-dynamic` to avoid static
prerender leaks, the `_`-prefix-excludes-routing gotcha, dev-server reuse), see a
framework-specific harness note if present; those are Next.js routing specifics, not core
refactoring discipline.
