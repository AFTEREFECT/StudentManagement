// Offline tests only: in-memory PostgreSQL/SQLite, fake IPC, no live project/data.
// node scripts/test-attendance-startup.mjs
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const ts = require('typescript');
const initSqlJs = require('sql.js');
const { createAttendanceStartupGate } = require(join(root, 'electron/attendance-startup.cjs'));
const testRequire = createRequire(join(process.env.ATTENDANCE_TEST_DEPS || join(tmpdir(), 'progtalamid-attendance-check'), 'package.json'));
const { PGlite } = testRequire('@electric-sql/pglite');
const { pgcrypto } = testRequire('@electric-sql/pglite/contrib/pgcrypto');
const read = (file) => readFileSync(join(root, file), 'utf8');
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
}).outputText;
const discipline = {};
vm.runInNewContext(transpile(read('src/utils/discipline.ts')), { exports: discipline });
const database = {};
vm.runInNewContext(transpile(read('src/utils/database.ts')), {
  exports: database, window: {}, console: { log() {}, error() {} },
  require(id) {
    if (id === 'sql.js') return { default: initSqlJs };
    if (id.endsWith('.wasm?url')) return { default: require.resolve('sql.js/dist/sql-wasm.wasm') };
    if (id === './discipline') return discipline;
    throw new Error(`Unexpected dependency ${id}`);
  },
});
const Manager = database.dbManager.constructor;
async function localDatabase(bytes) {
  const manager = new Manager();
  let persisted = bytes;
  let fail = false;
  manager.loadFromIndexedDB = async () => persisted;
  manager.saveToIndexedDB = async (data) => { if (fail) throw new Error('Disk full'); persisted = data; };
  await Promise.all([manager.initialize(), manager.initialize()]);
  return { manager, bytes: () => persisted, fail: (value) => { fail = value; } };
}

const institution = randomUUID();
const sample = (id = randomUUID(), revision = '1') => { const lessonId = randomUUID(); return ({ id, institution_id: institution, sync_revision: revision,
  lesson_date: '2026-10-17', submitted_at: '2026-10-17T08:00:00Z', edit_deadline: '2026-10-17T12:00:00Z',
  status: 'submitted', teacher_id: randomUUID(), timetable_id: lessonId, teacherName: 'أستاذ',
  lesson: { id: lessonId, class_name: '1A', subject_name: 'رياضيات', start_time: '08:00:00', end_time: '09:00:00' },
  marks: [{ id: randomUUID(), student_id: randomUUID(), display_name: 'تلميذ' }],
}); };
const local = await localDatabase();
const pending = new Map();
let offline = false;
let failAck = false;
let loseAckResponse = false;
let rpcCalls = 0;
let ackCalls = 0;
let mutateBeforeAck = null;
const auth = { access_token: `x.${Buffer.from(JSON.stringify({ session_id: randomUUID() })).toString('base64url')}.x`, user: { id: randomUUID() } };
const client = {
  auth: { async getSession() { return { data: { session: auth }, error: null }; } },
  async rpc(name, args) {
    rpcCalls++;
    if (offline) return { error: { message: 'Offline' } };
    if (name === 'attendance_pull_pending') return { data: { institution_id: institution, user_id: auth.user.id,
      records: [...pending.values()].filter((row) => !row.acked && (!args.p_after || row.id > args.p_after))
        .sort((a, b) => a.id.localeCompare(b.id)).slice(0, 2).map((row) => structuredClone(row)) }, error: null };
    ackCalls++;
    if (failAck) return { error: { message: 'Receipt failed' } };
    if (mutateBeforeAck) { mutateBeforeAck(); mutateBeforeAck = null; }
    let acknowledged = 0;
    for (const receipt of args.p_receipts) {
      const row = pending.get(receipt.id);
      if (row?.sync_revision === receipt.revision) { row.acked = true; acknowledged++; }
    }
    if (loseAckResponse) return { error: { message: 'Receipt response lost' } };
    return { data: acknowledged, error: null };
  },
};
function renderer(gate, manager = local.manager) {
  const exports = {};
  let emitted = 0;
  vm.runInNewContext(transpile(read('src/utils/attendanceStartupSync.ts')), {
    exports, atob, Date, Event,
    window: { setTimeout, clearTimeout, dispatchEvent() { emitted++; }, desktopAttendance: {
      async claim(key) { return gate.claim(key); },
      async finish(key, token, result) { gate.finish(key, token, result); },
    } },
    require(id) {
      if (id === './database') return { dbManager: manager };
      if (id === './attendanceCloud') return { attendanceCloud: client };
      throw new Error(`Unexpected dependency ${id}`);
    },
  });
  return { ...exports, emitted: () => emitted };
}

