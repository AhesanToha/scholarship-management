# Science Quest — Project Initialize + Next Feature Plan

> Date: 14 Nov 2026 | Source ZIP: `scholarship-seat-desk-updated.zip`
> Project folder: `~/workspace/science-quest/`
> Repo (canonical, handoff onujayi): `AhesanToha/scholarship-management`, branch `main`

## 1. Initialize — ki kora hoyeche (verified)

- ZIP extract kore project bosano hoyeche `~/workspace/science-quest/`-e.
  Vitore ache: `src/` (React 19 + Mantine), `worker/` (Cloudflare Worker + R2),
  `scripts/`, `tests/`, `package.json`, `wrangler.jsonc`, `README.md`, `DEPLOY_CLOUDFLARE.md`.
- Local git init kora hoyeche, first commit: `a882483 Initialize Science Quest
  scholarship-management from scholarship-seat-desk-updated.zip`
  ⚠️ Eta sudhu local commit. GitHub remote add / push ekhono kora hoyni —
  live repo-r sathe miliye push korar age tumar confirmation lagbe.
- `npm ci` — 79 packages, success.
- `npm run build` — PASS. `dist/server/index.js` (2.1 MB) toiri hoyeche.
- `npm run check` — PASS. Sob test pass koreche: domain, school, seating
  (strict bench rules), volunteer, admit, appearance, admin-auth,
  exam-operations (deadline, duplicate, history) soho.
- `.local-data` ekhane nei — eta thik ache. Live data R2 bucket
  `scholarship-seat-desk-data`-te thake, local copy authoritative na.
  Kono live data, password ba secret ei folder-e ana hoyni.

### Local run (Windows-e tumar jonno)

```cmd
cd science-quest
npm.cmd install
npm.cmd start
REM http://localhost:3000  — Admin: /dashboard, Volunteer: /volunteer
```

## 2. Ekhon app-e ki ache, ki nei — short gap analysis

**Ache (already done, handoff onujayi):**
Registration (3-step school portal) → Admin approval / correction →
exam roll + permanent QR → strict seating (same school / same class bench
rule) → admit card A5 print → volunteer lookup (roll / QR scan) →
registration deadline + countdown, school progress, audit history,
room-wise printable lists, possible-duplicate warning.

**Nei / baki (handoff-e propose kora chilo):**
1. **Offline volunteer lookup** — propose kora chilo, ekhono nei.
2. Volunteer QR attendance — tumi apatoto chao ni.
3. Dynamic required fields — pore korar kotha chilo.
4. School portal-e admit access — tumi na bole diyecho.
5. Room print-e aro change — tumi pore janabe bolecho.

**Code-e check kore ja pelam:**
`src/pages/Volunteer.jsx`-e lookup kore `fetch('/api/volunteer/seat?roll=...',
{cache: 'no-store'})`. Mane protibar live server lage. Net gele, Cloudflare /
R2 slow hole, ba venue-r Wi-Fi / mobile data down hole — kono fallback nei,
sudhu "Seat not found" error dekhabe. `src/` ba `worker/`-e kono service
worker, IndexedDB ba offline cache nei.

## 3. Next-e kon feature sobcheye important — Offline Volunteer Lookup

### Keno etai #1?

1. **Exam-day single point of failure.** Registration, approval, seating,
   admit — sob age theke kora jay, vul hole somoy ache thik korar.
   Volunteer lookup sudhu exam din-e, 1,000–1,500 student, 7–8 volunteer
   eksathe use korbe. Oidin lookup bondho mane gate-e line jome jabe,
   kono retry-day nei.
2. **Venue network-i sobcheye unpredictable jinish.** Eta code-e thik
   kora jay na, kintu offline fallback diye risk komano jay. Baki feature
   gulo (attendance, dynamic field, UI polish) oidin kaaj na korleo
   exam cholbe — offline lookup na thakle exam-i atke jabe.
