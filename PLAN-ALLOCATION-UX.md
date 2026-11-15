# Seat Allocation UX — smoother flow plan

> Feedback (user, 2026-11-14): allocation-er jonno niche jete hoy — kaj kore,
> kintu user-friendly na. Shift + allocation flow aro smooth korte hobe.

## 1. Ekhon flow-ta kemon (checked from code)

`src/pages/Rooms.jsx` — upor theke niche:
1. Room overview + sob room-er card grid
2. Selected room panel: map, roster (collapsed), actions —
   "Allocate this room" sudhu `?allocate=1` link dey
3. "Add new room" (collapsed `<details>`)
4. **"Seating allocation" (collapsed `<details>`) — ekdom niche**
5. Print-only room maps

`src/components/Allocation.jsx`:
- Shift select → Room select → Mode → Class checkbox (min 2) →
  School checkbox → candidate list (Select all / ekta ekta kore) →
  Preview → preview table → Confirm allocation
- Confirm korar por `/rooms/:roomId?allocate=1`-e jay, kintu Shift/Class
  selection reset hoye jay — porer room / Shift 2-er jonno abar
  suru theke select korte hoy.
- Room card-er "Full / Assigned / Empty" duita shift miliye hisab kore,
  tai Shift 1-e full holeo Shift 2-e khali thakleo "Full" dekhay.
- BenchMap-e ek bench-e duita shift-er student thakle sudhu prothomjon
  dekhay — Shift 2 allocate korar somoy map vul mone hoy.

## 2. Ki bodlabe — 4 ta change, priority order-e

### A. Allocation upore, Shift age (sobcheye joruri — user-er pain point)
- Rooms page-er ekdom upore ekta **Shift tab** thakbe:
  `Shift 1 · 10:00 AM (640/750 assigned)` | `Shift 2 · 2:00 PM (0/750)`
- Tab bodlale pura page oi shift diye filter hobe: room card,
  BenchMap, roster, candidate list — sob oi shift-er.
- Allocation panel ar `<details>`-e lukano thakbe na — Shift tab-er
  nichei khola thakbe, 3 step-e: **1 Shift → 2 Room → 3 Preview & Confirm**.
- Room card-e "Allocate" chaple page scroll kore allocation-e jabe,
  ar Room + Shift age thekei select kora thakbe (ekhon sudhu
  `?allocate=1` khole, scroll kore na).
- Preview / Confirm button sticky thakbe — niche scroll korleo
  button khujte hobe na (phone-e sobcheye kajer).

### B. Selection mone rakhbe + Next room
- Confirm korar por Shift / Class / School selection reset hobe na.
- Confirm-er por button thakbe: **"Next room →"** — oi shift-e
  sobcheye khali room-ta auto select hoye jabe.
- Room list-e sudhu oi shift-e khali seat ache emon room dekhabe,
  sobcheye khali-ta age.

### C. Progress + Auto-allocate (1000+ student-er jonno)
- Uporer dike per-shift progress bar: Shift 1-e kotojon baki,
  Shift 2-e kotojon baki, kon room-e koto khali.
- **"Auto-allocate this shift"**: ekbar Preview-e sob room-e
  kemon bosbe dekhabe, ekbar Confirm-e sob room allocate hoye jabe.
  Room-by-room 20 ta room × 2 shift = 40 bar korar dorkar porbe na.
- Strict rule (same school / same class pasapasi na) ek-i thakbe —
  sudhu room ghuriye dewar kaj-ta system korbe.

### D. Map-e preview
- Preview-er somoy BenchMap-e notun seat gulo highlight hobe —
  sudhu table dekhe bujhte hobe na ke kothay bosbe.
- BenchMap Shift filter onujayi dekhabe — Shift 2 dekhle Shift 2-er
  student-i dekhabe, Shift 1-er ta na.

## 3. Ja bodlabe na (safety)

- Strict seat rules, seating lock, roll / QR, admit card — kichu bodlabe na.
- Allocation-er logic (`buildAllocationPlan` / `applyAllocationPlan`)
  ek-i thakbe, sudhu UI-ta sajano hobe.
- Purono test (`npm run check`) pass korte hobe — Allocation component-er
  nam / button-er lekha bodlale test-o update korte hobe.

## 4. Implementation order

1. A — Shift tab + allocation upore + auto-scroll + sticky Confirm
2. B — Selection mone rakha + Next room
3. C — Progress bar + Auto-allocate all rooms for a shift
4. D — Map preview highlight

A+B ek sathe korle dine-r kaj-ta-i bodle jabe. C alada kore pore
kora jay — eta boro change, age A+B live-e check kore neoa valo.

## 5. Status — IMPLEMENTED 2026-11-14 (local commit, not pushed yet)

A + B + C sob kora hoyeche, D (map preview highlight) baki:
- `Rooms.jsx`: upore Shift tab (per-shift progress: assigned/total/left),
  tar nichei khola Allocation panel, tarpor room card. Room card, BenchMap,
  roster — sob active shift diye filter. "Allocate this room" link
  allocation-e scroll kore, room + shift age thekei select kora thake.
- `Allocation.jsx`: Room select-e "All rooms — auto-fill this shift"
  option, Shift select Rooms-er tab-er sathe sync hoy. Confirm korar por
  Shift/Class/School selection mone thake, "Next room →" button ase.
  Preview/Confirm sticky (niche scroll korleo button dekha jay).