const first = sample();
pending.set(first.id, first);
const gate = createAttendanceStartupGate();
const view = renderer(gate);
await Promise.all([view.startAttendanceStartupSync(), view.startAttendanceStartupSync()]);
assert.equal(ackCalls, 1);
assert.equal(view.getStartupSyncState().phase, 'success');
assert.equal((await local.manager.getReceivedAttendance(institution)).length, 1);
const successAt = view.getStartupSyncState().lastSuccess;
const countBeforeReload = rpcCalls;
const reloaded = renderer(gate);
await reloaded.startAttendanceStartupSync();
assert.equal(rpcCalls, countBeforeReload);
assert.equal(reloaded.getStartupSyncState().phase, 'success');
assert.equal(reloaded.getStartupSyncState().lastSuccess, successAt);
console.log('PASS first login, concurrent pages and renderer reload run once');

const backlog = Array.from({ length: 7 }, () => sample());
backlog.forEach((row) => pending.set(row.id, row));
const restarted = renderer(createAttendanceStartupGate());
await restarted.startAttendanceStartupSync();
assert.equal((await local.manager.getReceivedAttendance(institution)).length, 8);
assert.ok(backlog.every((row) => row.acked));
console.log('PASS a real restart drains every pending page, including accumulated lessons');

const duplicate = structuredClone(first);
duplicate.acked = false;
pending.set(first.id, duplicate);
await renderer(createAttendanceStartupGate()).startAttendanceStartupSync();
assert.equal((await local.manager.getReceivedAttendance(institution)).length, 8);
const reopened = await localDatabase(local.bytes());
assert.equal((await reopened.manager.getReceivedAttendance(institution)).length, 8);
console.log('PASS duplicate delivery is idempotent and survives reopening SQLite');

offline = true;
const offlineGate = createAttendanceStartupGate();
const disconnected = renderer(offlineGate);
await disconnected.startAttendanceStartupSync();
assert.equal(disconnected.getStartupSyncState().phase, 'failed');
assert.ok(disconnected.getStartupSyncState().lastSuccess);
assert.equal((await local.manager.getReceivedAttendance(institution)).length, 8);
offline = false;
const beforeReconnect = rpcCalls;
await renderer(offlineGate).startAttendanceStartupSync();
assert.equal(rpcCalls, beforeReconnect, 'no automatic retry after reconnect/reload');
console.log('PASS offline failure leaves local work available and never retries in the session');

const receiptFailure = sample();
pending.set(receiptFailure.id, receiptFailure);
failAck = true;
const failedReceipt = renderer(createAttendanceStartupGate());
const previousSuccess = (await local.manager.getAttendanceSyncSuccess(auth.user.id)).lastSuccess;
await failedReceipt.startAttendanceStartupSync();
assert.equal(failedReceipt.getStartupSyncState().phase, 'failed');
assert.equal(receiptFailure.acked, undefined);
assert.equal((await local.manager.getAttendanceSyncSuccess(auth.user.id)).lastSuccess, previousSuccess);
assert.ok((await reopened.manager.getReceivedAttendance(institution)).length === 8);
assert.ok((await local.manager.getReceivedAttendance(institution)).some((row) => row.id === receiptFailure.id));
failAck = false;
await renderer(createAttendanceStartupGate()).startAttendanceStartupSync();
assert.equal(receiptFailure.acked, true);
assert.equal((await local.manager.getReceivedAttendance(institution)).length, 9);
console.log('PASS failed receipt preserves the saved row and retries safely on restart');

