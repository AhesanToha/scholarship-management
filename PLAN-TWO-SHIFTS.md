# Two Shifts — 10:00 AM + 2:00 PM — Implementation Plan

> Request: 2026-11-14 | Exam date same day, 2 shifts
> Shift 1: 10:00 AM | Shift 2: 2:00 PM | Duration: same as now (1 Hour 20 Minutes, unless user says otherwise)
>
> **STATUS — IMPLEMENTED 2026-11-14.** Verified: `npm run build` PASS,
> `npm run check` PASS (all tests incl. new `tests/two-shifts.mjs`).
> Committed locally, NOT pushed to GitHub / NOT deployed to Cloudflare yet.
>
> **Confirmed design (user, 2026-11-14): totally dynamic via Settings.**
> NOT fixed by class. Settings defines the shifts (name + start time) and
> each Category points at one Shift. Default: PRIMARY (Class 4–5) → Shift 1
> (10:00 AM), JUNIOR (Class 6–8) → Shift 2 (2:00 PM) — changeable any time
> before seating is locked.

## 0. Ekhon ki ache (checked from code)

- Exam ekta-i: `exam = {name, center, date, time, duration, locked}`
  `src/lib/domain.js` seed + `src/pages/Settings.jsx` — ekta date, ekta time.
- Student-er kono shift nei: sudhu `name, school, grade (Class), roll, seat`.
- Category ache: PRIMARY (Class 4–5), JUNIOR (Class 6–8) — `src/lib/categories.js`.
  Class range Settings theke bodlano jay, kintu category-r sathe kono time nei.
- Seat unique globally: ek bench / ek position-e ekjon-i boste pare.
  `validateBackup` + `seat-rules.js` — room + bench + position diye duplicate check.
- Admit card-e `exam.time` dekhay, Volunteer result-eo `exam.time` dekhay.
  `src/pages/AdmitCards.jsx`, `src/components/SeatResult.jsx`.

Mane: ekhon 2 shift likhle sudhu time bodlale hobe na — seat, admit,
volunteer, room list — sob jaygay shift bujhte hobe.

## 1. Main design (sohoj kotha)

**Ekdin, ek centre, 2 shift. Student vag hobe Class / Category diye.**
Prostabito default (user confirm korle):
- Shift 1 — 10:00 AM: PRIMARY (Class 4–5)
- Shift 2 — 2:00 PM: JUNIOR (Class 6–8)

Eta Category diye vag korle sobcheye clean hoy, karon Category age thekei
ache. Pore chaile kono ekjon student-er shift haat-e bodlano jabe.

**Ek room, ek bench — dine 2 bar use hobe.**
Sokale je bench-e ekjon boslo, bikele oi bench-e arekjon boste parbe.
Tai seat-er niyom hobe shift-wise, ek shift-er vitore ager strict niyom
(same school / same class pasapasi na) thik thakbe.

## 2. Step-by-step implementation

### Step 1 — Settings-e Shift banano
- `exam.time` ekta rakhar bodle `exam.shifts` list:
  `[{id:'shift-1', label:'Shift 1', time:'10:00'}, {id:'shift-2', label:'Shift 2', time:'14:00'}]`
- Settings → Exam details-e 2 ta shift-er time edit kora jabe.
- Purono `exam.time` muche felbo na — purono backup / admit-er jonno
  fallback hisabe thakbe (Shift 1-er time).
- Prottek Category-r sathe ekta Shift jora hobe (Settings → Categories-e
  dropdown: ei Category kon shift-e).

### Step 2 — Student-er Shift thik kora
- Approval-er somoy student-er `shiftId` auto bosbe — tar Class kon
  Category-te pore, sei Category-r Shift.
- Admin chaile Students page theke ekjon ba ek Class-er sobar shift
  bodlate parbe (bulk change).
- Roll number same thakbe, sob student-er roll unique-i thakbe.
  QR token-o bodlabe na — purono admit-er QR kaj korbe.
