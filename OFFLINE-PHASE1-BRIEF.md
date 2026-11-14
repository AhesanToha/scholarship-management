# Offline Volunteer Lookup — Phase 1 implementation brief

> Prepared 14 Nov 2026, from reading the actual code in `~/workspace/science-quest/`.
> This is preparation, not code. No source file was changed for the feature itself.
> Still blocked on M.'s two answers (new exam date; QR offline or roll-only)
> before Phase 1 coding starts — see PLAN-NEXT-FEATURE.md §6.

## What the code actually does today

- `src/pages/Volunteer.jsx` `lookup()` (lines ~11–22): fetches
  `/api/volunteer/seat?roll=…` or `/api/seat/<token>` with `{cache:'no-store'}`.
  Any fetch failure → error only ("Seat not found"). No fallback, no cache.
- `worker/index.js` lines 776–790: the live endpoint reads the whole state from
  R2, finds the student by roll or `qrToken`, and returns
  `{v:2, live:true, roll, exam:{name,center,date,time},
  seat:{…student.seat, room, building, floor, directions},
  layout:{benches, per, columns, columnBenches}}`.
  It returns no name, photo, guardian contact, school or QR token — the
  privacy rule the offline pack must keep.
- `src/components/SeatResult.jsx`: renders from exactly those fields —
  `data.seat.{building,floor,room,bench,position,directions}`,
  `data.layout.{benches,per,columns,columnBenches}`,
  `data.exam.{name,center,date,time}`, `data.roll`.
  It already branches on `data.live`: live shows "Latest saved allocation",
  anything else shows "Current allocation". **So an offline result with
  `live:false` reuses this component unchanged.**
- Lock: `state.exam.locked` gates edits in the worker (e.g. lines 412, 469,
  522), but the volunteer seat endpoint does **not** check it. The new pack
  endpoint needs its own `!locked → 409` check; the live endpoint stays as is.
- No IndexedDB, service worker or offline cache exists anywhere in `src/`
  or `worker/`. New storage layer required (Phase 2).
- SHA-256 already exists server-side: `worker/admin-auth.js` line 2 and
  `worker/schools.js` line 12 both define a `crypto.subtle.digest('SHA-256')`
  helper. The `tokenHash → roll` map can reuse that pattern; the client can
  hash a scanned token with the same `crypto.subtle` API (volunteer page is
  HTTPS, so it is available). No new crypto dependency.
- Old exam date is still the default in code: `src/lib/store.js` boot fallback
  creates `exam:{…, date:'2026-10-17', time:'10:00', locked:false}` when no
  cloud state exists. The new date must be set in live Settings, not just in
  code — and the pack's `examDate` must come from live state, never this default.

## Recommended pack shape (reuses the live v:2 shape)

`GET /api/volunteer/offline-pack` — GET only, after seating lock only:

```json
{
  "v": 1,
  "version": "<R2 revision/etag of the state the pack was built from>",
  "generatedAt": "<ISO, Dhaka time>",
  "exam": {"name": "…", "center": "…", "date": "…", "time": "…"},
  "totalCount": 1432,
  "checksum": "<SHA-256 over the seats array>",
  "seats": [
    {"roll": "…", "seat": {"bench": 1, "position": 1, "room": "…",
     "building": "…", "floor": "…", "directions": "…"},
     "layout": {"benches": 20, "per": 2, "columns": 4, "columnBenches": [5,5,5,5]}}
  ],
  "tokenHashes": {"<sha256(qrToken)>": "<roll>"}   // only if QR-offline is chosen
}
```

Why this shape: each `seats[]` entry already contains everything `SeatResult`
needs, so offline lookup can return the entry as-is with `live:false` and the
volunteer page needs no new rendering code. `tokenHashes` is a separate map so
a roll-only decision simply omits that key — the endpoint and the client stay
the same either way.

## Files Phase 1 touches (in order)

1. `worker/index.js` — new branch next to the volunteer seat branch
   (lines 776–790): lock check → build pack from R2 state → SHA-256 checksum.
   Reuse the seat/layout construction already there; do not duplicate it.
2. `src/lib/offline-seats.js` — new: `savePack`, `loadPack`, `findByRoll`,
   `findByTokenHash` (only if QR chosen), `clearPack`, checksum verify on save.
3. `src/pages/Volunteer.jsx` — fallback only: live fetch fails → IndexedDB
   lookup → show result with `live:false` (badge text comes free from
   `SeatResult`); "Refresh seat" disabled while offline.
4. `tests/offline-volunteer.mjs` — new: no personal data in pack, 409 without
   lock, checksum rejection, offline roll/token lookup returns the right seat.

## Open points for M. (unchanged from PLAN-NEXT-FEATURE.md §6)

1. New exam date + time (Settings, live).
2. Offline QR scan too, or roll-only? (Decides whether `tokenHashes` ships.)
3. Who downloads the pack onto the 7–8 volunteer phones — admin beforehand,
   or each volunteer?
4. Confirm this feature is the next build, vs. live-deploy verify + new date
   first (Phase 0).

## Repo state at time of writing

- Local git: first commit `a882483`, no remote configured (`git remote -v`
  empty), nothing pushed. Push needs M.'s confirmation and the remote added.
- `PLAN-NEXT-FEATURE.md` was untracked; committed locally with this brief
  (local-only commit, no push).