3. **Tumi nijei age propose korecho, sudhu build hoyni.** Handoff §5 #6.
   Tai eta notun idea na, baki thaka exam-day gap.
4. **Low risk, read-only.** Seating rule, QR token, live data, approval
   flow — kichu change korte hobe na. Sudhu ekta read-only copy phone-e
   rakhte hobe. Vul holeo live lookup-i main thakbe.
5. **Timing mile jay.** Purono exam date 17 Oct 2026 par hoye geche, notun
   date ekhono Settings-e set kora hoyni. Seating lock howar porei offline
   pack banate hobe — tai age date/lock thik kore, tarpor ei feature-i
   sobcheye logical next step.

### Keno onno gulo ekhon na?

- **Volunteer QR attendance:** tumi apatoto na korecho, ar admin attendance
  + printed sheet diye kaaj cholche.
- **Dynamic required fields:** valo feature, kintu exam din-e kono risk komay na.
- **School-ke admit access dewa:** tumi sposhto na bolecho, admin-i print
  kore pathabe.
- **Notun UI / room print tweak:** pore tumi nirdesh debe bolecho.

## 4. Step-by-step plan — Offline Volunteer Lookup

### Phase 0 — Precondition (code na, age verify) — 30 min
1. Live site khule dekho latest ZIP-er code live-e deployed kina
   (Cloudflare → Visit, commit hash miliye dekho).
2. Settings-e **notun exam date, time, centre** set koro. Purono
   17 Oct 2026 date dhore nio na.
3. Registration deadline notun kore set / clear koro, seating ekhono
   locked kina check koro.
4. Ekta pilot school diye phone-e full flow ekbar chalao:
   register → approve → roll → admit.
   → Egulo na kore offline pack banale vul / purono data pack hobe.

### Phase 1 — Offline pack endpoint (Worker) — sobcheye important design
1. Notun endpoint: `GET /api/volunteer/offline-pack`
   - Sudhu **seating lock howar pore** kaj korbe. Lock na hole
     `409 Seating not locked` debe — karon lock-er age seat bodlate pare.
   - Response-e sudhu volunteer lookup-e ja dekhano hoy tai thakbe:
     `roll, room, building, floor, bench, seat position, directions,
     room map coordinates`.
   - **Thakbe na:** student name, photo, guardian phone, school name,
     QR token (plain). Eta bortoman `/api/volunteer/seat`-er privacy
     rule-i.
   - Sathe thakbe: `version, generatedAt (Dhaka time), examDate,
     totalCount (~1,500), checksum/hash`.
2. QR offline: scan korle token ase, roll na. Tai pack-e
   `tokenHash -> roll` map rakhte hobe (plain token na, hash).
   Eta niye siddhanto Phase 1-ei nite hobe — QR offline na thakle
   offline-e sudhu roll-type lookup cholbe.
3. Pack size check: ~1,500 record, text-only — koyeksho KB-er besi
   hobe na, phone-e rakhte kono somossa nei.

### Phase 2 — Phone-e save (Volunteer page)
1. Storage hisabe **IndexedDB** use koro — `localStorage` na,
   1,500 record + map-er jonno IndexedDB-i thik.
2. Notun file: `src/lib/offline-seats.js`
   - `savePack(pack)`, `loadPack()`, `findByRoll(roll)`,
     `findByTokenHash(token)`, `clearPack()`.
   - Pack save korar somoy version + checksum verify koro.
3. Volunteer page-e notun button: **"Download offline pack"**
   - Download sudhu online thakle ar seating locked thakle hobe.
   - Download-er pore badge dekhabe: `Offline ready • Synced: <time> •
     1,432 seats • v3`.
   - Purono pack thakle overwrite korar age confirm chao.

