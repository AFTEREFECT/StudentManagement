// All data is synthetic. Uses fake IndexedDB, in-memory PostgreSQL, fake network
// and a temporary signing directory. Never opens an application database.
import assert from 'node:assert/strict';
import { webcrypto, randomUUID } from 'node:crypto';
import { readFileSync, mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url), ts = require('typescript');
const deps = createRequire(join(process.env.PWA_TEST_DEPS || join(tmpdir(), 'progtalamid-pwa-check'), 'package.json'));
const sqlDeps = createRequire(join(process.env.ATTENDANCE_TEST_DEPS || join(tmpdir(), 'progtalamid-attendance-check'), 'package.json'));
const dependency = (name, fallback) => { try { return require(name); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; return fallback(name); } };
const uiRequire = (() => { try { require.resolve('react-test-renderer'); return require; } catch { return sqlDeps; } })();
const { IDBFactory } = dependency('fake-indexeddb', deps);
const { PGlite } = dependency('@electric-sql/pglite', sqlDeps), { pgcrypto } = dependency('@electric-sql/pglite/contrib/pgcrypto', sqlDeps);
const read = (file) => readFileSync(join(root, file), 'utf8');
const transpile = (source) => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const identity = { user_id: randomUUID(), institution_id: randomUUID(), role: 'teacher', display_name: 'Teacher A', must_change_password: false };
const identityB = { ...identity, user_id: randomUUID(), display_name: 'Teacher B' };
const lesson = { id: randomUUID(), class_name: '1A', subject_code: 'MATH', subject_name: 'الرياضيات', day_of_week: 6,
  start_time: '08:00:00', end_time: '09:00:00', room: 'R' };
const student = { id: randomUUID(), class_name: '1A', display_name: 'Synthetic student A', nationalId: 'MASSAR-MUST-NOT-PERSIST' };
let currentIdentity = identity, offline = false, lostResponse = false, calls = 0;
let serverRecord = null;
const operations = new Map();
const client = { auth: { onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; }, async signOut() { return { error: null }; } },
  async rpc(name, args) {
    calls++; if (offline) return { error: { message: 'Offline', code: 'NETWORK' } };
    if (name === 'teacher_attendance_bundle') return { data: { userId: currentIdentity.user_id, institutionId: currentIdentity.institution_id,
      year: year, startMonth: 9, secondSemesterMonth: 2, archiveKeys: [], sessions: serverRecord && !args.p_after ? [serverRecord] : [] }, error: null };
    assert.equal(name, 'teacher_submit_attendance_operation');
    if (operations.has(args.p_operation_id)) return { data: operations.get(args.p_operation_id), error: null };
    if (String(serverRecord?.revision || '0') !== args.p_expected_revision) return { data: { outcome: 'conflict', current: serverRecord }, error: null };
    serverRecord = { id: serverRecord?.id || randomUUID(), revision: String(Number(serverRecord?.revision || 0) + 1), timetableId: lesson.id,
      lessonDate: date, status: 'submitted', submittedAt: new Date().toISOString(), editDeadline: new Date(Date.now() + 3600000).toISOString(),
      absentStudentIds: args.p_student_ids, lesson };
    const { absentStudentIds, lesson: _, ...receipt } = serverRecord;
    const result = { outcome: 'accepted', receipt };
    operations.set(args.p_operation_id, result);
    if (lostResponse) return { error: { message: 'Response lost', code: 'NETWORK' } };
    return { data: result, error: null };
  },
};
const cloudModule = { attendanceCloud: client, attendanceCloudConfigured: true,
  async getAttendanceProfile() { if (offline) throw new Error('Offline'); return currentIdentity; },
  async getTeacherTimetable() { calls++; return [lesson]; }, async getStudentsForLesson() { calls++; return [student]; },
};
function environment(factory = new IDBFactory(), extra = {}) {
  const modules = new Map();
  const globals = { crypto: webcrypto, indexedDB: factory, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer,
    structuredClone, atob, btoa, console, setTimeout, clearTimeout, ...extra };
  function load(file) {
    file = file.replaceAll('\\', '/');
    if (modules.has(file)) return modules.get(file);
    if (file === 'src/utils/attendanceCloud.ts') return cloudModule;
    const exports = {}; modules.set(file, exports);
    vm.runInNewContext(transpile(read(file)), { ...globals, exports, require(id) {
      if (id.startsWith('.')) {
        let target = resolve(root, dirname(file), id).slice(root.length + 1).replaceAll('\\', '/');
        if (!target.endsWith('.ts') && !target.endsWith('.tsx')) {
          try { read(target + '.ts'); target += '.ts'; } catch { target += '.tsx'; }
        }
        return load(target);
      }
      if (id === 'react' || id === 'react/jsx-runtime') return uiRequire(id);
      if (id === 'lucide-react') return new Proxy({}, { get: () => () => null });
      return require(id);
    } }, { filename: file });
    return exports;
  }
  return { load, factory };
}
const env = environment();
const model = env.load('teacher/offline/model.ts'), vaultModule = env.load('teacher/offline/vault.ts');
const sync = env.load('teacher/offline/sync.ts'), archive = env.load('teacher/offline/archive.ts');
const transport = env.load('teacher/offline/archiveTransport.ts');
const date = model.localDate(), year = model.schoolYear(date), key = model.entryKey(lesson.id, date);
const vault = new vaultModule.TeacherVault();
await vault.unlock('prof-1000a', 'local-secret-Teacher-A', identity);
await vault.mutate(year, () => model.newYear(identity, year), (data) => {
  data.lessons = [lesson]; data.students = [{ id: student.id, class_name: student.class_name, display_name: student.display_name }]; data.activeStudentIds = [student.id];
  model.saveDraft(data, lesson, date, [student.id]);
});
assert.equal(model.statistics(await vault.read(year), '0000', '9999').absences, 0);
offline = true;
await assert.rejects(() => sync.sendPendingTeacherAttendance(vault));
assert.equal((await vault.read(year)).entries[key].draft.state, 'pending');
vault.lock();
await assert.rejects(() => vault.read(year));
await vault.unlock('prof-1000a', 'local-secret-Teacher-A');
assert.equal((await vault.read(year)).entries[key].draft.absentStudentIds[0], student.id);
console.log('PASS offline draft is durable across close/reopen and is excluded from delivered statistics');

