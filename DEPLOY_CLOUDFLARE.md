# Make Seat Desk live with Cloudflare Workers + R2

The app needs a server and persistent storage; uploading only the React files to
static hosting will not run school registration, passwords, photos or seat lookup.
This package contains a self-contained Worker, an R2 binding configuration and
password-based admin sign-in for hosting outside ChatGPT.

Checked against Cloudflare documentation on 13 October 2026.

## Cost and accounts

Cloudflare Workers Free currently includes 100,000 requests per day and 10 ms
CPU per request. R2 Standard has a monthly free allowance of 10 GB storage,
1 million Class A operations and 10 million Class B operations. Usage beyond
free allowances can incur charges; this is not an unlimited free service.
R2 requires subscription activation through checkout and may require a payment
method. Check the checkout terms before enabling it.

Use a private GitHub repository and a Cloudflare account. The browser-based
GitHub deployment below avoids installing Wrangler on your Windows computer.
Current Wrangler officially supports Windows 11; use this browser route if you
use Windows 10. A domain purchase is not needed: Cloudflare supplies an HTTPS
workers.dev address.

## 1. Update the local project

Stop the old server. Back up your existing folder, then copy the ZIP's project
contents into the same folder. Keep `.local-data` and `node_modules`. Start with
`START_WINDOWS.cmd` and hard-refresh the browser.

Check Settings → Appearance, then school login → Register student. Student name,
father's name and class are required. A photo is optional; click the 3:4 preview
or Upload photo, crop, then save. Submitting a record puts it into the admin
approval queue.

## 2. Create the storage bucket

1. Sign in at https://dash.cloudflare.com/.
2. Open Storage & databases → R2 → Overview and activate R2 if needed.
3. Create a **Standard** bucket named exactly `scholarship-seat-desk-data`.
4. Keep it private. Do not enable a public R2 URL; the app provides authorized
   photo access itself.

The included `wrangler.jsonc` binds this bucket as `BUCKET`.

## 3. Put the code into a private GitHub repository

1. Sign in at https://github.com/ and create a private repository.
2. Open Add file → Upload files.
3. Upload the CONTENTS of `scholarship-seat-desk-windows` into the repository
   root, so `package.json` and `wrangler.jsonc` are at the top level.
4. Include `src`, `worker`, `scripts`, `tests`, `.openai`, `package.json`,
   `package-lock.json`, `check-api.mjs` and `wrangler.jsonc`. The other documentation
   and Windows launcher files may also be included.
5. Do not upload `node_modules`, `.local-data`, `.cloud-export`, `.react-build`,
   `.wrangler`, `.dev.vars` or any passwords. Commit the upload to `main`.

The `.openai` folder is retained for the existing local build. It does not connect
this Worker to the old application's storage; Cloudflare uses `wrangler.jsonc`.

## 4. Deploy the Worker from GitHub

1. In Cloudflare, open Workers & Pages → Create application → Import a repository.
2. Connect your GitHub account and choose the private repository.
3. Use these values:

| Setting | Value |
| --- | --- |
| Worker name | `scholarship-management` |
| Production branch | `main` |
| Root directory | Repository root |
| Build command | `npm run build` |
| Deploy command | `npx --yes wrangler@latest deploy` |

4. Save and Deploy. Dependency installation uses the package files.
5. After success, Cloudflare displays your HTTPS `workers.dev` URL.
6. Check Worker → Settings → Bindings: `BUCKET` must point to the bucket created
   in step 2. If the build reports a missing bucket, create it and retry the build.

Do not select a static Pages upload for this package. Use a Worker with the R2
binding. The application already bundles its React assets into the Worker.

## 5. Set the admin password

1. Open your Worker → Settings → Variables and Secrets → Add.
2. Choose type **Secret**, name **ADMIN_PASSWORD**, value your own strong password
   of at least 16 characters. Save the password privately.
3. Select Deploy to apply it.
4. Confirm `TESTING_MODE` is the string `false` (already configured in
   `wrangler.jsonc`). Do not turn it on for the live installation.
5. Do not set `ADMIN_EMAIL` for this password-based deployment.

