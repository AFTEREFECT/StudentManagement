// Run with node scripts/test-attendance-access.mjs. Uses temporary UI test dependencies.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const testRequire = createRequire(join(process.env.ATTENDANCE_TEST_DEPS || join(tmpdir(), 'progtalamid-attendance-check'), 'package.json'));
const React = testRequire('react');
const renderer = testRequire('react-test-renderer');
const read = path => readFileSync(join(root, path), 'utf8');
const transpile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
function module(source, context = {}) {
  const exports = {};
  vm.runInNewContext(transpile(source), { exports, console, ...context });
  return exports;
}
const identity = module(read('supabase/functions/_shared/attendanceIdentity.ts'));
for (const input of ['cba8eb8be543', 'teacher-cba8eb8be543', ' TEACHER-CBA8EB8BE543 ', '\u200fcba8eb8be543\u200e', 'teacher-cba8eb8be543@attendance.progtalamid.invalid']) {
  assert.equal(identity.normalizeAttendanceUsername(input), 'teacher-cba8eb8be543');
  assert.equal(identity.attendanceLoginEmail(input), 'teacher-cba8eb8be543@attendance.progtalamid.invalid');
}
assert.equal(identity.attendanceLoginEmail('Admin@Example.com'), 'admin@example.com');
const configSource = read('src/utils/attendanceTestConfig.ts').replaceAll('import.meta.env', 'testEnv');
const enabled = (env, hostname = 'example.com') => module(configSource, { testEnv: env, window: { location: { hostname, protocol: 'https:' } } }).attendanceTestModeEnabled;
assert.equal(enabled({ DEV: true }), true);
assert.equal(enabled({ DEV: false }), false);
assert.equal(enabled({ DEV: true, VITE_ATTENDANCE_TEST_MODE: 'false' }, 'localhost'), false);
assert.equal(enabled({ DEV: false, VITE_ATTENDANCE_TEST_MODE: 'true' }), true);
console.log('PASS: short teacher IDs, full usernames, email and Arabic copy marks normalize consistently; test mode can be disabled');

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}
let storage = new MemoryStorage();
const sandboxWindow = { localStorage: storage };
let sample = false;
const dbManager = {
  async initialize() {},
  async getAttendanceTeacherRoster() { return [{ nationalId: 'ab 1', displayName: 'أستاذ محلي' }]; },
  async getAllTimetable() { return sample ? [] : [{ id: 'L1', teacher_id: 'AB1', class: '1A', subject_code: 'math', day: 'Sunday', time_slot: 'H1' }]; },
  async getStudents() { return [{ id: 'S1', firstName: 'تلميذ', lastName: 'محلي', section: '1A' }, { id: 'S2', firstName: 'قسم آخر', section: '2A' }]; },
  async getAttendanceSubjectMappings() { return { math: 'الرياضيات' }; },
};
let networkCalls = 0;
const sandbox = module(read('src/utils/attendanceSandbox.ts'), {
  window: sandboxWindow,
  fetch() { networkCalls++; throw new Error('Test mode must not use the network'); },
  require(id) { assert.equal(id, './database'); return { dbManager }; },
});
const data = await sandbox.loadAttendanceTestData();
assert.equal(data.sample, false);
assert.equal(data.lessons[0].teacherId, 'AB1');
assert.equal(data.lessons[0].subject, 'الرياضيات');
let records = sandbox.saveTestAttendance(data, 'L1', '2020-01-01', ['S1'], storage);
assert.equal(records[0].absentNames[0], 'تلميذ محلي');
records = sandbox.reviewTestAttendance(records[0].id, 'confirmed', storage);
assert.equal(records[0].status, 'confirmed');
records = sandbox.saveTestAttendance(data, 'L1', '2020-01-01', [], storage);
assert.equal(records.length, 1);
assert.equal(records[0].status, 'submitted');
assert.equal(records[0].absentIds.length, 0);
assert.throws(() => sandbox.saveTestAttendance(data, 'L1', '2020-01-01', ['S2'], storage), /خارج/);
assert.equal(sandbox.readTestRecords(storage).length, 1);
const failureStorage = { getItem: () => null, setItem() { throw new Error('storage full'); } };
assert.throws(() => sandbox.saveTestAttendance(data, 'L1', '2020-01-01', ['S1'], failureStorage), /storage full/);
sample = true;
assert.equal((await sandbox.loadAttendanceTestData()).sample, true);
sample = false;
console.log('PASS: local timetable and roster load; any date and post-review edits work; records persist without touching other classes or cloud data');

storage = new MemoryStorage(); sandboxWindow.localStorage = storage;
const errors = module(read('src/utils/attendanceErrors.ts'));
const component = module(read('src/components/AttendanceTestPortal.tsx'), {
  window: sandboxWindow,
  require(id) {
    if (id === 'react') return { ...React, default: React };
    if (id === '../utils/attendanceSandbox') return sandbox;
    if (id === '../utils/attendanceErrors') return errors;
    throw new Error(`Unexpected UI dependency: ${id}`);
  },
}).default;
const portalAst = ts.createSourceFile('AttendancePortal.tsx', read('src/components/AttendancePortal.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let entryInitializer;
for (const statement of portalAst.statements) {
  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(portalAst) === 'AttendancePortal') entryInitializer = declaration.initializer.getText(portalAst);
    }
  }
}
assert.ok(entryInitializer);
const entry = module(`export const Entry = ${entryInitializer};`, {
  React, useState: React.useState, attendanceTestModeEnabled: true,
  URLSearchParams, window: { location: { search: '' } },
  AttendanceTestPortal: component,
  CloudAttendancePortal: () => React.createElement('p', null, 'Cloud login'),
}).Entry;
let view;
await renderer.act(async () => { view = renderer.create(React.createElement(entry)); });
function label(node) { return node.children.map(child => typeof child === 'string' ? child : label(child)).join(''); }
function button(text) { return view.root.findAllByType('button').find(node => label(node).includes(text)); }
assert.ok(button('دخول الاختبار دون كلمة مرور'));
await renderer.act(async () => { button('دخول الاختبار دون كلمة مرور').props.onClick(); });
assert.ok(button('تلميذ محلي'));
assert.equal(view.root.findAllByType('input').filter(node => node.props.type === 'password').length, 0);
await renderer.act(async () => { button('تلميذ محلي').props.onClick(); });
await renderer.act(async () => { button('حفظ الغياب التجريبي').props.onClick(); });
assert.equal(sandbox.readTestRecords(storage)[0].absentIds[0], 'S1');
await renderer.act(async () => { button('واجهة الإدارة والمراجعة').props.onClick(); });
await renderer.act(async () => { button('اعتماد').props.onClick(); });
assert.equal(sandbox.readTestRecords(storage)[0].status, 'confirmed');
await renderer.act(async () => { button('واجهة الأستاذ').props.onClick(); });
await renderer.act(async () => { button('تعيين الجميع حاضرين').props.onClick(); });
await renderer.act(async () => { button('حفظ الغياب التجريبي').props.onClick(); });
assert.equal(sandbox.readTestRecords(storage)[0].absentIds.length, 0);
await renderer.act(async () => { button('الخروج من الاختبار').props.onClick(); });
assert.ok(button('دخول الاختبار دون كلمة مرور'));
assert.equal(networkCalls, 0);
view.unmount();
console.log('PASS: actual React entry, teacher marking, local save, admin review, unrestricted correction and exit work without passwords or network calls');