offline = false; lostResponse = true;
const operation = (await vault.read(year)).entries[key].draft.operationId;
await assert.rejects(() => sync.sendPendingTeacherAttendance(vault));
assert.equal(operations.size, 1);
assert.equal((await vault.read(year)).entries[key].draft.operationId, operation);
lostResponse = false;
await sync.sendPendingTeacherAttendance(vault);
assert.equal(operations.size, 1);
assert.equal((await vault.read(year)).entries[key].draft, undefined);
assert.equal(model.statistics(await vault.read(year), '0000', '9999').absences, 1);
console.log('PASS lost server response retries the same immutable operation without duplicate absence');

await vault.mutate(year, () => model.newYear(identity, year), (data) => model.saveDraft(data, lesson, date, []));
await sync.sendPendingTeacherAttendance(vault);
let data = await vault.read(year);
assert.equal(data.entries[key].confirmed.absentStudentIds.length, 0);
assert.ok(data.entries[key].history.some((version) => version.record?.absentStudentIds.length === 1));
await vault.mutate(year, () => model.newYear(identity, year), (value) => model.saveDraft(value, lesson, date, [student.id]));
serverRecord = { ...serverRecord, revision: '3', absentStudentIds: [] };
await sync.sendPendingTeacherAttendance(vault);
data = await vault.read(year);
assert.equal(data.entries[key].draft.state, 'conflict');
assert.equal(data.entries[key].draft.absentStudentIds.length, 1);
assert.equal(data.entries[key].confirmed.absentStudentIds.length, 0);
console.log('PASS corrections preserve versions and a competing edit retains both choices as a conflict');

await Promise.all([vault.mutate(year, () => model.newYear(identity, year), (value) => { value.refreshedAt = 'one'; }),
  vault.mutate(year, () => model.newYear(identity, year), (value) => { value.secondSemesterMonth = 3; })]);
data = await vault.read(year); assert.equal(data.refreshedAt, 'one'); assert.equal(data.secondSemesterMonth, 3);
await sync.refreshTeacherYear(year, vault);
assert.ok(!JSON.stringify(await vault.read(year)).includes('MASSAR'));
await vault.mutate('2024-2025', () => model.newYear(identity, '2024-2025'), () => {});
vault.lock(); await vault.unlock('prof-1000a', 'local-secret-Teacher-A');
assert.ok((await vault.years()).includes('2024-2025'));
await assert.rejects(() => vault.unlock('prof-1000a', 'wrong-secret'));
assert.equal(vault.profile, null);
await vault.unlock('prof-2000b', 'local-secret-Teacher-B', identityB);
assert.deepEqual(Array.from(await vault.years()), []);
assert.equal(await vault.read(year), null);
await assert.rejects(() => vault.unlock('prof-1000a', 'local-secret-Teacher-B', identityB));
currentIdentity = identity;
await vault.unlock('prof-1000a', 'local-secret-Teacher-A', identity);
console.log('PASS IndexedDB CAS prevents lost tab edits, roster fields are minimized, years retained and accounts isolated');