const lostResponse = sample();
pending.set(lostResponse.id, lostResponse);
loseAckResponse = true;
const lost = renderer(createAttendanceStartupGate());
await lost.startAttendanceStartupSync();
assert.equal(lost.getStartupSyncState().phase, 'failed');
assert.equal(lostResponse.acked, true);
assert.ok((await local.manager.getReceivedAttendance(institution)).some((row) => row.id === lostResponse.id));
loseAckResponse = false;
await renderer(createAttendanceStartupGate()).startAttendanceStartupSync();
console.log('PASS a lost response after a successful server receipt retains the durable local copy');

const unsaved = sample();
pending.set(unsaved.id, unsaved);
local.fail(true);
const ackBeforeDiskFailure = ackCalls;
await renderer(createAttendanceStartupGate()).startAttendanceStartupSync();
assert.equal(ackCalls, ackBeforeDiskFailure);
assert.equal(unsaved.acked, undefined);
local.fail(false);
await renderer(createAttendanceStartupGate()).startAttendanceStartupSync();
assert.equal(unsaved.acked, true);
console.log('PASS persistence failure prevents any receipt, even if the row exists in memory');

first.sync_revision = '2'; first.acked = false; first.marks = [];
pending.set(first.id, first);
mutateBeforeAck = () => { first.sync_revision = '3'; first.marks = [sample().marks[0]]; first.acked = false; };
const lateView = renderer(createAttendanceStartupGate());
await lateView.startAttendanceStartupSync();
assert.equal(first.acked, false);
assert.equal(lateView.getStartupSyncState().phase, 'failed');
assert.equal((await local.manager.getReceivedAttendance(institution)).find((row) => row.id === first.id).marks.length, 0);
await renderer(createAttendanceStartupGate()).startAttendanceStartupSync();
assert.equal(first.acked, true);
assert.equal((await local.manager.getReceivedAttendance(institution)).find((row) => row.id === first.id).sync_revision, '3');
await local.manager.saveReceivedAttendance(institution, [{ ...first, sync_revision: '1', marks: [] }]);
assert.equal((await local.manager.getReceivedAttendance(institution)).find((row) => row.id === first.id).sync_revision, '3');
console.log('PASS a late correction clears old marks, rejects stale receipt and is received next restart');

const interruptedGate = createAttendanceStartupGate();
const interrupted = interruptedGate.claim('user:session');
interruptedGate.interrupt();
interruptedGate.finish('user:session', interrupted.token, { phase: 'success' });
assert.equal(interruptedGate.claim('user:session').claimed, false);
assert.equal(interruptedGate.claim('user:session').phase, 'failed');
assert.equal(interruptedGate.claim('user:new-login').claimed, true);
console.log('PASS interrupted renderer stays failed until restart or a genuinely new login');

const signOutView = renderer(createAttendanceStartupGate());
signOutView.resetAttendanceStartupSync();
assert.equal(signOutView.getStartupSyncState().phase, 'waiting');
assert.equal(signOutView.getStartupSyncState().institutionId, null);

