# Form Builder & Renderer — Test Cases

Test-case catalog for the "rock solid" hardening of the form builder
([FormBuilderPage.tsx](../src/pages/Forms/FormBuilderPage.tsx)) and renderer
([FormRenderer.tsx](../src/components/formBuilder/FormRenderer.tsx)).

Two layers:

1. **Unit tests** — already automated with vitest (`npm test`). Pure logic in
   [formSchema.ts](../src/lib/formSchema.ts) and [expression.ts](../src/lib/expression.ts).
2. **E2E tests** — behavior in the running app. Documented here as manual cases
   now; **Playwright automation is deferred to the end of the product** and will
   map 1:1 to the `E2E-*` ids below.

| Tier | Theme | Unit ids | E2E ids |
|------|-------|----------|---------|
| A | Data integrity (keys, grid payload) | UT-KEY-\*, UT-NORM-\* | E2E-A-\* |
| B | Runtime correctness (calc, grid, clearOnHide) | UT-EXPR-EVAL-\* | E2E-B-\* |
| C | Schema robustness (repair on load) | UT-REPAIR-\* | E2E-C-\* |
| D | Builder UX (problems, gating, expr, leave-guard) | UT-VALID-\*, UT-EXPR-\* | E2E-D-\* |
| E | Accessibility | — | E2E-E-\* |

Statuses: ✅ automated · ⬜ manual (pending Playwright).

---

## Preconditions (shared, for all E2E cases)

- **PRE-1** Signed in to https://consdev.lukeflow.com/ with a user holding the
  **FORMS read-write** capability in an active tenant.
- **PRE-2** A scratch form exists (or create one) and is open in the builder at
  `/forms/:id`.
- **PRE-3** "Preview" opens the live renderer in a modal; "Check in" / "Publish"
  appear in the toolbar for read-write users.

---

## Layer 1 — Unit tests (✅ automated)

Run: `npm test`. 35 cases across two files. Listed here for traceability.

### formSchema.test.ts

| Id | Case | Expect |
|----|------|--------|
| UT-KEY-01 | `isValidKey` accepts `email`, `emailAddress`, `_private`, `field2` | true |
| UT-KEY-02 | `isValidKey` rejects spaces, leading digit, punctuation, reserved words, non-string | false |
| UT-KEY-03 | `sanitizeKey` preserves already-valid keys verbatim | unchanged |
| UT-KEY-04 | `sanitizeKey` camelCases `"First Name"` → `firstName` | ok |
| UT-KEY-05 | `sanitizeKey` prefixes leading-digit results so they're valid | valid |
| UT-KEY-06 | `sanitizeKey` falls back to `field` for empty/garbage/null | `field` |
| UT-KEY-07 | `sanitizeKey` escapes reserved words (`true` → `trueField`) | ok |
| UT-KEY-08 | `uniqueKey` returns base when free | base |
| UT-KEY-09 | `uniqueKey` suffixes incrementally on collision, starting at 1 | `email1`, `email2` |
| UT-KEY-10 | `duplicateKeyIds` flags later field reusing an earlier key | only 2nd id |
| UT-KEY-11 | `duplicateKeyIds` detects collisions across nested containers | size 1 |
| UT-KEY-12 | `isAutoKey` treats label base + base-with-digits as auto | true |
| UT-KEY-13 | `isAutoKey` treats a diverged/manual key as not-auto | false |
| UT-KEY-14 | `isAutoKey` treats empty key as auto | true |
| UT-NORM-01 | `normalizeKeys` preserves valid unique, dedupes collisions | no dupes |
| UT-NORM-02 | `normalizeKeys` does not mutate input | input unchanged |
| UT-NORM-03 | `normalizeKeys` is idempotent | second pass equal |
| UT-NORM-04 | `normalizeKeys` leaves unkeyed (layout) entities alone | no key added |
| UT-NORM-05 | `normalizeKeys` derives key from label when missing | from label |
| UT-VALID-01 | `validateSchema` clean schema → no problems | `[]` |
| UT-VALID-02 | `validateSchema` malformed input → `malformed-schema` | error |
| UT-VALID-03 | `validateSchema` dangling root + child refs | both codes |
| UT-VALID-04 | `validateSchema` duplicate + invalid keys → errors | blocking |
| UT-VALID-05 | `validateSchema` detects container cycle, no infinite loop | `cycle` |
| UT-VALID-06 | `validateSchema` warns about orphaned entities | `orphan` warning |
| UT-REPAIR-01 | `repairSchema` leaves sound schema unchanged, sets parentId | no removed |
| UT-REPAIR-02 | `repairSchema` drops dangling root + child refs | filtered |
| UT-REPAIR-03 | `repairSchema` breaks cycles → valid schema | no `cycle` |
| UT-REPAIR-04 | `repairSchema` removes + reports unreachable entities | `removed` listed |
| UT-REPAIR-05 | `repairSchema` severs child claimed by two parents | single parent |
| UT-REPAIR-06 | `repairSchema` does not mutate input | input unchanged |

