// Run with node scripts/test-attendance-fixes.mjs. Install @electric-sql/pglite
// into ATTENDANCE_TEST_DEPS or the temporary progtalamid-attendance-check folder.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const testRequire = createRequire(join(process.env.ATTENDANCE_TEST_DEPS || join(tmpdir(), 'progtalamid-attendance-check'), 'package.json'));
const { PGlite } = testRequire('@electric-sql/pglite');
const { pgcrypto } = testRequire('@electric-sql/pglite/contrib/pgcrypto');
const ts = require('typescript');
const read = (path) => readFileSync(join(root, path), 'utf8');
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const errorExports = {};
runInNewContext(transpile(read('src/utils/attendanceErrors.ts')), { exports: errorExports });
const { getAttendanceErrorMessage } = errorExports;
assert.equal(getAttendanceErrorMessage({ message: 'foreign key violation', code: '23503' }, 'fallback'), 'foreign key violation');
assert.equal(getAttendanceErrorMessage(new Error('network failed'), 'fallback'), 'network failed');
for (const error of [null, undefined, {}, { message: '' }, { message: 12 }]) {
  assert.equal(getAttendanceErrorMessage(error, 'fallback'), 'fallback');
}
console.log('PASS: plain PostgREST errors retain their messages');

// Exercise the actual publish handler with local data and a fake network client.
const portal = ts.createSourceFile('AttendancePortal.tsx', read('src/components/AttendancePortal.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let publisher;
let dayFunction;
let normalizeFunction;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(portal) === 'publishTimetable') publisher = node.initializer.getText(portal);
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'localDayOfWeek') dayFunction = node.getText(portal);
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'normalizeTeacherNationalId') normalizeFunction = node.getText(portal);
  ts.forEachChild(node, visit);
}
visit(portal);
assert.ok(publisher && dayFunction);
const institution = randomUUID();
const teacherId = randomUUID();
const lessonId = randomUUID();
let uploads = [];
let announcements = [];
let uploadError = null;
let linkSaveError = null;
let linksPersisted = false;
const context = {
  exports: {}, crypto: { randomUUID }, getAttendanceErrorMessage,
  profile: { institution_id: institution },
  setWorking() {}, setError() {}, setSyncMessage() {},
  announceError: (message) => announcements.push(message),
  dbManager: {
    async initialize() {},
    async getAllTimetable() { return [{ id: 'local', teacher_id: 'AB123', day: 'Sunday', class: '1A', start_time: '08:00', end_time: '09:00' }]; },
    async getAttendanceCloudLinks(kind) { return kind === 'teacher' ? { AB123: teacherId } : { local: lessonId }; },
    async getAttendanceSubjectMappings() { return {}; },
    async saveAttendanceCloudLinks() {
      if (linkSaveError) throw linkSaveError;
      linksPersisted = true;
    },
  },
  attendanceCloud: {
    from(table) {
      return {
        select() {
          return {
            async in() { return { data: [], error: null }; },
            async eq() { return { data: [], error: null }; },
          };
        },
        async upsert(rows) { assert.ok(linksPersisted, 'Lesson IDs must be saved before cloud writes'); uploads.push({ table, rows }); return { error: uploadError }; },
      };
    },
  },
};
runInNewContext(transpile(`${dayFunction}\n${normalizeFunction}\nconst publishTimetable = ${publisher};\nexports.publishTimetable = publishTimetable;`), context);
await context.exports.publishTimetable();
assert.equal(announcements.length, 0);
assert.equal(uploads.length, 1);
assert.equal(uploads[0].rows[0].day_of_week, 0);
assert.equal(uploads[0].rows[0].active, true);
assert.equal(uploads[0].rows[0].id, lessonId);
uploadError = { message: 'database rejected timetable', code: '23503' };
await context.exports.publishTimetable();
assert.equal(announcements.at(-1), uploadError.message);
console.log('PASS: Sunday is published and database errors reach the UI');
const previousUploadCount = uploads.length;
linksPersisted = false;
linkSaveError = new Error('local persistence failed');
await context.exports.publishTimetable();
assert.equal(uploads.length, previousUploadCount);
assert.equal(announcements.at(-1), linkSaveError.message);
console.log('PASS: failed local ID persistence prevents cloud writes');

