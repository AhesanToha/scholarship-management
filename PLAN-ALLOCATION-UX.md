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