- Purono student (jader shift nei) der migration: Category dekhe auto
  shift bosiye debo, kono data harabe na.

### Step 3 — Seating: shift-wise (sobcheye important change)
- Seat duplicate check bodlabe: `room + bench + position + shift`
  — ek bench-e sokale ekjon, bikele arekjon, kono conflict na.
- `buildAllocationPlan` + `allocationCandidates` (`src/lib/domain.js`):
  allocation korar somoy Shift select korte hobe, sudhu oi shift-er
  student-i oi room-e bosbe.
- `seatConflicts` (`src/lib/seat-rules.js`): sudhu ek shift-er
  vitorei same-school / same-class check hobe. Onno shift-er
  student-er sathe conflict dhora hobe na.
- Capacity hisab bodlabe: ek room-e ek shift-e jotogulo seat,
  dine mot tar 2 gun student bosano jabe.
- Seating lock thakle age unlock kore, shift bosiye, abar allocation
  korte hobe — lock thaka obosthay shift bodlano jabe na.

### Step 4 — Admit Card
- `AdmitCard` (`src/pages/AdmitCards.jsx`): ekhon sudhu time na,
  boro kore dekhabe — **Shift 1 · 10:00 AM** ba **Shift 2 · 2:00 PM**,
  sathe date + duration.
- Admit print korar somoy Shift diye filter kora jabe — sokaler ta
  alada, bikeler ta alada print.
- Instruction-e jog hobe: "nijer shift-er 30 minute age ashte hobe,
  onno shift-e dhoka jabe na."

### Step 5 — Volunteer Lookup + Room Lists
- Volunteer (`/volunteer`): roll / QR dile result-e Shift + time
  boro kore dekhabe, jate sokaler student bikele dhuke na jay.
- Rooms → Printable room lists: prottek shift-er alada list —
  "Room D01 — Shift 1 (10:00 AM)" ar "Room D01 — Shift 2 (2:00 PM)".
  Door list + attendance sheet — duita shift-er jonno alada.
- Dashboard + Students page-e Shift filter + Shift-wise count
  (Shift 1: kotojon, Shift 2: kotojon, seat kotojon-er hoyeche).

### Step 6 — Offline Lookup-er sathe mil
- Offline pack-e (age plan kora feature) prottek record-e Shift-o
  thakbe. Offline-eo volunteer Shift dekhte pabe.
- Offline pack banate hobe seating lock howar pore, duita shift-er
  seating ses hole.

### Step 7 — Test + Deploy
- Notun test: `tests/two-shifts.mjs`
  - Ek bench-e 2 shift-er 2 jon boste pare, ek shift-e 2 jon pare na.
  - Category bodlale Shift auto bodlay kina.
  - Purono backup (shift chara) khulle auto shift boshe kina.
  - Admit-e vul shift-er time dekhay na kina.
- Chalao: `npm run build` + `npm run check` — sob PASS hote hobe.
- Real test: 1 ta PRIMARY + 1 ta JUNIOR admit print kore, volunteer
  phone-e duita roll khuje dekho.
- Tarpor git commit + push `main` → Cloudflare deploy.

## 3. Tumar theke je 1 ta siddhanto lagbe (code surur age)

**Kon Class kon shift-e?**
- Option A (prostabito): PRIMARY (4–5) sokal 10:00, JUNIOR (6–8) bikel 2:00
- Option B: ulta — JUNIOR sokal, PRIMARY bikel
- Option C: Class diye vag na, onno kono niyom (jemon school diye, ba
  roll number diye) — thakle janio.

Ar duration ki duita shift-ei same 1 Hour 20 Minutes thakbe?

> Ei 1 ta answer pelei ami Step 1 theke code suru korbo.
> Offline Lookup-er age ei Shift feature kora valo, karon offline pack-e
> Shift thakte hobe — age shift thik na hole pore pack abar banate hobe.
