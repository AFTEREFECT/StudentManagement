# Teacher PWA and institution archive

This extends the existing `teacher/TeacherApp.tsx`, its attendance controls and
the existing Supabase sign-in/activation helpers. It does not introduce a second
teacher application. The institution's local SQLite archive remains authoritative.

## Daily use

On the first online sign-in, choose a local archive unlock phrase (at least eight
characters), separate from the server login password. The phrase is never sent to
Supabase or persisted. Keep it safely: the local archive cannot be decrypted
without it. Subsequent launches can unlock the cached archive offline using the
username and that phrase, without claiming to authenticate to the server.
Changing the server password does not reset or erase the encrypted archive.
New activation codes contain six digits. The portal also accepts existing
five-digit numeric codes and 16-character hexadecimal codes once, until they
expire, to support invitations issued by older versions.

After selecting absentees, **save the draft**. Unsaved choices are explicitly
marked and leaving the page warns about them. The draft transaction completes
before any request is sent. Offline drafts remain pending until the application
is open, unlocked and connected. They are never counted as delivered or official.
Unsent drafts that are rejected by the server stay available for institution
review; their dates are not silently changed to today.

Attendance entry opens on the lessons scheduled for the selected date, which
defaults to today. Teachers can show the full weekly timetable to choose an
earlier lesson, then record today or a past date only; future dates are blocked
in both the interface and the server. For past dates, choose the date and the
morning/evening period, then select the scheduled lesson whose start and end
times match the period being recorded.

Reconnection and the update button refresh the permitted timetable and rosters
using the existing read functions and RLS. They retry pending immutable operation
IDs and merge available server versions. Missing cloud sessions never delete
cached history. There is no dependency on the cloud retaining a full school year.
Viewing statistics, switching their period or reading cached years makes no cloud
requests. Counts exclude drafts and cancelled records; delivered records are
distinguished from sessions approved by the institution. Absence hours are summed
per pupil/lesson and pupil-days are deduplicated per pupil/date.

Defaults approved for this implementation are September 1–August 31, with the
second semester starting February 1. The institution can configure the two month
boundaries in Desktop's archive controls before a school year starts. Historical
year documents and signed exports retain their calendar boundaries.

## Local storage and isolation

IndexedDB `progtalamid-teacher-v1` stores a vault header and encrypted annual
documents. Documents contain institution/user/year identity, subject/class/lesson
snapshots, permitted pupil display names and random IDs, drafts, receipts and
version history. They contain no Massar number, birth date, family data, server
password or service-role key. Incoming data is whitelisted before persistence.

Each account has a separate random AES-256-GCM data key. A PBKDF2-SHA256 key
(310,000 iterations, random salt) derived from its local phrase wraps that key.
Neither the wrapping key nor an unwrapped data key is stored. GCM additional
authenticated data binds ciphertext to its owner/document, preventing ciphertext
swaps between accounts. Keys and decrypted state are cleared on logout, account
change and page hide; other tabs receive a lock event. Account switching never
deletes the previous teacher's encrypted archive.

Annual writes use a revision compare-and-swap inside a single IndexedDB write
transaction. Conflicting tab writes retry rather than overwrite one another.
Local operation IDs and the previous server revision are persisted with drafts.
Corrections create new operation IDs and retain earlier versions. An unexpected
server revision creates an explicit conflict; the teacher sees both selections
and chooses which version to use. A new cloud version cannot overwrite an older
pending edit silently. No automatic local retention/deletion job is installed.
The application requests persistent browser storage, which the browser may refuse;
cleared storage or a lost phone therefore requires institution recovery.

## Recovery independent of cloud attendance rows

Desktop's **institution archive** controls export only the chosen teacher/year
from `attendance_received`. The admin must authenticate as that institution.
Electron main holds an ECDSA P-256 private key in
`userData/attendance-archive-signing-key.json`; only its public key is registered
through the institution-authorized RPC. Include this key file in the institution's
protected backups alongside its SQLite database. Private keys never reach the
renderer or the teacher site.

The teacher-specific payload is signed, then the entire signed envelope is
encrypted with AES-GCM using a separate delivery phrase (at least 12 characters).
Send the file privately and the phrase through a separate channel. The file is not
uploaded to Supabase. It contains only required teacher/lesson and absent-pupil
data, not the institution's full roster or other teachers' records.

On a new phone, sign in online once and update account data to obtain the public
keys registered by the authenticated institution. Then import the encrypted file
with its delivery phrase. The importer verifies encryption, signature, trusted
institution key, teacher identity and school year before one atomic annual write.
The file's own key is never treated as a trust anchor. Unknown keys, tampering,
wrong teachers/institutions and invalid dates are rejected. Drafts and old versions
already on the phone are retained. Older official exports cannot replace newer
versions of the same record. Only records that reached the institution can be
recovered from its archive; unsent drafts on a lost device are not reconstructible.

## Server validation and Desktop compatibility

Apply `20261017020000_teacher_pwa_operations.sql` after the previous attendance
and Desktop startup migrations. The new submission RPC derives identity and
institution from `auth.uid()`, validates teacher assignment, active timetable,
current Casablanca date/day and the expected server revision, then reuses
`submit_attendance_for_lesson` for pupil and correction-window validation.
Historical/expired offline drafts remain local and require institution review.

Operation metadata receipts persist separately from attendance sessions, with
no pupil selection stored in that table. A receipt survives nightly deletion of
the original session, so a lost response can be retried without recreating a
cleaned absence. Reusing an operation ID with different content/account is denied.
Teacher/admin role boundaries and institution-scoped archive key registration are
enforced server-side; there is no trusted client institution parameter.

The Desktop startup coordinator and its gate are unchanged. The two-hour receipt,
exact revision and correction-deadline conditions, plus Casablanca nightly cleanup
window, are unchanged. No production migrations, cleanup or data writes were run
while implementing/testing this change.

## PWA deployment and checks

Run `npm run build:teacher`, then publish **dist-teacher** at the existing root
`https://attendance.progtalamid.com/` using its current public Supabase environment
variables. Publish the new migration first and rebuild Desktop to enable recovery
exports. The service worker precaches only the teacher shell and its assets. It
does not intercept Supabase/auth requests and never deletes IndexedDB. Updates
require the user's explicit reload after saving drafts. Initial online loading
and unlocking the archive are required before offline use.

Use `npm run check:teacher` and `npm run test:teacher-pwa`. Test-only development
dependencies are fake-indexeddb, PGlite and react-test-renderer. The test harness
also supports the temporary dependency directories used by the existing regression
tests (`PWA_TEST_DEPS` and `ATTENDANCE_TEST_DEPS`). Tests use synthetic records,
in-memory PostgreSQL/IndexedDB, fake network/React browser contexts and an isolated
temporary signing directory. They cover offline/reopen, lost acknowledgements,
duplicate retries, edits/conflicts, concurrent tabs, local statistics, phone loss,
encrypted/signed recovery after cloud deletion, account switching and server
permissions. Run `npm run test:attendance-startup` as the Desktop regression.