// Execute the real local monthly export handler using an in-memory Excel file.
const ExcelJS = require('exceljs');
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Data');
sheet.getCell('F9').value = 'غياب مبرر'; sheet.getCell('H9').value = 'غياب غير مبرر';
sheet.getCell('F10').value = 'عدد الأيام'; sheet.getCell('G10').value = 'عدد الساعات';
sheet.getCell('H10').value = 'عدد الأيام'; sheet.getCell('I10').value = 'عدد الساعات';
sheet.getCell('C11').value = 'M1';
const templateBytes = await workbook.xlsx.writeBuffer();
const exportSource = ts.createSourceFile('Export.tsx', read('src/components/AttendanceMonthlyExport.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let exporter;
let duration;
function visitExport(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(exportSource) === 'exportMonth') exporter = node.initializer.getText(exportSource);
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'lessonDurationHours') duration = node.getText(exportSource);
  ts.forEachChild(node, visitExport);
}
visitExport(exportSource);
let blob;
let exportError = '';
const exportContext = { exports: {}, ExcelJS, Blob, Uint8Array, Map, Set, Date,
  window: { desktopAttendance: {} }, attendanceCloud: null,
  template: { arrayBuffer: async () => templateBytes }, roster: [{ id: 'L1', nationalId: 'M1', section: '1A', level: 'L' }],
  selectedClass: '1A', month: '2026-10', cycle: 'الدورة الأولى', institutionId: institution,
  setBusy() {}, setError(value) { exportError = value; }, setMessage() {},
  textValue: (value) => value == null ? '' : String(value), arabicMonth: () => 'أكتوبر',
  URL: { createObjectURL(value) { blob = value; return 'blob:test'; }, revokeObjectURL() {} },
  document: { createElement() { return { click() {} }; } },
  dbManager: {
    async getAttendanceCloudLinks() { return { L1: first.marks[0].student_id }; },
    async getInstitutionSettings() { return { academy: 'A', directorate: 'D', institution: 'I', academicYear: 'Y' }; },
    async getReceivedAttendance() { return [{ ...first, status: 'confirmed' },
      { ...sample(), status: 'cancelled', marks: [{ id: 'cancelled', student_id: 'unlinked', display_name: 'Cancelled' }] }]; },
    async getAttendanceLocalJustifications() { return {}; },
  },
};
vm.runInNewContext(transpile(`${duration}\nexports.run = ${exporter};`), exportContext);
await exportContext.exports.run();
assert.equal(exportError, '');
const exported = new ExcelJS.Workbook();
await exported.xlsx.load(await blob.arrayBuffer());
assert.equal(exported.worksheets[0].getCell('H11').value, 1);
assert.equal(exported.worksheets[0].getCell('I11').value, 1);
console.log('PASS monthly Excel export works from the local archive with no cloud connection');