### Phase 3 — Lookup fallback (Volunteer.jsx)
1. Lookup logic bodlao — ekhon jemon ache:
   `live fetch -> success hole result, fail hole error`
   Notun logic:
   ```
   live fetch try koro
   → success: result dekhau, badge: "Live"
   → fail / offline: IndexedDB-te khojo
       → pele: result dekhau, badge: "Offline — Synced <time>"
       → na pele: error dekhau, sathe "Offline pack nei / roll nei"
   ```
2. Result-e sobsomoy source sposhto kore dekhao (Live vs Offline),
   jate volunteer vul bujhe purono seat na bole.
3. `Refresh seat` button: online thakle live theke refresh korbe,
   offline thakle disabled thakbe ar karon dekhabe.
4. QR scanner offline-eo cholbe — camera-r jonno internet lage na,
   sudhu HTTPS + permission lage (age thekei ache).

### Phase 4 — Stale-data guard (vul seat na dewar niyom)
1. Seating unlock / notun allocation hole purono pack **auto-invalid**:
   pack-er `version` live version-er sathe na mille volunteer page
   warning dekhabe — "Seat plan changed, download new pack".
2. Admin Settings / Rooms-e pack version + last generated time dekhabe.
3. Exam date par hoye gele pack expired hisabe dekhabe, kintu
   lookup bondho korbe na — volunteer jeno bujhe etai sesh pack.

### Phase 5 — Test (code change-er sathe sathe)
1. Notun test: `tests/offline-volunteer.mjs`
   - Pack-e personal data nei kina, lock chara pack debe na kina,
     checksum vul hole reject kore kina, offline roll/token lookup
     thik result dey kina.
2. Chalao: `npm run build` + `npm run check`
   - Sob PASS na hole deploy koro na.
3. Real phone test (eta sobcheye joruri):
   - Phone-e `/volunteer` khule pack download koro.
   - **Airplane mode on** kore roll diye khojo, QR scan koro.
   - Wi-Fi off kore 10–15 ta roll porpor khojo — kono error asle
     seta bug.
   - Pack download-er pore seating bodle abar pack na nile
     warning ase kina dekho.

### Phase 6 — Exam-day rehearsal + deploy
1. Git-e commit koro: `Add offline volunteer seat lookup`
   Push koro `main`-e → Cloudflare auto deploy hobe.
2. Cloudflare build success + commit miliye browser hard refresh koro.
3. Exam-er ager din: prottek volunteer-er phone-e (7–8 ta)
   pack download kore rakho, `Offline ready` badge check koro.
4. Backup hisabe printed room lists (age thekei ache: Rooms →
   Printable room lists) ek set print kore rakho — offline pack
   fail holeo eta sesh vorosa.

## 5. Acceptance criteria (ei gulo na mille feature complete na)

- [ ] Airplane mode-e roll lookup kaj kore, Live/Offline badge thik dekhay.
- [ ] Airplane mode-e QR scan kaj kore (jodi Phase 1-e QR include koro).
- [ ] Pack-e name / photo / guardian / school / plain QR token nei.
- [ ] Seating lock chara pack download hoy na.
- [ ] Seating change-er pore purono pack warning dey.
- [ ] `npm run build` + `npm run check` — sob PASS.
- [ ] 7–8 volunteer phone-e real test kora hoyeche.

## 6. Tumar theke je siddhanto gulo lagbe (code surur age)

1. **Notun exam date + time ki?** Settings-e set korte hobe.
2. **Offline-e QR scan-o lagbe, naki sudhu roll-type lookup-i jothesto?**
   QR chaile token-hash map lagbe.
3. **Pack ke download korbe?** Admin age theke 7–8 ta volunteer phone-e
   download kore debe, naki volunteer nije download korbe?
4. Ei feature-ei egobo, naki age live deploy verify + notun date set
   kore tarpor suru korbo?

> Ei plan onujayi kaj suru korte bollei ami Phase 1 theke code kora suru korbo.
> Live repo-te push / Cloudflare deploy tumar anumoti chara korbo na.
