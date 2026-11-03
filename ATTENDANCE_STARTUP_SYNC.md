# Desktop attendance delivery

The desktop app attempts automatic delivery once per real Supabase login session
per Electron process lifetime. A restored login gets a new attempt on the next
application launch. Electron main owns the claim, so React StrictMode, page
navigation, token refresh and renderer reload cannot start another attempt. A new
actual login has a new JWT `session_id`. Electron's single-instance lock also
prevents concurrent processes from writing the same SQLite file.

Delivery starts after local database initialization and a login is available.
The pull/receipt RPCs independently require an authenticated institution admin
whose password change is complete. They derive the institution from the server's
profile for `auth.uid()` and accept no client-supplied institution ID. A teacher
login cannot receive or acknowledge records.

There is no polling interval, reconnect retry or focus retry. A request deadline
limits stalled network operations without blocking local application screens.
Failure leaves the attempt failed until a real application restart or new login.
A renderer interrupted during delivery is also marked failed by Electron main.

## Storage and receipt protocol

`attendance_pull_pending` returns up to 200 sessions in UUID key order, each with
all its absence marks, lesson details and display names in one PostgreSQL
statement snapshot. Only sessions whose current revision is unacknowledged are
returned. Pagination continues until empty; there is no lesson-date cutoff,
last-sync timestamp filter or 100-record cap on delivery.

Session changes and every mark insert/update/delete increment `sync_revision`
and clear the receipt. The desktop upserts complete snapshots into SQLite with
primary key `(institution_id, session_id)`. Whole-snapshot replacement removes
marks that a teacher has corrected to present. Older revisions cannot overwrite
newer snapshots. SQLite initialization and exported database writes are serialized.
Each delivery page is persisted to the existing desktop file and IndexedDB storage
before its exact `(session_id, revision)` is acknowledged on the server.

A failed local write sends no receipt. A failed/lost receipt response causes safe
redelivery on restart. A correction between pull and receipt rejects the stale
receipt and stays pending for the next launch. No watermark is advanced past it.
Last successful synchronization is persisted per admin only after all pages and
receipt requests succeed. Receipts intentionally cannot extend the retention
clock when the same revision is acknowledged again.

The sync status and local archive are visible in the desktop UI. Desktop review
and monthly export read the local archive. Explicit admin actions update the
cloud when the source session still exists; once the source has been cleaned,
they operate on the saved local record. These actions require a successful server
lookup to distinguish a cleaned record from a network failure. Local archive
viewing, justification and monthly export remain available offline. Manual local
edits are not automatically uploaded or polled.

## Nightly server cleanup

Migration `20261017010000_receive_attendance_once.sql` installs `pg_cron` and
schedules a server-only cleanup check every ten minutes. The function exits
outside **00:00 inclusive to 02:00 exclusive, Africa/Casablanca**; PostgreSQL's
IANA timezone handles offset and Ramadan changes. This schedule performs cleanup,
not desktop synchronization.

Only original cloud sessions satisfying all three conditions are deleted:

- their acknowledged revision equals the current revision;
- at least two hours have elapsed since that revision was first acknowledged;
- the teacher correction deadline has expired.

Rows are locked with `FOR UPDATE SKIP LOCKED` and at most 1,000 are cleaned per
invocation. Marks are removed by the existing cascading foreign key. New edits
invalidate eligibility. Unacknowledged records have no age-based deletion rule.
Existing audit logging remains in place. The local archive is not cleaned.

## Deployment and validation

Apply the new Supabase migration before distributing the rebuilt desktop app.
Do not invoke the cleanup function manually against production as a test.
The migration fails if cron cannot be installed/scheduled, rather than silently
deploying without cleanup. Verify the `cleanup-received-attendance` job in
`cron.job` and monitor `cron.job_run_details` after deployment.

Run `npm run test:attendance-startup` (or `node scripts/test-attendance-startup.mjs`).
The SQL tests require `@electric-sql/pglite` (validated with 0.5.10), installed in
the temporary `progtalamid-attendance-check` directory or `ATTENDANCE_TEST_DEPS`,
as with the existing attendance SQL regression tests. It uses in-memory SQLite and
PGlite PostgreSQL, fake IPC/auth/network, and in-memory Excel files. It never
connects to Supabase or accesses a user's database. It exercises startup,
duplicate pages/reload, restart backlog, offline operation, disk failure, lost
receipts, late corrections, identity isolation, local export, and retention rules.
The WASM PostgreSQL build lacks Casablanca timezone data, so tests inject clock
and IANA offsets from Node Intl; production SQL retains Africa/Casablanca. Cron
scheduling is checked statically because pg_cron is unavailable in WASM.

The teacher website and `submit_attendance_for_lesson` RPC are unchanged; teacher
submissions still go immediately to the server. The added database triggers track
their revisions without changing the submission contract or correction window.

Validation also passed the desktop and teacher Vite production builds, existing
local-migration, attendance-fixes and attendance-access tests. A comparison of
TypeScript diagnostics in changed files introduced no new diagnostics. The full
project typecheck already fails on syntax in `src/utils/fixedTemplateProcessor.ts`
(lines 226 and 229). The existing reactivation test also fails unchanged on the
baseline at line 88: its old activation/password fixtures no longer match the
current six-digit/numeric credentials. These unrelated files were left unchanged.