const { createInstitutionArchiveSigner } = require(join(root, 'electron/attendance-archive.cjs'));
const signer = createInstitutionArchiveSigner(mkdtempSync(join(tmpdir(), 'progtalamid-pwa-test-signing-')));
const publicKey = await signer.publicKey();
const official = { ...serverRecord, source: 'institution', status: 'confirmed', absentStudentIds: [student.id], nationalId: 'MASSAR-MUST-NOT-PERSIST' };
const payload = { format: 'progtalamid-teacher-archive-v1', institutionId: identity.institution_id, teacherUserId: identity.user_id,
  year, startMonth: 9, secondSemesterMonth: 2, exportedAt: new Date().toISOString(),
  students: [{ id: student.id, class_name: student.class_name, display_name: student.display_name }], records: [official] };
const envelope = await signer.sign(JSON.stringify(payload));
const transferSecret = 'separate-file-delivery-secret';
const encrypted = await transport.encryptArchiveEnvelope(envelope, transferSecret);
assert.ok(!JSON.stringify(encrypted).includes(student.display_name));
const phone = environment();
const phoneVault = new (phone.load('teacher/offline/vault.ts').TeacherVault)();
await phoneVault.unlock('prof-1000a', 'new-phone-local-secret', identity);
const phoneArchive = phone.load('teacher/offline/archive.ts');
const trusted = [{ keyId: publicKey.keyId, jwk: publicKey.publicJwk }];
serverRecord = null; // Cloud originals have been cleaned: restoration must still work.
await phoneArchive.importInstitutionArchive(JSON.stringify(encrypted), trusted, phoneVault, transferSecret);
const restored = await phoneVault.read(year);
assert.equal(restored.entries[key].confirmed.source, 'institution');
assert.equal(model.statistics(restored, '0000', '9999').absences, 1);
assert.ok(!JSON.stringify(restored).includes('MASSAR'));
await assert.rejects(() => phoneArchive.importInstitutionArchive(JSON.stringify(encrypted), trusted, phoneVault, 'wrong-secret-key'));
const tampered = await transport.encryptArchiveEnvelope({ ...envelope, payload: envelope.payload.replace('confirmed', 'cancelled') }, transferSecret);
await assert.rejects(() => phoneArchive.importInstitutionArchive(JSON.stringify(tampered), trusted, phoneVault, transferSecret));
const otherEnvelope = await signer.sign(JSON.stringify({ ...payload, teacherUserId: identityB.user_id }));
const otherEncrypted = await transport.encryptArchiveEnvelope(otherEnvelope, transferSecret);
await assert.rejects(() => phoneArchive.importInstitutionArchive(JSON.stringify(otherEncrypted), trusted, phoneVault, transferSecret));
await assert.rejects(() => phoneArchive.importInstitutionArchive(JSON.stringify(encrypted), [], phoneVault, transferSecret));
assert.equal((await phoneVault.read(year)).entries[key].confirmed.status, 'confirmed');
console.log('PASS a new phone restores from encrypted signed institution archive after cloud deletion; forged/wrong-account files fail');

// The statistics React component has no cloud dependencies and opens no requests.
const React = uiRequire('react'), renderer = uiRequire('react-test-renderer');
const statisticsComponent = env.load('teacher/TeacherStatistics.tsx').default;
const beforeStats = calls;
let rendered;
await renderer.act(async () => { rendered = renderer.create(React.createElement(statisticsComponent, { data: restored, onOpen() {} })); });
await renderer.act(async () => { rendered.root.findAllByType('select')[0].props.onChange({ target: { value: 'semester1' } }); });
assert.equal(calls, beforeStats);
rendered.unmount();
console.log('PASS opening/changing monthly, semester and yearly statistics makes no Supabase requests');