### expression.test.ts

| Id | Case | Expect |
|----|------|--------|
| UT-EXPR-01 | `analyzeExpression` empty/undefined/whitespace → ok | null |
| UT-EXPR-02 | valid expr referencing known fields → ok | null |
| UT-EXPR-03 | syntax errors flagged | `/syntax/i` |
| UT-EXPR-04 | references to unknown fields flagged with name | `/unknown field/i`, name |
| UT-EXPR-05 | multiple unknown fields → plural message | `/fields/i` |
| UT-EXPR-EVAL-01 | `evaluateExpression` arithmetic against scope | `3*4=12` |
| UT-EXPR-EVAL-02 | `evaluateCondition` defaults to show on bad/empty condition | true |

---

## Layer 2 — E2E test cases (⬜ pending Playwright)

### Tier A — Data integrity

**E2E-A-01 — Duplicate key shows inline error** · P0
1. Add two Text fields.
2. Open the 2nd field's settings → Property Name (key) → enter the 1st field's key (e.g. `email`).

✅ Inline error under the key input: *"Duplicate key 'email' — already used by another field."*

**E2E-A-02 — Invalid key (identifier) shows inline error** · P0
1. Open a field's settings → key → enter `first name` (space).

✅ Inline error: *"Use letters, numbers and underscores only (must start with a letter)."*
2. Try `2cool`, `price-total` → same error each time.

**E2E-A-03 — Resolving a duplicate clears the error** · P1
1. From E2E-A-01, change the 2nd field's key to a unique value.

✅ Both the inline error and the toolbar Problems pill clear.

**E2E-A-04 — Delete resolving a duplicate re-evaluates** · P1
1. Create a duplicate (E2E-A-01), then delete one of the two fields.

✅ The remaining field's key error clears (no stale error).

**E2E-A-05 — New field auto-gets a unique key** · P1
1. Add three Text fields without editing keys.

✅ Keys are `textField`, `textField1`, `textField2` (no collisions, no errors).

**E2E-A-08 — Key auto-derives from label (camelCase)** · P0
1. Add a Text field. In its settings, set the **Label** to `First Name`.

✅ The **key** updates live to `firstName` as you type. Change the label to
`Email Address` → key becomes `emailAddress`.

**E2E-A-09 — Duplicate labels suffix the key** · P0
1. Add two fields, both labelled `First Name`.

✅ First field key = `firstName`, second = `firstName1` (then `firstName2`, …).

**E2E-A-10 — Manual key edit locks (stops following label)** · P0
1. Field labelled `First Name` (key `firstName`). Edit the **key** directly to
   `applicantName`.
2. Now change the **label** to `Full Name`.

✅ The key stays `applicantName` — it no longer follows the label (manual
override). A brand-new field whose key still matches its label keeps syncing.

**E2E-A-06 — AI-applied schema is normalized** · P1
1. Use LukeTalks to generate/modify a form that would produce duplicate or
   non-identifier keys.

✅ After apply, no duplicate-key problems exist; reopening fields shows unique,
identifier-safe keys; draft persists (reload form → keys unchanged).

**E2E-A-07 — Grid submission keyed by field key, not entity id** · P0
1. Build a Data Grid with two cell fields (keys `qty`, `price`).
2. Preview → add a row → fill it → Submit.

✅ The submitted JSON shows the grid value as rows of `{ qty, price }` (field
keys) — never internal `entityId`-style keys.

---

### Tier B — Runtime correctness

**E2E-B-01 — Calculated value computes without churn** · P0
1. Fields `price`, `quantity`, and `total` with Calculated Value `price * quantity`.
2. Preview → type `price=3`, `quantity=4`.

✅ `total` shows `12`; no flicker/cursor-jump; typing in `price` doesn't fight
the calc.

**E2E-B-02 — allowCalculateOverride lets the user take over** · P1
1. On `total`, enable "Allow manual override".
2. Preview → let it auto-calc, then type a manual value into `total`.

✅ Manual value sticks; editing `price` afterwards does not overwrite it.

**E2E-B-03 — clearOnHide clears type-correctly** · P1
1. A Select-Boxes (multi) field with "Clear when hidden" and a conditional that
   hides it.
2. Preview → select options → trigger the hide condition → reveal again.

✅ On hide the value clears to empty (no leftover/garbage); no console error from
an array field being set to `""`.

**E2E-B-04 — Grid cells run full validation** · P0
1. Data Grid with a Number cell (`min 1, max 10`) and a required Text cell.
2. Preview → add a row → leave the number `0` and the text empty → Submit.

✅ Row-level errors appear (e.g. *"Row 1: … Must be ≥ 1"* and required), not just
"add at least one row".

**E2E-B-05 — Required grid with zero rows** · P2
1. Required Data Grid, no rows. Preview → Submit.

✅ Error: *"Add at least one row."*

**E2E-B-06 — Wizard step gating** · P2
1. Tabs/wizard with a required field in step 1 and a Next button
   (blockedByValidation).