- `domain.js`: `buildMultiRoomAllocationPlan` / `applyMultiRoomAllocationPlan`
  — ek shift-er sob room ekbar-e fill kore, per-room plan + per-room
  preview, stale-preview guard, fill mode only (rebuild per-room-i thakbe).
- `scholarship.css`: shift tab / progress / sticky action styles.
- Test: `tests/allocation-ux.mjs` (domain + UI), `package.json` check-e
  add kora hoyeche. `npm run build` PASS, `npm run check` exit 0 — sob test PASS.
- Live-e pathate Windows theke ager motoi commit + `HEAD:main` push korte
  hobe (folder-ta `feat/exam-day` branch-e ache).

## Modal wizard (2026-11-15) — inline panel soriye deya holo

User bollo ager flow-tao "hijibiji" — tai allocation ekhon modal wizard:
- Room card-er Allocate button, selected room-er "Allocate this room", ba
  tab-er nicher "Auto-fill all rooms" button — sobai ekoi wizard khole.
- Wizard-e 3 step: 1 Setup (shift / mode / class / school / student) →
  2 Preview → 3 Done. Confirm-er pore "Next room →" dile porer room-er
  wizard khole, aager shift/class/school mone rakha thake.
- Wizard bondho kore abar khulleo aager shift-er class/school mone thake
  (Rooms.jsx-er `lastAlloc`); shift bodle gele fresh default ase, karon
  class shift-er sathe jukto.
- `?allocate=1` deep link ekhono wizard khole. Locked thakle Preview
  disabled thake, ager motoi.
- `src/components/Allocation.jsx` muche deya hoyeche; bodle
  `src/components/AllocationWizard.jsx`. `src/pages/Rooms.jsx` theke inline
  panel + scroll effect sorano hoyeche. Selection/count logic (honest
  unassigned counts soho) oporibortito — test: `tests/allocation-ux.mjs`
  §2–3 modal flow-er jonno notun kore lekha, `tests/react.mjs`-o update.
- Map preview highlight (agekar plan item D) ekhono baki.

## Update 2026-11-15 — Allocate button clarity (reviewer defect fixed)

User feedback: after the modal wizard, the Allocate button was not clearly
understandable. Cause: a tiny 12px secondary "Allocate" squeezed into the
card footer line with the layout info and "View room →".

Fix (commit 3dac3b2 + reviewer fix):
- Room card: full-width primary button at the card bottom, "Allocate seats ·
  N free"; full room in the active shift shows secondary "Rebuild seats".
  Footer line now only shows layout info + "View room →" / "Selected ✓".
  Card is flex column; the meta row has margin-top:auto so buttons align
  across the grid row. Button is 44px tall, 14px label.
- Auto-fill toolbar button shows the waiting count: "Auto-fill all rooms ·
  N student(s) waiting" / "no students waiting" (still clickable, opens
  the honest empty state).
- Selected-room panel button: "Allocate seats · N free" / "Rebuild seats".
- Reviewer defect: "Rebuild seats" opened the wizard in fill mode — a dead
  end ("This room has no empty seats" at Preview). Fixed by threading a
  rebuild flag through the wizard state (Rooms setWizard({roomId, rebuild}),
  AllocationWizard initialRebuild prop, multi stays fill-only, Next room
  resets rebuild:false — nextRoomId only ever points at rooms with free
  seats). Test asserts the wizard opens with the mode select on "yes".
- Reviewer optional ideas (not done): disable Allocate entry points while
  seating is locked; button-inside-Link cleanup; wizard "Switch to Rebuild"
  action next to the no-empty-seats error.

## Update 2026-11-15 — next-stage UX: dead-ends closed + preview seat map

User chose BOTH next-stage improvements (lock dead-ends + preview map).
Fixed in the same round (user report): the Students page Add form was
always open above the list — now behind a "+ Add student" button opening
a modal, the same pattern as the school portal registration form
(commit 44f534d).

1. Locked state (commit 02b9ae8): while seating is locked, every Allocate
   entry point is disabled and labelled "Seating locked" — 5 room-card
   buttons, auto-fill, selected-room panel button. Unlocking restores them.
2. Switch to Rebuild: when the wizard fails in fill mode with "This room
   has no empty seats.", "Existing assignments have school or class
   conflicts. Select Rebuild this room.", or "No unassigned students match
   your selection." (and the room has students in this shift), a
   "Switch to Rebuild this room" button appears next to the error — one
   click flips to rebuild mode and previews the new arrangement.
   (Found by test: with no unassigned students in the shift, fill mode
   fails with "No unassigned students" before it ever reaches the
   empty-seats check — the switch covers that message too. A domain test
   covers the "no empty seats" throw directly.)
3. Button-in-Link cleanup: the room card is a plain container now; the
   card info is a Link inside it and the Allocate button is its sibling —
   no nested interactive elements. Tests updated to
   `.room-summary-card a[href=...]`.
4. Preview seat map (plan item D, done): the single-room Preview step
   shows the room BenchMap — amber seats are the new assignments, green
   seats are already assigned (fill mode); in rebuild mode the map shows
   only the new arrangement. Multi-room preview keeps the per-room tables
   (no maps — too heavy for 5 rooms).
Tests: allocation-ux §5 (switch + map + locked), §2 map assertion,
domain "no empty seats" throw. Full build + check PASS (26 suites).