const db = new PGlite({ extensions: { pgcrypto } });
try {
  // Supabase supplies these auth objects and default grants in production.
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE SCHEMA extensions;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
  `);
  for (const name of [
    '20261016010000_create_secure_attendance_portal.sql',
    '20261016025000_show_full_teacher_timetable.sql',
    '20261016031000_link_attendance_teacher_invites.sql',
    '20261016032000_sync_attendance_teacher_directory.sql',
    '20261016033000_remove_legacy_teacher_invite_rpc.sql',
  ]) await db.exec(read(`supabase/migrations/${name}`));

  const adminId = randomUUID();
  const teacherUserId = randomUUID();
  const otherInstitution = randomUUID();
  const otherTeacher = randomUUID();
  const legacyTeacher = randomUUID();
  await db.query('INSERT INTO auth.users (id) VALUES ($1), ($2)', [adminId, teacherUserId]);
  await db.query("INSERT INTO attendance_profiles (user_id, institution_id, role, display_name) VALUES ($1, $2, 'admin', 'Admin')", [adminId, institution]);
  await db.query('INSERT INTO attendance_teacher_directory (institution_id, teacher_id, display_name) VALUES ($1, $2, $3)', [institution, teacherId, 'Imported teacher']);
  await db.query("INSERT INTO attendance_teacher_invites (institution_id, teacher_id, username, display_name, code_hash) VALUES ($1, $2, 'teacher-aaaaaaaaaaaa', 'Legacy teacher', 'hash')", [institution, legacyTeacher]);
  await db.query("INSERT INTO attendance_timetable (id, institution_id, teacher_id, class_name, day_of_week, start_time, end_time) VALUES ($1, $2, $3, 'Legacy class', 1, '08:00', '09:00')", [randomUUID(), institution, legacyTeacher]);
  const publish = () => db.query("INSERT INTO attendance_timetable (id, institution_id, teacher_id, class_name, day_of_week, start_time, end_time) VALUES ($1, $2, $3, '1A', 0, '08:00', '09:00')", [lessonId, institution, teacherId]);
  const invite = () => db.query("SELECT * FROM create_attendance_teacher_invite($1, 'Imported teacher')", [teacherId]);
  const login = async (id) => {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]);
    await db.exec('SET ROLE authenticated');
  };
  await login(adminId);
  await assert.rejects(invite, (error) => error.code === '42702');
  await assert.rejects(publish, (error) => error.code === '23503');
  console.log('PASS: reproduced both original SQL failures (42702 and 23503)');

  await db.exec('RESET ROLE');
  const fix = read('supabase/migrations/20261016034000_fix_attendance_teacher_invites_and_timetable.sql');
  await db.exec(fix);
  const legacy = await db.query('SELECT teacher_id FROM attendance_teacher_directory WHERE teacher_id = $1', [legacyTeacher]);
  assert.equal(legacy.rows.length, 1);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM attendance_timetable')).rows[0].count, 1);
  await login(adminId);
  await publish();
  assert.equal((await db.query('SELECT count(*)::int AS count FROM attendance_teacher_invites WHERE teacher_id = $1', [teacherId])).rows[0].count, 0);
  console.log('PASS: timetable publishes before any invitation exists; legacy lessons survive');

  const first = (await invite()).rows[0];
  assert.equal(first.teacher_id, teacherId);
  assert.match(first.username, /^teacher-[a-f0-9]{12}$/);
  assert.match(first.activation_code, /^[A-F0-9]{16}$/);
  const stored = (await db.query('SELECT code_hash FROM attendance_teacher_invites WHERE teacher_id = $1', [teacherId])).rows[0];
  assert.equal(stored.code_hash, createHash('sha256').update(first.activation_code).digest('hex'));
  // A stale directory username must not replace the actual invite's username.
  await db.query("UPDATE attendance_teacher_directory SET username = 'teacher-bbbbbbbbbbbb' WHERE teacher_id = $1", [teacherId]);
  const renewed = (await invite()).rows[0];
  assert.equal(renewed.username, first.username);
  assert.notEqual(renewed.activation_code, first.activation_code);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM attendance_teacher_invites WHERE teacher_id = $1', [teacherId])).rows[0].count, 1);
  console.log('PASS: invitations create and renew with correct hashes and stable usernames');

  await db.exec('RESET ROLE');
  await db.query('INSERT INTO attendance_teacher_directory (institution_id, teacher_id, display_name) VALUES ($1, $2, $3)', [otherInstitution, otherTeacher, 'Other institution']);
  await login(adminId);
  await assert.rejects(() => db.query("INSERT INTO attendance_timetable (id, institution_id, teacher_id, class_name, day_of_week, start_time, end_time) VALUES ($1, $2, $3, 'Forbidden', 1, '08:00', '09:00')", [randomUUID(), institution, otherTeacher]), (error) => error.code === '23503');
  await db.exec('RESET ROLE');
  await db.query("INSERT INTO attendance_profiles (user_id, institution_id, teacher_id, role, display_name) VALUES ($1, $2, $3, 'teacher', 'Teacher')", [teacherUserId, institution, teacherId]);
  // Even with stale directory activation state, an activated profile is protected.
  await login(adminId);
  await assert.rejects(invite, /already activated/);
  await login(teacherUserId);
  await assert.rejects(invite, /Only institution administrators/);
  const visible = await db.query('SELECT id FROM attendance_timetable');
  assert.deepEqual(visible.rows.map((row) => row.id), [lessonId]);
  await db.exec('RESET ROLE; SET ROLE anon');
  await assert.rejects(invite, (error) => error.code === '42501');
  await db.exec('RESET ROLE');
  await db.exec(fix);
  assert.ok((await db.query('SELECT activated_at FROM attendance_teacher_directory WHERE teacher_id = $1', [teacherId])).rows[0].activated_at);
  console.log('PASS: institution isolation, teacher read access, activated-account protection, and migration reapplication');

  await db.exec(read('supabase/migrations/20261016035000_allow_admin_teacher_reactivation.sql'));
  await login(adminId);
  const reset = (await db.query('SELECT * FROM reissue_attendance_teacher_invite($1)', [teacherId])).rows[0];
  assert.equal(reset.teacher_id, teacherId);
  assert.equal(reset.username, first.username);
  assert.match(reset.activation_code, /^[A-F0-9]{16}$/);
  const resetInvite = (await db.query('SELECT claimed_at, code_hash FROM attendance_teacher_invites WHERE teacher_id = $1', [teacherId])).rows[0];
  assert.equal(resetInvite.claimed_at, null);
  assert.equal(resetInvite.code_hash, createHash('sha256').update(reset.activation_code).digest('hex'));
  assert.equal((await db.query('SELECT user_id FROM attendance_profiles WHERE teacher_id = $1', [teacherId])).rows[0].user_id, teacherUserId);
  assert.equal((await db.query('SELECT id FROM attendance_timetable WHERE teacher_id = $1', [teacherId])).rows[0].id, lessonId);
  await assert.rejects(() => db.query('SELECT * FROM reissue_attendance_teacher_invite($1)', [otherTeacher]), /Teacher not found in this institution/);
  await login(teacherUserId);
  await assert.rejects(() => db.query('SELECT * FROM reissue_attendance_teacher_invite($1)', [teacherId]), /Only institution administrators/);
  await db.exec('RESET ROLE; SET ROLE anon');
  await assert.rejects(() => db.query('SELECT * FROM reissue_attendance_teacher_invite($1)', [teacherId]), error => error.code === '42501');
  await db.exec('RESET ROLE');
  console.log('PASS: admins can reissue an activated teacher code; existing accounts and lessons survive; teacher, anonymous and foreign-institution requests are denied');

} finally {
  await db.close();
}