2. Preview → leave step-1 field empty → Next.

✅ Cannot advance; the step-1 error shows.

---

### Tier C — Schema robustness

> These rely on a corrupted draft. Easiest setup: a QA endpoint or DB edit to
> store a malformed `draftSchema`. Document the corruption used per run.

**E2E-C-01 — Dangling references don't crash the builder** · P1
1. Store a draft whose `root` includes a missing id and a container referencing a
   missing child. Open the form in the builder.

✅ Builder loads (no white screen / thrown error); the bad references are gone;
valid fields render.

**E2E-C-02 — Cycle doesn't hang the renderer** · P1
1. Store a draft with a container cycle (A→B→A). Open Preview.

✅ Renderer shows the form without freezing/looping.

**E2E-C-03 — Corrupted draft renders best-effort in Preview** · P2
1. Store a draft with an orphan entity (not reachable from root). Open Preview.

✅ Reachable fields render; orphan is silently dropped (no crash).

---

### Tier D — Builder UX

**E2E-D-01 — Problems pill reflects error count** · P0
1. Introduce a blocking problem (duplicate key, E2E-A-01).

✅ Toolbar shows a red **`⊘ 1 error`** pill. Resolve it → pill disappears.

**E2E-D-02 — Problems modal lists + focuses** · P0
1. With a problem present, click the Problems pill.

✅ Modal lists each problem with the field label; clicking a row closes the modal,
selects that field, and opens its settings.

**E2E-D-03 — Check-in blocked by errors** · P0
1. With a blocking problem present, observe/click **Check in**.

✅ The button is **disabled** (tooltip explains); attempting it opens the Problems
modal instead of checking in.

**E2E-D-04 — Publish blocked by errors** · P0
1. With a blocking problem present, observe **Publish**.

✅ Disabled while errors exist; enables once resolved (and a checked-in version
exists).

**E2E-D-05 — Expression syntax error surfaces** · P1
1. A field's Calculated Value = `price *` (incomplete).

✅ Inline/panel warning: *"Syntax error: …"*.

**E2E-D-06 — Expression unknown-field reference surfaces** · P1
1. Calculated Value = `price * quantty` (typo) while only `price`/`quantity` exist.

✅ Warning: *"Unknown field: quantty."* (advisory — does not block publish).

**E2E-D-07 — Leave-guard flushes on navigation** · P0
1. Make an edit, then within ~½ second click browser Back (or navigate away).
2. Return to the form.

✅ The last edit is present (it was flushed, not lost in the 600 ms debounce).

**E2E-D-08 — beforeunload warns on unsaved edits** · P1
1. Make an edit and immediately attempt a tab close / refresh.

✅ Browser shows the "Leave site? Changes may not be saved" prompt.

**E2E-D-09 — AI remount does not clobber applied schema** · P1
1. Make a manual edit, then immediately apply a LukeTalks change.
2. Reload the form.

✅ The AI's schema is what persists (the outgoing builder's stale flush was
suppressed); no revert to the pre-AI state.

**E2E-D-10 — View-only user sees no write actions** · P2
1. Open the builder as a FORMS read-only user.

✅ Palette and Save/Check-in/Publish/Problems-gating hidden; canvas is browsable
but not editable; nothing persists.

---

### Tier E — Accessibility

**E2E-E-01 — Label ↔ control association** · P1
1. Inspect a rendered field (Preview).

✅ `<label htmlFor>` matches the control's `id`; clicking the label focuses the
control. Group controls (radio/select-boxes/day/signature) use
`aria-labelledby` to the label id.

**E2E-E-02 — Error association + announcement** · P1
1. Submit with a required field empty.

✅ The error `<p>` has `role="alert"`; the control has `aria-invalid="true"` and
`aria-describedby` pointing at the error id. (SR announces on appear.)

**E2E-E-03 — Description / counters described** · P2
1. A field with a description and char/word count.

✅ Control's `aria-describedby` references the description and counter ids.

**E2E-E-04 — Required announced** · P2
1. A required field.

✅ Control (or group) has `aria-required="true"`.

**E2E-E-05 — Keyboard traversal** · P1
1. Tab through a Preview form.

✅ Focus reaches every control in order, including custom ones (searchable Select
button = `aria-haspopup/expanded`; tags input; signature canvas is focusable).

**E2E-E-06 — Custom validation authoritative (noValidate)** · P1
1. An Email field with an invalid value → Submit.

✅ Our validation message shows (no native browser bubble); submit isn't hijacked
by native `type=email`/`url`/`date` validation.

---

## Traceability & next steps

- Each `E2E-*` id is a future Playwright `test(...)` title → 1:1 mapping.
- When Playwright lands: add stable `data-testid`s where selectors are ambiguous
  (palette items, field cards, key input, Problems pill/modal, toolbar buttons),
  and a fixture form per tier.
- Priorities: **P0** = ship-blocking smoke set; **P1** = full regression; **P2** =
  edge coverage.
