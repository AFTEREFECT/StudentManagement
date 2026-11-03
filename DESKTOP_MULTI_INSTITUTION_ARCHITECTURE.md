# StudentManagement Desktop — Multi-institution, multi-computer design

**Status: foundational draft — NOT production-ready (2026-11-03).**

## Approved product requirements

- One signed Windows desktop installer for many schools; multiple computers may belong to the same institution.
- Each administrative user has a separate identity and membership in an institution. Institution administrators require TOTP MFA (Google Authenticator compatible); teachers do not require TOTP.
- Each desktop computer is registered and approved individually.
- When online, sync immediately; when offline, retain encrypted pending operations and upload batches on reconnect. Do not acknowledge unconfirmed operations.
- Institution isolation is enforced server-side, not with a UI-only filter.

## Implemented here

- Institution memberships and independently registered/approved computers.
- Tightening old *institutions* public read/write policies; login account still required.
- Postgres RLS; a secure membership helper; an administrator-only device approval RPC (AAL2 MFA required).
- A restricted pilot desktop document store and batch sync RPC. Only administrative notes and institution preferences are supported, NOT student or attendance data.
- 50 small operations per batch, idempotent operation IDs, per-document revision checking, conflict detection and server acknowledgments.
- Typed TypeScript client, injectable encrypted-outbox interface, and active-window reconnect helper.

These additions are intentionally NOT connected to the old application UI yet: the existing student datastore uses SQL.js/IndexedDB and current historic RLS policies permit overly broad access. Integrating it now would wrongly imply data is tenant-isolated.

## Deployment and security checklist — mandatory before production

1. Back up the existing Supabase database and apply the migration to staging first. Removing the old public institutions policies may affect existing WhatsApp integrations.
2. Create institution records and the first Supabase Auth user using a trusted provisioning backend, then assign institution membership. Never bundle a Supabase service-role key in a desktop app.
3. Enroll an admin TOTP factor and verify AAL2 before online administrative writes.
4. First computer sign-in requests pending device status. An existing authorized AAL2 institutional admin approves it. A device UUID alone is NOT a trusted device credential; add native non-exportable device keys, attestation or signed challenge validation.
5. Package React/Vite inside Tauri or Electron, use institution-partitioned encrypted SQLite and OS key storage, and design secure offline unlock/limited offline lease expiration.
6. Migrate student, class, schedule, attendance and referrals into tenant-keyed central tables and lock down ALL legacy permissive RLS policies. Change unique constraints to institution-scoped where appropriate. Migrate existing records via audited mapping, not a guessed text institution.
7. Implement teacher activation, teacher/class assignments, dedicated attendance RPC, student returns/referral ledger, and separate authorizations for justification and admission.
8. Build incremental download/pull cursor (not supplied in this PR), backup/restore, audit logs, device revocation, account recovery and conflict resolution workflows.
9. Run cross-tenant RLS security tests and a multi-computer offline/online acceptance suite before real deployment.

## End-user workflow after remaining work

Operator creates school A and school B. Both install the same signed desktop application. A's admins each log in with their own credentials and Google Authenticator, register their individual machines, then have them approved. Each machine downloads only A's authorized encrypted records; B cannot see any of them. Online edits are sent immediately; offline edits remain queued and are retried on reconnection. Duplicate operation IDs cannot duplicate writes; concurrent edits to the same document produce an explicit conflict. Teacher phones independently post attendance, and the administration views automatically updated referrals.

## Pilot test cases

- Anonymous access cannot read/write institutions; admin A cannot read admin B's membership, devices or pilot documents.
- AAL1 admin, pending device and revoked device cannot sync; staff cannot approve devices.
- Re-sending an applied operation ID is a duplicate, not a second write.
- A second computer attempting to overwrite an old revision receives a conflict, not silent last-write-wins.
- 51 operations or an oversized request are rejected.
- Queued operations persist through interruption and are only deleted after server acknowledgment.
- No student/absence record goes through the pilot generic sync document endpoint.

## Existing code warnings

- The core app is presently React/Vite, NOT an installable Windows desktop binary yet.
- Its SQL.js database resides in IndexedDB and lacks tenant partitioning and disk encryption.
- Historical students/sections/absence policies are permissive; this branch only narrows the institutions table policies.
- The existing browser fingerprint is not proof of genuine device ownership.
- No production-ready encrypted outbox, secure desktop host, pull sync or teacher attendance sync is implemented here.
- The migration and UI build have not been executed in a test environment as part of this GitHub update.

## Supabase Free plan

Keep small batched writes, use incremental polling rather than subscriptions to every row, monitor database and egress usage, and arrange backups separately. Free-tier limits do not guarantee suitability for many institutions.
