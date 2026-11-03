// Run: node scripts/test-attendance-local-migration.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const ts = require('typescript');
const initSqlJs = require('sql.js');
const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') });
const read = (file) => readFileSync(join(root, file), 'utf8');
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const disciplineExports = {};
runInNewContext(transpile(read('src/utils/discipline.ts')), { exports: disciplineExports });
const databaseExports = {};
runInNewContext(transpile(read('src/utils/database.ts')), {
  exports: databaseExports, window: {},
  console: { log() {}, error: (...args) => console.error(...args) },
  require(id) {
    if (id === 'sql.js') return { default: initSqlJs };
    if (id.endsWith('.wasm?url')) return { default: require.resolve('sql.js/dist/sql-wasm.wasm') };
    if (id === './discipline') return disciplineExports;
    throw new Error(`Unexpected dependency: ${id}`);
  },
});
const Manager = databaseExports.dbManager.constructor;
const oldDb = new SQL.Database();
oldDb.run(`CREATE TABLE attendance_cloud_links (
  record_type TEXT NOT NULL CHECK (record_type IN ('student', 'teacher')),
  local_ref TEXT NOT NULL, cloud_id TEXT NOT NULL, updatedAt TEXT NOT NULL,
  PRIMARY KEY (record_type, local_ref), UNIQUE (record_type, cloud_id)
);
INSERT INTO attendance_cloud_links VALUES
  ('student', 'local-student', 'cloud-student', '2026-10-15'),
  ('teacher', 'local-teacher', 'cloud-teacher', '2026-10-15');`);
assert.throws(() => oldDb.run("INSERT INTO attendance_cloud_links VALUES ('schedule', 'lesson', 'cloud-lesson', 'now')"), /CHECK constraint failed/);
const oldBytes = oldDb.export();
oldDb.close();

async function initializeFrom(bytes) {
  const manager = new Manager();
  let persisted;
  manager.loadFromIndexedDB = async () => bytes;
  manager.saveDatabase = async () => { persisted = manager.db.export(); };
  await manager.initialize();
  return { manager, getPersisted: () => persisted };
}
const { manager, getPersisted } = await initializeFrom(oldBytes);
assert.deepEqual({ ...await manager.getAttendanceCloudLinks('student') }, { 'local-student': 'cloud-student' });
assert.deepEqual({ ...await manager.getAttendanceCloudLinks('teacher') }, { 'local-teacher': 'cloud-teacher' });
assert.equal(manager.db.exec('SELECT updatedAt FROM attendance_cloud_links LIMIT 1')[0].values[0][0], '2026-10-15');
await manager.saveAttendanceCloudLinks('schedule', [{ localRef: 'lesson', cloudId: 'cloud-lesson' }]);
await manager.saveAttendanceCloudLinks('schedule', [{ localRef: 'lesson', cloudId: 'updated-cloud-lesson' }]);
assert.deepEqual({ ...await manager.getAttendanceCloudLinks('schedule') }, { lesson: 'updated-cloud-lesson' });
await assert.rejects(() => manager.saveAttendanceCloudLinks('invalid', [{ localRef: 'bad', cloudId: 'bad' }]), /CHECK constraint failed/);
await assert.rejects(() => manager.saveAttendanceCloudLinks('schedule', [{ localRef: 'duplicate', cloudId: 'updated-cloud-lesson' }]), /UNIQUE constraint failed/);
assert.equal(manager.db.exec('SELECT count(*) FROM attendance_cloud_links')[0].values[0][0], 3);
console.log('PASS: old SQLite database upgrades and retains all IDs and timestamps; schedule saves and constraints remain enforced');

const reopened = (await initializeFrom(getPersisted())).manager;
assert.deepEqual({ ...await reopened.getAttendanceCloudLinks('schedule') }, { lesson: 'updated-cloud-lesson' });
await reopened.createTables();
assert.equal(reopened.db.exec('SELECT count(*) FROM attendance_cloud_links')[0].values[0][0], 3);
const fresh = (await initializeFrom(null)).manager;
await fresh.saveAttendanceCloudLinks('schedule', [{ localRef: 'fresh', cloudId: 'fresh-cloud' }]);
assert.equal((await fresh.getAttendanceCloudLinks('schedule')).fresh, 'fresh-cloud');
console.log('PASS: saved migration survives reopening, rerunning initialization, and fresh database creation');

const failureDb = new SQL.Database(oldBytes);
const failingManager = new Manager();
failingManager.db = {
  exec: (...args) => failureDb.exec(...args),
  run(sql, ...args) {
    if (sql.startsWith('INSERT INTO attendance_cloud_links_migrated')) throw new Error('Simulated copy failure');
    return failureDb.run(sql, ...args);
  },
};
assert.throws(() => failingManager.migrateAttendanceCloudLinks(), /Simulated copy failure/);
assert.equal(failureDb.exec('SELECT count(*) FROM attendance_cloud_links')[0].values[0][0], 2);
assert.equal(failureDb.exec("SELECT count(*) FROM sqlite_master WHERE name = 'attendance_cloud_links_migrated'")[0].values[0][0], 0);
assert.throws(() => failureDb.run("INSERT INTO attendance_cloud_links VALUES ('schedule', 'lesson', 'cloud-lesson', 'now')"), /CHECK constraint failed/);
console.log('PASS: failed migration rolls back without losing existing links');
for (const db of [manager.db, reopened.db, fresh.db, failureDb]) db.close();