// Mount the existing TeacherApp and its real PWA hook: reopen offline, open
// statistics, sign out and open another account on the same browser database.
const browserListeners = new Map();
const ui = environment(env.factory, { navigator: { onLine: false },
  window: { addEventListener(name, fn) { browserListeners.set(name, fn); }, removeEventListener(name) { browserListeners.delete(name); } },
  localStorage: { setItem() {} },
});
const TeacherApp = ui.load('teacher/TeacherApp.tsx').default;
let app;
await renderer.act(async () => { app = renderer.create(React.createElement(TeacherApp)); });
const content = () => JSON.stringify(app.toJSON());
const enter = async (login, secret) => {
  await renderer.act(async () => {
    app.root.findAllByType('input').find((input) => input.props.autoComplete === 'username').props.onChange({ target: { value: login } });
    app.root.findAllByType('input').find((input) => input.props.autoComplete === 'off').props.onChange({ target: { value: secret } });
  });
  await renderer.act(async () => { await app.root.findAllByType('button').find((button) => button.children.join('').includes('فتح الأرشيف المحلي دون اتصال')).props.onClick(); });
  // The click intentionally starts an async handler without returning it in JSX.
  // Flush IndexedDB/WebCrypto before inspecting the rendered state.
  for (let i = 0; i < 30 && !content().includes('teacher-header'); i++) {
    await renderer.act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  }
};
offline = true;
await enter('prof-1000a', 'local-secret-Teacher-A');
assert.ok(content().includes('Teacher A'));
const callsBeforeUiStats = calls;
await renderer.act(async () => { app.root.findAllByType('button').find((button) => button.children.join('').includes('إحصائياتي وسجل السنة')).props.onClick(); });
assert.equal(calls, callsBeforeUiStats);
await renderer.act(async () => { await app.root.findAllByType('button').find((button) => button.props['aria-label'] === 'تسجيل الخروج').props.onClick(); });
assert.ok(!content().includes('Synthetic student A'));
await enter('prof-2000b', 'local-secret-Teacher-B');
assert.ok(content().includes('Teacher B'));
assert.ok(!content().includes('Teacher A'));
assert.ok(!content().includes('Synthetic student A'));
app.unmount(); offline = false;
console.log('PASS actual TeacherApp reopens offline and a second login cannot see the first teacher’s archive');

// Exercise service worker code emitted by the actual Vite plugin, not a replica.
const plugin = env.load('scripts/teacher-pwa-plugin.ts').teacherPwa();
let swSource;
plugin.generateBundle.call({ emitFile(value) { swSource = value.source; } }, {}, { 'assets/test.js': {}, 'assets/test.css': {} });
const handlers = {}, cached = new Map(), intercepted = [];
const cache = { async addAll(paths) { paths.forEach((path) => cached.set(path, { url: path })); }, async match(path) { return cached.get(path); } };
vm.runInNewContext(swSource, { URL, setTimeout, clearTimeout, Promise,
  fetch: async () => { throw new Error('Offline'); }, caches: { async open() { return cache; }, async keys() { return []; }, async delete() {} },
  self: { location: { origin: 'https://test.invalid' }, clients: { async claim() {} }, addEventListener(name, handler) { handlers[name] = handler; }, skipWaiting() {} },
});
let installed;
handlers.install({ waitUntil(value) { installed = value; } }); await installed;
handlers.fetch({ request: { method: 'GET', mode: 'navigate', url: 'https://test.invalid/' }, respondWith(value) { intercepted.push(value); } });
assert.equal((await intercepted[0]).url, '/index.html');
handlers.fetch({ request: { method: 'GET', mode: 'cors', url: 'https://example.supabase.co/rest/v1/attendance_marks' }, respondWith() { throw new Error('Auth/API must not be cached'); } });
assert.ok(!swSource.includes('indexedDB.deleteDatabase'));
const manifest = JSON.parse(read('teacher/public/manifest.webmanifest'));
assert.equal(manifest.display, 'standalone');
for (const size of [192, 512]) { const png = readFileSync(join(root, `teacher/public/teacher-${size}.png`)); assert.equal(png.readUInt32BE(16), size); }
console.log('PASS installable PWA shell reopens offline, never caches Supabase/auth and never deletes IndexedDB');