When `ADMIN_PASSWORD` is configured, password sessions control admin access;
external ChatGPT-style identity headers do not grant admin access. The admin
cookie is Secure, HttpOnly and SameSite=Strict, expires after 12 hours, and is
invalidated by logout or changing the password. Schools retain separate logins.

## 6. Choose fresh setup or migrate existing local records

For a **fresh live installation**, open `/admin-login` on the live URL, sign in,
then open Settings. A fresh password-protected cloud starts with no demo students
or rooms and a proposed exam date of 17 October 2026. Confirm the actual name,
centre, date and time. Add your rooms and schools before sharing portal URLs.

Existing local data is not uploaded automatically. If you already have real local
accounts, photos or student records, migrate them to the NEW empty R2 bucket
before the first live admin login. A JSON backup alone does not include photo
bytes or school password records.

### Optional migration from a supported CLI environment

Stop local edits and close the old server during this one-time transfer. These
commands are for Windows 11 with current Node.js; the browser deployment above
also works without them.

In PowerShell inside your existing project folder:

```powershell
npm.cmd run export:cloud
npx.cmd --yes wrangler@latest login
powershell -ExecutionPolicy Bypass -File .cloud-export/UPLOAD_TO_R2.ps1
```

The export command only prepares files; it does not upload anything. The final
command uploads exam state, school password records and photos. Temporary
sessions are excluded; schools sign in again. Use only your new empty bucket:
these uploads replace matching remote objects. Never run this migration against
an actively used live installation. Keep `.cloud-export` private and out of Git.
For an unsupported Windows version, perform the migration on a supported machine
or use R2's object dashboard with the original object keys; do not upload the
whole `storage.json` as a substitute for individual objects.

Rolls and QR tokens remain unchanged. Reprint admit cards from the new live domain:
QR URLs printed with localhost or a former domain cannot automatically point to
the new host. New registrations and cards should use the final HTTPS address.

## 7. Share the right URLs

Replace `YOUR-WORKER-URL` with the actual HTTPS address Cloudflare gave you.

| Audience | URL |
| --- | --- |
| Administrator | `YOUR-WORKER-URL/admin-login` |
| Volunteer | `YOUR-WORKER-URL/volunteer` |
| School | Copy its `/school/<schoolId>` URL from the Schools page |
| Admit-card QR | Generated automatically for the same live domain |

Create school accounts in Schools and privately provide each school its portal
URL, username and password. Volunteers get only the volunteer URL, never the
admin password. Camera scanning requires HTTPS and camera permission.

## 8. Test before sharing widely

In a separate phone/browser session: log in as a school, register one student
with a name, father's name and class, tap 3:4 and crop a photo, then submit.
Approve the student as admin, allocate a seat, open the volunteer link and search
by roll, then scan the freshly generated live admit-card QR. Check the room map.
Sign out of admin and confirm `/dashboard` returns to admin sign-in. School and
volunteer pages should still work. Test Light/Dark appearance and a physical
A5 landscape print at 100% scale.

Track Workers/R2 usage in the dashboard. Every open admin or school page refreshes
about twice a minute, so polling plus exam-day traffic counts toward free limits.
Large record sets or heavy photo/state processing may exceed the free CPU limit;
a local automated test does not guarantee cloud capacity. Run a realistic live
trial before 17 October and keep a printed seating backup for the exam day.

## 9. Update later

Upload the changed source files to the same GitHub repository and commit.
Cloudflare rebuilds automatically. Keep the same Worker name, hostname and R2
bucket. Do not rerun the local-to-cloud migration after people start using the
live portal. Keep the same hostname so existing live QR links continue to work.

## Official references

- Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- R2 pricing: https://developers.cloudflare.com/r2/pricing/
- R2 setup: https://developers.cloudflare.com/r2/get-started/
- R2 Worker bindings: https://developers.cloudflare.com/r2/get-started/workers-api/
- Git deployment: https://developers.cloudflare.com/workers/ci-cd/builds/
- Build settings: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- Admin secret setup: https://developers.cloudflare.com/workers/configuration/secrets/
- Wrangler requirements: https://developers.cloudflare.com/workers/wrangler/install-and-update/
