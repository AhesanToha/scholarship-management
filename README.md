# Seat Desk

Scholarship examination management with an English interface, persistent Light/Dark appearance, React, Mantine and a Cloudflare Worker.

## Start on Windows

Install Node.js LTS. Open `START_WINDOWS.cmd`, or run:

```powershell
npm.cmd install
npm.cmd start
```

Admin: http://localhost:3000/dashboard
Volunteer: http://localhost:3000/volunteer

The launcher builds the current source before starting. Keep `.local-data` when
updating: it contains school accounts, registrations and photos. Keep the same
localhost address to retain browser data. The local server binds to this computer.

## Volunteer desk

`/volunteer` is a standalone page with no admin menu or editing controls.
Search by exact exam roll (English or Bengali digits), or scan an admit-card QR.
Results come from the current server record and show room, building, floor,
bench, position, directions and a highlighted room map. Unassigned students and
unknown rolls have separate states. Use “Next student” to clear the result,
and “Refresh seat” to fetch the latest assignment again.

Copy the URL from Settings. For volunteers on phones, deploy this app to an
HTTPS host and share `https://YOUR-HOST/volunteer`. A localhost link works only
on the computer running the server; it is not a hosted link. Camera access needs
HTTPS or localhost and browser permission. The scanner accepts QR URLs for the
same origin, including existing `/#lookup=...` links, and never navigates to
scanned URLs. Camera tracks stop when the scanner closes or succeeds.

The read-only `/api/volunteer/seat?roll=...` endpoint returns the same limited
seat information as `/api/seat/:token`; student names, photos, guardian contacts,
schools and QR tokens are not returned. Admin and school endpoints keep their
existing school access rules. Roll lookup is public by design.

## Appearance

Settings → Appearance provides an accessible Light/Dark switch. The choice is
saved on this device and restored when reopening the app. It applies to admin,
school and volunteer pages. Admit cards and print output remain on white paper.
Stored names, school records, exam data, rolls and QR codes are not translated
or replaced.

## Management

- `/dashboard`: counts, seating progress and operational shortcuts.
- `/students`: registration, filters, corrections and attendance.
- `/rooms`: geometry, allocation preview, room maps and allocation locking.
- `/admit-cards`: permanent QR, photos and A5 landscape printing.
- `/schools`: school accounts, approvals, correction requests and notices.
- `/school/:schoolId`: authenticated school portal.
- `/settings`: examination details, categories, volunteer URL and backups.
- `/seat-lookup`: admin lookup; `/seat/:token`: public QR result.

School sessions, permanent rolls/QR tokens, strict seating checks and admit-card
layout are preserved. The local launcher keeps its testing behavior; the hosted Worker uses authenticated admin access.
For Cloudflare hosting, use `TESTING_MODE=false`, an `ADMIN_PASSWORD` secret of at least 16 characters, and the `BUCKET` R2 binding. The included `wrangler.jsonc` and `DEPLOY_CLOUDFLARE.md` provide the full setup. The existing ChatGPT owner integration is preserved when no admin password is configured.
The ZIP does not contain personal data. The existing hosting metadata is retained.

A JSON backup contains image references, not photo bytes. Preserve the entire
`.local-data` directory when moving an existing local installation.

## Build and verify

```sh
npm ci
npm run build
npm run check
npm run check:local
node tests/routes.mjs
node tests/bundle.mjs
```

Source: `src/`, API: `worker/api.js`, local server: `scripts/dev-server.mjs`.
The build emits a self-contained Worker in `dist/server/index.js`.
Real camera hardware and physical A5 printing still require a device check.

## School registration update

School portals use Register student to open a form. Phone forms fill the screen;
phone student records use cards rather than wide tables. Student name, father's name and class are required for school submissions and corrections, in both
client and server validation. Existing records remain intact. Photos are optional;
the 3:4 preview opens the file picker. Labels say Class; stored `grade` fields
remain compatible. CSV templates now use `class`; old `grade` headers are accepted.

## Deploy

See DEPLOY_CLOUDFLARE.md for a browser-based GitHub → Cloudflare Workers + R2
setup, admin password configuration, live URLs and optional local-data migration.
The live deployment has not been performed for you.

## Registration and exam-day operations update

- Settings → Registration controls: optional deadline in Bangladesh time
  (UTC+06:00) and manual Close new registration switch. Save applies the controls.
  Deadline closes new school POST registrations only; existing pending/returned
  submissions and correction requests remain editable unless seating is locked.
  Admin approvals and direct admin entries remain available. Defaults preserve
  open registration for existing installations. Clear/extend an expired deadline
  and turn off manual closure to reopen.
- Each authenticated school portal displays an adaptive countdown and open/closed
  status. The clock uses server time from its usual portal refresh, then ticks
  locally. It does not add a network request each second. The server remains the
  authority when submission and expiry happen together.
- Schools → School registration progress: registered, approved, pending, returned,
  missing photo and approval percentage. Linked approved applications are counted
  once; unambiguously linked legacy students are included. Photo remains optional.
- Student approval queue: possible-duplicate warnings compare school, class,
  normalized student name and father's name. Existing exact-duplicate prevention
  stays in place. A flagged approval requires acknowledgement and a reason of at
  least five characters. A name match is not proof of identity.
- History (`/history`): server-recorded changes to records, seating, exam settings,
  school notices and approval/correction status. History is saved atomically with
  the examination state. Client backups/saves cannot replace server history.
  Latest 3,000 record changes are retained; download history regularly. Earlier
  history is not reconstructed. Shared admin access is labelled as shared admin,
  not as an individually identified person. Passwords and image bytes are not
  logged. Individual records in a batch may produce separate history entries.
- Rooms → Printable room lists (`/room-lists`): select all rooms or one room and
  Door seat list or Attendance & signature sheet. Seat order is bench then position.
  A4 portrait, 100% scale, browser headers/footers off. Room header and column
  headers repeat as appropriate; each room starts on a new page. Unassigned
  students are excluded with an explicit warning. The existing room-map print
  option remains available. PDF output uses the browser's Save as PDF option.
- School portals still have no admit-card download access. QR attendance and
  offline lookup were not added.

### Update the already-live deployment

Stop the local server if it is running. Back up your project folder, replace the
code with this ZIP and keep `.local-data` and `node_modules`. This package now
uses Worker name `scholarship-management`, matching the live configuration, and
the same R2 bucket `scholarship-seat-desk-data`.

In CMD in the existing Git project folder, run one command at a time:

```cmd
git add src worker scripts tests package.json package-lock.json wrangler.jsonc README.md UPDATE_WINDOWS.txt
git commit -m "Add registration deadline, progress, history and room lists"
git push https://github.com/AhesanToha/scholarship-management.git main
```

Cloudflare rebuilds from the existing repository connection. Keep the same R2
bucket and ADMIN_PASSWORD secret. Do not import an old backup, rerun migration,
or initialize a new bucket for this update. Existing live school accounts,
students, photos, rolls and QR tokens remain in the same R2 bucket.

After success, hard-refresh admin and school browsers. Configure and save the
actual registration deadline (none is automatically imposed), verify a school's
countdown on a phone, then test closure and a pending application correction.
Print one room sheet on the actual browser/printer before printing all rooms.

Verification includes backend closure/reopening/approval, duplicate review,
immutable audit/atomic conflict behavior, progress deduplication, deadline UI,
history search and room-list print flow. Real cloud capacity and physical print
layout still require a live/device check.