const pg = new PGlite({ extensions: { pgcrypto } });
try {
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE SCHEMA extensions; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;`);
  for (const file of ['20261016010000_create_secure_attendance_portal.sql', '20261016025000_show_full_teacher_timetable.sql',
    '20261016031000_link_attendance_teacher_invites.sql', '20261016032000_sync_attendance_teacher_directory.sql',
    '20261016033000_remove_legacy_teacher_invite_rpc.sql', '20261016034000_fix_attendance_teacher_invites_and_timetable.sql',
    '20261016035000_allow_admin_teacher_reactivation.sql', '20261016040000_simplify_attendance_teacher_credentials.sql']) {
    await pg.exec(read(`supabase/migrations/${file}`));
  }
  await pg.exec(read('supabase/migrations/20261017010000_receive_attendance_once.sql').split('-- Supabase provides pg_cron.')[0]);
  await pg.exec(read('supabase/migrations/20261017020000_teacher_pwa_operations.sql'));
  const admin = randomUUID(), teacher = randomUUID(), directoryTeacher = randomUUID(), foreignTeacher = randomUUID(), institution = randomUUID(), otherInstitution = randomUUID();
  const lessonId = randomUUID(), studentId = randomUUID(), foreignStudent = randomUUID();
  await pg.query('INSERT INTO auth.users (id) VALUES ($1), ($2), ($3)', [admin, teacher, foreignTeacher]);
  await pg.query(`INSERT INTO attendance_profiles (user_id, institution_id, role, display_name, teacher_id) VALUES
    ($1, $4, 'admin', 'Admin', null), ($2, $4, 'teacher', 'Teacher', $6), ($3, $5, 'teacher', 'Foreign', $3)`, [admin, teacher, foreignTeacher, institution, otherInstitution, directoryTeacher]);
  await pg.query('INSERT INTO attendance_teacher_directory (institution_id, teacher_id, display_name) VALUES ($1, $2, $3)', [institution, directoryTeacher, 'Teacher']);
  await pg.query(`INSERT INTO attendance_timetable (id, institution_id, teacher_id, class_name, day_of_week, start_time, end_time)
    VALUES ($1, $2, $3, '1A', attendance_local_day_of_week($2), '08:00', '09:00')`, [lessonId, institution, directoryTeacher]);
  await pg.query("INSERT INTO attendance_students (id, institution_id, class_name, display_name) VALUES ($1, $3, '1A', 'Student'), ($2, $4, '2B', 'Foreign')", [studentId, foreignStudent, institution, otherInstitution]);
  await pg.query("INSERT INTO attendance_settings (institution_id, correction_window_hours, correction_window_from) VALUES ($1, 6, 'submission')", [institution]);
  const login = async (user) => { await pg.exec('RESET ROLE'); await pg.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user]); await pg.exec('SET ROLE authenticated'); };
  const today = (await pg.query('SELECT attendance_local_date($1)::text AS value', [institution])).rows[0].value;
  const submit = async (id, expected = '0', ids = [studentId], day = today) => (await pg.query('SELECT teacher_submit_attendance_operation($1, $2, $3, $4, $5) AS value', [id, lessonId, day, ids, expected])).rows[0].value;
  await login(teacher);
  const op = randomUUID(), accepted = await submit(op);
  assert.equal(accepted.outcome, 'accepted');
  assert.deepEqual(await submit(op), accepted);
  await assert.rejects(() => submit(op, '0', []), (e) => e.code === '42501');
  assert.equal((await submit(randomUUID())).outcome, 'conflict');
  const correction = await submit(randomUUID(), accepted.receipt.revision, []);
  assert.equal(correction.outcome, 'accepted');
  assert.equal((await pg.query('SELECT count(*)::int AS count FROM attendance_marks')).rows[0].count, 0);
  await assert.rejects(() => submit(randomUUID(), correction.receipt.revision, [foreignStudent]));
  await assert.rejects(() => submit(randomUUID(), '0', [], '2024-01-01'), (e) => e.code === '22023');
  const bundle = (await pg.query('SELECT teacher_attendance_bundle() AS value')).rows[0].value;
  assert.equal(bundle.userId, teacher); assert.equal(bundle.sessions.length, 1);
  assert.equal(bundle.sessions[0].absentStudentIds.length, 0);
  await assert.rejects(() => pg.query('SELECT register_attendance_archive_key($1, $2)', [publicKey.keyId, publicKey.publicJwk]), (e) => e.code === '42501');
  await login(admin);
  await pg.query('SELECT register_attendance_archive_key($1, $2)', [publicKey.keyId, publicKey.publicJwk]);
  await assert.rejects(() => pg.query('SELECT register_attendance_archive_key($1, $2)', [randomUUID(), { ...publicKey.publicJwk, d: 'private' }]));
  await login(foreignTeacher);
  assert.equal((await pg.query('SELECT teacher_attendance_bundle() AS value')).rows[0].value.sessions.length, 0);
  await assert.rejects(() => submit(op), (e) => e.code === '42501');
  await assert.rejects(() => pg.query('SELECT cleanup_received_attendance()'), (e) => e.code === '42501');
  await pg.exec('RESET ROLE');
  await pg.query('DELETE FROM attendance_sessions WHERE id = $1', [accepted.receipt.id]); // Synthetic in-memory cleanup only.
  await login(teacher);
  assert.deepEqual(await submit(op), accepted, 'receipt survives original cleanup and never recreates a session');
  assert.equal((await pg.query('SELECT count(*)::int AS count FROM attendance_sessions')).rows[0].count, 0);
  console.log('PASS real SQL: authority, idempotency after cleanup, revisions/conflicts, roster/date checks and scoped archive keys');
} finally { await pg.close(); }
console.log('All teacher PWA tests passed without production access.');