// Execute actual desktop review handlers against a cleaned source record.
const portalSource = ts.createSourceFile('Portal.tsx', read('src/components/AttendancePortal.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const handlers = {};
function visitPortal(node) {
  if (ts.isVariableDeclaration(node) && ['saveReviewCorrection', 'reviewSession'].includes(node.name.getText(portalSource))) {
    handlers[node.name.getText(portalSource)] = node.initializer.getText(portalSource);
  }
  ts.forEachChild(node, visitPortal);
}
visitPortal(portalSource);
let archivedRow = structuredClone(first);
let reviewError = '';
const correctedStudent = randomUUID();
const reviewContext = { exports: {}, window: { desktopAttendance: {} }, crypto: { randomUUID },
  profile: { institution_id: institution }, editingReviewId: first.id,
  reviewAbsentIds: new Set([correctedStudent]), reviewStudents: [{ id: correctedStudent, display_name: 'تصحيح محلي' }],
  setWorking() {}, setError() {}, setEditingReviewId() {}, setReviewStudents() {}, setReviewAbsentIds() {}, setSuccess() {},
  loadReviewRows: async () => {}, getAttendanceErrorMessage: (error) => error.message,
  announceError: (value) => { reviewError = value; },
  attendanceCloud: { from() { return { select() { return { eq() { return { async maybeSingle() { return { data: null, error: null }; } }; } }; } }; },
    rpc() { throw new Error('A cleaned record must be edited locally'); } },
  dbManager: { async getReceivedAttendance() { return [archivedRow]; },
    async saveReceivedAttendance(id, rows) { assert.equal(id, institution); archivedRow = rows[0]; } },
};
vm.runInNewContext(transpile(`exports.correct = ${handlers.saveReviewCorrection};\nexports.review = ${handlers.reviewSession};`), reviewContext);
await reviewContext.exports.correct();
assert.equal(reviewError, '');
assert.equal(archivedRow.marks[0].student_id, correctedStudent);
await reviewContext.exports.review(first.id, 'confirmed');
assert.equal(archivedRow.status, 'confirmed');
console.log('PASS cleaned original records remain editable and reviewable through the local archive');

// Real PostgreSQL migration and permissions, entirely in memory.
const pg = new PGlite({ extensions: { pgcrypto } });
try {
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE SCHEMA extensions;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;`);
  for (const migration of [
    '20261016010000_create_secure_attendance_portal.sql', '20261016025000_show_full_teacher_timetable.sql',
    '20261016031000_link_attendance_teacher_invites.sql', '20261016032000_sync_attendance_teacher_directory.sql',
    '20261016033000_remove_legacy_teacher_invite_rpc.sql', '20261016034000_fix_attendance_teacher_invites_and_timetable.sql',
    '20261016035000_allow_admin_teacher_reactivation.sql', '20261016040000_simplify_attendance_teacher_credentials.sql',
  ]) await pg.exec(read(`supabase/migrations/${migration}`));
  // Inject a clock and IANA-derived offset: this WASM build exposes Casablanca
  // as UTC throughout the year. Production keeps PostgreSQL's IANA timezone.
  // pg_cron is unavailable in WASM; its schedule is checked separately below.
  const migration = read('supabase/migrations/20261017010000_receive_attendance_once.sql');
  await pg.exec(`CREATE FUNCTION public.test_now() RETURNS timestamptz LANGUAGE sql AS
    $$ SELECT current_setting('test.now')::timestamptz $$;`);
  assert.match(migration, /clock_timestamp\(\) AT TIME ZONE 'Africa\/Casablanca'/);
  await pg.exec(migration.split('-- Supabase provides pg_cron.')[0]
    .replaceAll('clock_timestamp()', 'public.test_now()')
    .replaceAll("AT TIME ZONE 'Africa/Casablanca'", "AT TIME ZONE current_setting('test.offset')::interval"));
  assert.match(migration, /cron\.schedule\('cleanup-received-attendance', '\*\/10 \* \* \* \*'/);
  await pg.exec("SELECT set_config('test.now', '2026-10-17T07:00:00Z', false)");
  const admin = randomUUID(), teacher = randomUUID(), school = randomUUID(), otherSchool = randomUUID(), otherAdmin = randomUUID();
  const lesson = randomUUID(), student = randomUUID(), session = randomUUID();
  await pg.query('INSERT INTO auth.users (id) VALUES ($1), ($2), ($3)', [admin, teacher, otherAdmin]);
  await pg.query(`INSERT INTO attendance_profiles (user_id, institution_id, role, display_name) VALUES
    ($1, $4, 'admin', 'Admin'), ($2, $4, 'teacher', 'Teacher'), ($3, $5, 'admin', 'Other')`, [admin, teacher, otherAdmin, school, otherSchool]);
  await pg.query('INSERT INTO attendance_teacher_directory (institution_id, teacher_id, display_name) VALUES ($1, $2, $3)', [school, teacher, 'Teacher']);
  await pg.query('UPDATE attendance_profiles SET teacher_id = $1 WHERE user_id = $1', [teacher]);
  await pg.query(`INSERT INTO attendance_timetable (id, institution_id, teacher_id, class_name, day_of_week, start_time, end_time)
    VALUES ($1, $2, $3, '1A', 6, '08:00', '09:00')`, [lesson, school, teacher]);
  await pg.query("INSERT INTO attendance_students (id, institution_id, class_name, display_name) VALUES ($1, $2, '1A', 'Student')", [student, school]);
  await pg.query(`INSERT INTO attendance_sessions (id, institution_id, timetable_id, teacher_id, lesson_date, edit_deadline)
    VALUES ($1, $2, $3, $4, '2026-10-17', '2026-10-17T12:00Z')`, [session, school, lesson, teacher]);
  await pg.query('INSERT INTO attendance_marks (institution_id, session_id, student_id) VALUES ($1, $2, $3)', [school, session, student]);
  const login = async (id) => {
    await pg.exec('RESET ROLE');
    await pg.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]);
    await pg.exec('SET ROLE authenticated');
  };
  const pull = async () => (await pg.query('SELECT attendance_pull_pending() AS page')).rows[0].page;
  const ack = (revision, id = session) => pg.query('SELECT attendance_acknowledge($1::jsonb)', [JSON.stringify([{ id, revision }])]);
  await login(admin);
  let page = await pull();
  assert.equal(page.institution_id, school);
  assert.equal(page.records.length, 1);
  assert.equal(page.records[0].marks.length, 1);
  const revision = page.records[0].sync_revision;
  await ack(revision);
  assert.equal((await pull()).records.length, 0);
  await login(otherAdmin);
  assert.equal((await pull()).records.length, 0);
  await ack(revision);
  await login(teacher);
  await assert.rejects(pull, (error) => error.code === '42501');
  await assert.rejects(() => ack(revision), (error) => error.code === '42501');
  await assert.rejects(() => pg.query('SELECT cleanup_received_attendance()'), (error) => error.code === '42501');
  await login(admin);
  await assert.rejects(() => pg.query('DELETE FROM attendance_sessions WHERE id = $1', [session]), (error) => error.code === '42501');
  console.log('PASS real RPC derives institution from auth and rejects teachers, foreign schools and client cleanup');

  // Teacher's existing immediate submission RPC is unchanged and invalidates receipt.
  // Its local date derives from now(); use admin correction to test the same mark triggers.
  await pg.query('SELECT admin_correct_attendance($1, ARRAY[]::uuid[])', [session]);
  page = await pull();
  assert.equal(page.records[0].marks.length, 0);
  assert.notEqual(page.records[0].sync_revision, revision);
  await ack(revision);
  assert.equal((await pull()).records.length, 1);
  await ack(page.records[0].sync_revision);
  await pg.query("SELECT admin_review_attendance($1, 'confirmed')", [session]);
  page = await pull();
  assert.equal(page.records[0].status, 'confirmed');
  const latestRevision = page.records[0].sync_revision;
  await ack(latestRevision);
  await pg.exec('RESET ROLE');
  const receiptAt = (await pg.query('SELECT acknowledged_at FROM attendance_sessions WHERE id = $1', [session])).rows[0].acknowledged_at;
  await pg.exec("SELECT set_config('test.now', '2026-10-17T07:30:00Z', false)");
  await login(admin); await ack(latestRevision); await pg.exec('RESET ROLE');
  assert.equal(String((await pg.query('SELECT acknowledged_at FROM attendance_sessions WHERE id = $1', [session])).rows[0].acknowledged_at), String(receiptAt));
  console.log('PASS mark removal and admin review bump revision; stale and duplicate receipts are safe');

  const remaining = async () => (await pg.query('SELECT count(*)::int AS n FROM attendance_sessions WHERE id = $1', [session])).rows[0].n;
  const cleanup = async (time) => {
    const values = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Casablanca',
      timeZoneName: 'longOffset' }).formatToParts(new Date(time)).map((part) => [part.type, part.value]));
    const offset = values.timeZoneName === 'GMT' ? '+00:00' : values.timeZoneName.replace('GMT', '');
    await pg.query("SELECT set_config('test.now', $1, false)", [time]);
    await pg.query("SELECT set_config('test.offset', $1, false)", [offset]);
    return (await pg.query('SELECT cleanup_received_attendance() AS n')).rows[0].n;
  };
  assert.equal(await cleanup('2026-10-17T23:30:00Z'), 1); // 00:30 Casablanca, deadline expired, receipt >2h
  assert.equal(await remaining(), 0);
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM attendance_marks')).rows[0].n, 0);
  const insertSession = async (ackAt, deadline = '2026-10-17T12:00Z', ackRevision = '1') => {
    await pg.query(`INSERT INTO attendance_sessions (id, institution_id, timetable_id, teacher_id, lesson_date,
      edit_deadline, acknowledged_revision, acknowledged_at) VALUES ($1, $2, $3, $4, '2026-10-17', $5, $6, $7)`,
      [session, school, lesson, teacher, deadline, ackRevision, ackAt]);
  };
  await insertSession(null, undefined, null);
  assert.equal(await cleanup('2026-10-17T23:30:00Z'), 0);
  assert.equal(await remaining(), 1, 'unacknowledged rows remain indefinitely');
  await pg.query('DELETE FROM attendance_sessions WHERE id = $1', [session]);
  await insertSession('2026-10-17T22:00:00Z');
  assert.equal(await cleanup('2026-10-17T23:30:00Z'), 0, 'less than two hours');
  assert.equal(await cleanup('2026-10-18T01:00:00Z'), 0, '02:00 Casablanca is excluded');
  assert.equal(await cleanup('2026-10-18T22:59:00Z'), 0, '23:59 Casablanca is excluded');
  await pg.exec("SELECT set_config('test.now', '2026-10-18T23:00:00Z', false)");
  assert.equal(await cleanup('2026-10-18T23:00:00Z'), 1, '00:00 Casablanca is included');
  await insertSession('2026-10-17T18:00:00Z', '2026-10-19T04:00Z');
  assert.equal(await cleanup('2026-10-18T23:30:00Z'), 0, 'teacher correction window remains open');
  await pg.query('DELETE FROM attendance_sessions WHERE id = $1', [session]);
  await insertSession('2026-10-17T18:00:00Z', undefined, '0');
  assert.equal(await cleanup('2026-10-18T23:30:00Z'), 0, 'an unreceived revision is never deleted');
  console.log('PASS cleanup: exact receipt, two hours, correction deadline and [00:00,02:00) Casablanca');

  assert.equal(await cleanup('2026-03-01T00:30Z'), 0);
  assert.equal((await pg.query("SELECT current_setting('test.offset') AS value")).rows[0].value, '+00:00');
  console.log('PASS Casablanca Ramadan uses UTC+00 and the production SQL uses its IANA zone');

  // Keep the teacher's original immediate submission contract intact.
  await pg.query('DELETE FROM attendance_sessions WHERE id = $1', [session]);
  await pg.query('UPDATE attendance_timetable SET day_of_week = attendance_local_day_of_week($1) WHERE id = $2', [school, lesson]);
  await pg.query("INSERT INTO attendance_settings (institution_id, correction_window_hours, correction_window_from) VALUES ($1, 6, 'submission')", [school]);
  await login(teacher);
  const submitted = (await pg.query('SELECT * FROM submit_attendance_for_lesson($1, ARRAY[$2]::uuid[])', [lesson, student])).rows[0];
  assert.ok(submitted.session_id);
  await login(admin);
  const immediate = (await pull()).records.find((row) => row.id === submitted.session_id);
  assert.equal(immediate.marks[0].student_id, student);
  await ack(immediate.sync_revision, submitted.session_id);
  await login(teacher);
  await pg.query('SELECT * FROM submit_attendance_for_lesson($1, ARRAY[]::uuid[])', [lesson]);
  await login(admin);
  assert.equal((await pull()).records[0].marks.length, 0);
  console.log('PASS the unchanged teacher RPC sends immediately and corrections invalidate receipt');

  await pg.exec('RESET ROLE');
  await pg.query(`INSERT INTO attendance_sessions (institution_id, timetable_id, teacher_id, lesson_date, edit_deadline)
    SELECT $1, $2, $3, date '2024-01-01' + n, '2024-01-02T12:00Z'::timestamptz FROM generate_series(1, 205) n`, [school, lesson, teacher]);
  await login(admin);
  const firstPage = await pull();
  assert.equal(firstPage.records.length, 200);
  const secondPage = (await pg.query('SELECT attendance_pull_pending($1) AS page', [firstPage.records.at(-1).id])).rows[0].page;
  assert.equal(secondPage.records.length, 6);
  assert.equal(new Set([...firstPage.records, ...secondPage.records].map((row) => row.id)).size, 206);
  console.log('PASS real SQL keyset pagination returns a backlog larger than 200 without gaps');
} finally { await pg.close(); }

local.manager.getDatabaseInstance().close();
reopened.manager.getDatabaseInstance().close();
console.log('All startup attendance tests passed; no live data or network was used.');
