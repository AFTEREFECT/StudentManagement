// Offline only: Web Crypto, in-memory SQLite/storage, no cloud accounts or emails.
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import TestRenderer, { act } from 'react-test-renderer';

const require = createRequire(import.meta.url);
const transpile = file => ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exports = {};
vm.runInNewContext(transpile('src/utils/localAdminAuth.ts'), { exports, TextEncoder, Uint8Array, Error, crypto: webcrypto });
const { createLocalAdminAuth } = exports;
const teacherImportModule = {};
vm.runInNewContext(transpile('src/utils/teacherAssignmentImport.ts'), { exports: teacherImportModule });
const { mapTeacherAssignmentRows, teacherAssignmentTemplateHeaders } = teacherImportModule;
const mappedTeacherRows = mapTeacherAssignmentRows([
  {
    '\uFEFF اسم الأستاذ بالعربية ': 'أحمد محمد',
    'معرف الأستاذ': 'JA00123',
    'القسم الدراسي': '1APIC-2',
    'رمز المادة': '0013',
    'المادة بالعربية': 'اللغة الإنجليزية',
  },
  { teacherFrench: 'Autre Prof', teacherId: 'JA00456', className: '2APIC-1' },
  { teacherArabic: 'صف ناقص', teacherId: 'JA00789' },
]);
assert.equal(mappedTeacherRows.assignments.length, 2);
assert.equal(mappedTeacherRows.assignments[0].teacher_id, 'JA00123');
assert.equal(mappedTeacherRows.assignments[0].subject_code, '0013');
assert.equal(mappedTeacherRows.assignments[1].teacher_french, 'Autre Prof');
assert.equal(mappedTeacherRows.skippedRows, 1);
assert.ok(teacherAssignmentTemplateHeaders.includes('معرف الأستاذ'));
assert.ok(teacherAssignmentTemplateHeaders.includes('القسم'));
assert.throws(
  () => mapTeacherAssignmentRows([{ 'اسم الأستاذ': 'بدون معرف أو قسم' }]),
  /عمودي "معرف الأستاذ" و"القسم" على الأقل/,
);
console.log('PASS: teacher assignment template headers, Arabic/English aliases, required-field validation and helpful empty-import error');
function memoryStore() {
  return {
    raw: null, fail: false,
    async readLocalAdmin() { return this.raw; },
    async writeLocalAdmin(next, expected) {
      if (this.fail) throw new Error('disk full');
      assert.equal(this.raw, expected, 'credential writes must use expected record');
      this.raw = next;
    },
  };
}
async function hash(value, salt) {
  const key = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(value), 'PBKDF2', false, ['deriveBits']);
  return Buffer.from(await webcrypto.subtle.deriveBits({ name: 'PBKDF2', salt: Buffer.from(salt, 'hex'), iterations: 210_000, hash: 'SHA-256' }, key, 256)).toString('hex');
}
async function legacyRecord() {
  const passwordSalt = '0102030405060708090a0b0c0d0e0f10';
  const recoverySalt = '1112131415161718191a1b1c1d1e1f20';
  return JSON.stringify({
    version: 1, institutionName: 'المؤسسة القديمة', installationId: 'legacy-install',
    username: 'admin', passwordSalt, passwordHash: await hash('old-password', passwordSalt),
    recoverySalt, recoveryHash: await hash('ABCDEF0123456789', recoverySalt),
    iterations: 210_000, revision: 1, failedAttempts: 0, lockedUntil: 0,
  });
}
const store = memoryStore();
let time = Date.now();
const auth = createLocalAdminAuth(store, webcrypto, () => time);
assert.equal(await auth.info(), null);
const firstCredentials = await auth.setup('المؤسسة الأولى', 'Ab3Xy7');
assert.equal(firstCredentials.accessCode, 'AB3XY7');
assert.match(firstCredentials.recoveryCode, /^([A-F0-9]{4}-){7}[A-F0-9]{4}$/);
assert.ok(!store.raw.includes(firstCredentials.accessCode));
assert.ok(!store.raw.includes(firstCredentials.recoveryCode.replaceAll('-', '')));
assert.equal(JSON.parse(store.raw).version, 2);
const backup = store.raw;
await assert.rejects(auth.setup('مؤسسة أخرى', '123456'), /موجود مسبقًا/);
const invalidSetupAuth = createLocalAdminAuth(memoryStore(), webcrypto);
await assert.rejects(invalidSetupAuth.setup('مؤسسة', 'AB-1234'), /6 أحرف/);
await assert.rejects(invalidSetupAuth.setup('مؤسسة', '12345'), /6 أحرف/);
await auth.login('ab3xy7');
for (let i = 0; i < 5; i++) await assert.rejects(auth.login('BAD123'), /غير صحيح/);
await assert.rejects(auth.login('AB3XY7'), /محاولات كثيرة/);
await assert.rejects(auth.replaceAccessCode(firstCredentials.recoveryCode, 'CD4EF8', true), /محاولات كثيرة/);
time += 61_000;
await auth.login('AB3XY7');
assert.equal(JSON.parse(store.raw).failedAttempts, 0);
await assert.rejects(auth.replaceAccessCode('wrong-code', 'CD4EF8', true), /غير صحيح/);
const secondCredentials = await auth.replaceAccessCode(firstCredentials.recoveryCode.toLowerCase().replaceAll('-', ' '), 'CD4EF8', true);
assert.equal(secondCredentials.accessCode, 'CD4EF8');
await auth.verifyRecovery(secondCredentials.recoveryCode);
await assert.rejects(auth.verifyRecovery(firstCredentials.recoveryCode), /غير صحيح/);
await assert.rejects(auth.login('AB3XY7'), /غير صحيح/);
await auth.login('CD4EF8');
await assert.rejects(auth.replaceAccessCode(firstCredentials.recoveryCode, 'EF5GH9', true), /غير صحيح/);
const thirdCredentials = await auth.replaceAccessCode('CD4EF8', 'EF5GH9', false);
assert.equal(thirdCredentials.accessCode, 'EF5GH9');
const reopened = createLocalAdminAuth(store, webcrypto, () => time);
await reopened.login('EF5GH9');
const beforeFailure = store.raw;
store.fail = true;
await assert.rejects(auth.replaceAccessCode('EF5GH9', 'UV8WX2', false), /disk full/);
assert.equal(store.raw, beforeFailure);
store.fail = false;
await reopened.login('EF5GH9');
const otherStore = memoryStore();
const other = createLocalAdminAuth(otherStore, webcrypto);
await other.setup('المؤسسة الثانية', 'EF5GH9');
await assert.rejects(other.replaceAccessCode('EF5GH9', 'GH6JK2', true), /غير صحيح/);
await other.login('EF5GH9');
store.raw = backup;
await reopened.login('AB3XY7');
assert.equal((await reopened.info()).institutionName, 'المؤسسة الأولى');
const oldStore = memoryStore();
oldStore.raw = await legacyRecord();
const oldAuth = createLocalAdminAuth(oldStore, webcrypto, () => time);
assert.equal((await oldAuth.info()).needsUpgrade, true);
await assert.rejects(oldAuth.upgrade('old-password', 'not-six'), /6 أحرف/);
const migratedCredentials = await oldAuth.upgrade('old-password', 'JK7LM3');
assert.equal(migratedCredentials.accessCode, 'JK7LM3');
assert.equal(JSON.parse(oldStore.raw).version, 2);
await oldAuth.login('JK7LM3');
const recoveryUpgradeStore = memoryStore();
recoveryUpgradeStore.raw = await legacyRecord();
const recoveryUpgrade = await createLocalAdminAuth(recoveryUpgradeStore, webcrypto).upgrade('ABCD-EF01-2345-6789', 'LM5NP7', true);
assert.equal(recoveryUpgrade.accessCode, 'LM5NP7');
assert.equal(JSON.parse(recoveryUpgradeStore.raw).version, 2);
const generatedStore = memoryStore();
const generated = await createLocalAdminAuth(generatedStore, webcrypto).setup('مؤسسة', undefined);
assert.match(generated.accessCode, /^[A-HJ-NP-Z2-9]{6}$/);
assert.match(generated.recoveryCode, /^([A-F0-9]{4}-){7}[A-F0-9]{4}$/);
store.raw = '{broken';
await assert.rejects(reopened.info(), /تالفة/);
await assert.rejects(reopened.setup('مؤسسة', 'AB1CD2'), /تالفة/);
const unavailable = createLocalAdminAuth(memoryStore(), {});
await assert.rejects(unavailable.setup('مؤسسة', 'AB1CD2'), /localhost/);

// Exercise the real database schema, backups and persistence rollback.
const initSqlJs = require('sql.js');
const discipline = {};
vm.runInNewContext(transpile('src/utils/discipline.ts'), { exports: discipline });
const database = {};
const localValues = new Map();
vm.runInNewContext(transpile('src/utils/database.ts'), {
  exports: database, window: {}, crypto: webcrypto, Uint8Array,
  localStorage: { getItem: key => localValues.get(key) ?? null, setItem: (key, value) => localValues.set(key, value) },
  console: { log() {}, warn() {}, error() {} },
  require(id) {
    if (id === 'sql.js') return { default: initSqlJs };
    if (id.endsWith('.wasm?url')) return { default: require.resolve('sql.js/dist/sql-wasm.wasm') };
    if (id === './discipline') return discipline;
    throw new Error(`Unexpected dependency ${id}`);
  },
});
const Manager = database.dbManager.constructor;
async function makeDatabase(initial = null) {
  const manager = new Manager();
  let persisted = initial;
  let failOnce = false;
  manager.loadFromIndexedDB = async () => persisted;
  manager.saveToIndexedDB = async data => {
    if (failOnce) { failOnce = false; throw new Error('simulated persistence failure'); }
    persisted = data;
  };
  await manager.initialize();
  return { manager, persisted: () => persisted, failNext: () => { failOnce = true; } };
}
const db = await makeDatabase();
assert.equal(await db.manager.readLocalAdmin(), null);
await db.manager.writeLocalAdmin(backup, null);
assert.equal(await db.manager.readLocalAdmin(), backup);
await assert.rejects(db.manager.writeLocalAdmin('stale-write', null), /تغيرت/);
db.failNext();
await assert.rejects(db.manager.writeLocalAdmin('replacement', backup), /persistence failure/);
assert.equal(await db.manager.readLocalAdmin(), backup);
const diskCopy = await makeDatabase(db.persisted());
assert.equal(await diskCopy.manager.readLocalAdmin(), backup);
const exported = await db.manager.exportData();
await diskCopy.manager.importData(exported);
assert.equal(await diskCopy.manager.readLocalAdmin(), backup);
console.log('PASS: six-character setup/login, hashing, rate limit, recovery/reset, code change, legacy migration, reopen, institution isolation, corruption, crypto availability, persistence rollback and SQLite backup/restore');

// Mount the actual gate: children stay unmounted until a six-character code verifies.
const uiStore = Object.assign(memoryStore(), { async getInstitutionSettings() { return { institution: 'مؤسسة الاختبار' }; } });
const gateModule = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/components/LocalAdminGate.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText, {
  exports: gateModule, Error,
  window: { location: { port: '8580', hostname: '192.168.1.20', pathname: '/', search: '', hash: '' }, reload() {} },
  require(id) {
    if (id === 'react') return React;
    if (id === 'react/jsx-runtime') return jsxRuntime;
    if (id === '../utils/database') return { dbManager: uiStore };
    if (id === '../utils/localAdminAuth') return exports;
    throw new Error(`Unexpected dependency ${id}`);
  },
});
const Gate = gateModule.default;
let tree;
const mount = async () => { await act(async () => { tree = TestRenderer.create(React.createElement(Gate, null, React.createElement('div', { id: 'protected' }, 'private data'))); }); };
const protectedVisible = () => tree.root.findAllByProps({ id: 'protected' }).length > 0;
const fill = async values => { await act(async () => { tree.root.findAllByType('input').forEach((input, i) => { if (values[i] !== undefined) input.props.onChange({ target: { value: values[i] } }); }); }); };
const submit = async () => { await act(async () => { await tree.root.findByType('form').props.onSubmit({ preventDefault() {} }); }); };
const textOf = node => typeof node === 'string' ? node : node.children.map(textOf).join('');
const click = async label => { await act(async () => { tree.root.findAllByType('button').find(button => textOf(button).includes(label)).props.onClick(); }); };
await mount();
assert.equal(protectedVisible(), false);
await act(async () => { tree.root.findAllByProps({ type: 'radio' })[1].props.onChange(); });
await fill(['مؤسسة الاختبار', undefined, undefined, 'ABC123', 'ABC124']);
await submit();
assert.equal(protectedVisible(), false);
assert.ok(tree.root.findAllByProps({ role: 'alert' }).some(alert => textOf(alert).includes('غير متطابق')));
await fill([undefined, undefined, undefined, undefined, 'ABC123']);
await submit();
assert.equal(protectedVisible(), false);
const continueButton = tree.root.findAllByType('button').find(button => textOf(button) === 'حفظ الرمز والدخول إلى البرنامج');
assert.equal(continueButton.props.disabled, true);
let displayedAccessCode = tree.root.findAllByType('p').map(p => p.children.join('')).find(value => /^[A-Z0-9]{6}$/.test(value));
let displayedRecoveryCode = tree.root.findAllByType('p').map(p => p.children.join('')).find(value => /^([A-F0-9]{4}-){7}[A-F0-9]{4}$/.test(value));
assert.equal(displayedAccessCode, 'ABC123');
assert.ok(displayedRecoveryCode);
await act(async () => { tree.root.findByProps({ type: 'checkbox' }).props.onChange({ target: { checked: true } }); });
await click('حفظ الرمز والدخول إلى البرنامج');
assert.equal(protectedVisible(), true);
await click('قفل البرنامج');
await fill(['BAD123']);
await submit();
assert.equal(protectedVisible(), false);
await fill([displayedAccessCode.toLowerCase()]);
await submit();
assert.equal(protectedVisible(), true);
await click('قفل البرنامج');
assert.equal(protectedVisible(), false);
await click('نسيت رمز الدخول؟ إعادة تعيينه');
await fill(['incorrect-recovery-code']);
await submit();
assert.equal(protectedVisible(), false);
await fill([displayedRecoveryCode]);
await submit();
assert.equal(protectedVisible(), false);
await submit();
assert.equal(protectedVisible(), false);
assert.equal(tree.root.findAllByProps({ type: 'checkbox' }).length, 1);
displayedAccessCode = tree.root.findAllByType('p').map(p => p.children.join('')).find(value => /^[A-Z0-9]{6}$/.test(value));
displayedRecoveryCode = tree.root.findAllByType('p').map(p => p.children.join('')).find(value => /^([A-F0-9]{4}-){7}[A-F0-9]{4}$/.test(value));
assert.ok(displayedAccessCode);
assert.ok(displayedRecoveryCode);
await act(async () => { tree.root.findByProps({ type: 'checkbox' }).props.onChange({ target: { checked: true } }); });
await click('حفظ الرمز والدخول إلى البرنامج');
assert.equal(protectedVisible(), true, 'verified recovery should resume the application');
await act(async () => tree.unmount());
await mount();
assert.equal(protectedVisible(), false, 'reopening must require login');
await fill([displayedAccessCode]);
await submit();
assert.equal(protectedVisible(), true);
await act(async () => tree.unmount());
console.log('PASS: setup/code acknowledgement, protected-screen gate, failed login, unlock, lock, UI recovery/reset and reload');
uiStore.raw = await legacyRecord();
await mount();
assert.ok(textOf(tree.root.findByType('h1')).includes('تحديث الدخول'));
await fill(['wrong-old-password']);
await submit();
assert.ok(tree.root.findAllByProps({ role: 'alert' }).some(alert => textOf(alert).includes('كلمة المرور القديمة غير صحيحة')));
await click('نسيت كلمة المرور؟ استخدم رمز الاستعادة القديم');
assert.equal(tree.root.findAllByProps({ role: 'alert' }).length, 0, 'changing credential method must clear the previous error');
assert.ok(tree.root.findAllByType('label').some(label => textOf(label).includes('رمز الاستعادة القديم')));
await fill(['ABCD-EF01-2345-6789']);
await submit();
assert.ok(textOf(tree.root.findByType('h1')).includes('احفظ رموز المؤسسة'));
await act(async () => tree.unmount());
console.log('PASS: legacy upgrade clears stale errors when switching from password to recovery code');
const originalAuthFactory = exports.createLocalAdminAuth;
exports.createLocalAdminAuth = store => originalAuthFactory(store, {});
await mount();
assert.equal(protectedVisible(), false);
assert.ok(tree.root.findAllByProps({ role: 'alert' }).some(alert => textOf(alert).includes('localhost أو HTTPS')));
assert.equal(tree.root.findByType('a').props.href, 'http://localhost:8580/');
await act(async () => tree.unmount());
exports.createLocalAdminAuth = originalAuthFactory;
console.log('PASS: insecure-origin guidance and localhost shortcut without exposing setup');

// Actual App routing and sidebar navigation: local attendance must never mount
// the cloud login or wait for a Supabase session.
const localAttendanceModule = {};
const localAttendanceCode = ts.transpileModule(readFileSync('src/components/LocalAttendanceAdmin.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
vm.runInNewContext(localAttendanceCode, {
  exports: localAttendanceModule,
  require(id) {
    if (id === 'react/jsx-runtime') return jsxRuntime;
    if (id === './AbsenceManagement') return { AbsenceManagement: () => React.createElement('div', { id: 'local-absence' }) };
    throw new Error(`Unexpected dependency ${id}`);
  },
});
const appModule = {};
const assignedLocations = [];
const routeWindow = { location: { pathname: '/', search: '', assign: value => assignedLocations.push(value) } };
const stub = id => () => React.createElement('div', { 'data-component': id });
vm.runInNewContext(ts.transpileModule(readFileSync('src/App.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText, {
  exports: appModule, window: routeWindow, URLSearchParams, localStorage: { getItem() { return null; } }, console,
  require(id) {
    if (id === 'react') return { ...React, default: React };
    if (id === 'react/jsx-runtime') return jsxRuntime;
    if (id === './utils/database') return { dbManager: { async initialize() {} } };
    if (id === './utils/licenseManager') return { licenseManager: { async checkLicenseStatus() { return { isValid: true }; } } };
    if (id === './utils/attendanceCloud') return { attendanceCloud: { auth: new Proxy({}, { get() { throw new Error('Local route attempted cloud authentication'); } }) } };
    if (id === './utils/attendanceStartupSync') return {};
    if (id === './components/AttendancePortal') return {
      default: ({ teacherOnly = false, onExit }) => React.createElement('div', {
        'data-component': './components/AttendancePortal',
        'data-teacher-only': String(teacherOnly),
      }, !teacherOnly && React.createElement('button', { id: 'attendance-portal-exit', onClick: onExit }, 'return')),
    };
    if (id === './components/LocalAttendanceAdmin') return {
      default: () => React.createElement('div', { id: 'local-admin-attendance' },
        React.createElement(localAttendanceModule.default, { onNavigate() {} })),
    };
    if (id === './components/ErrorBoundary') return { default: ({ children }) => children };
    if (id === './components/Sidebar') return { default: ({ setActiveTab }) => React.createElement(React.Fragment, null,
      React.createElement('button', { id: 'local-attendance-nav', onClick: () => setActiveTab('attendance-portal') }, 'local attendance'),
      React.createElement('button', { id: 'teacher-attendance-nav', onClick: () => setActiveTab('teacher-attendance-management') }, 'teacher attendance')) };
    const component = stub(id);
    return { default: component, LicenseActivation: component, AbsenceManagement: component, ScheduleImport: component, SubscriptionManagement: component, SubscriptionAdmin: component, WaakuWhatsAppConnection: component };
  },
});
for (const pathname of ['/', '/attendance', '/attendance-cloud', '/teacher']) {
  routeWindow.location.pathname = pathname;
  routeWindow.location.search = '';
  let routed;
  await act(async () => { routed = TestRenderer.create(React.createElement(appModule.default)); });
  const isCloud = pathname === '/attendance-cloud' || pathname === '/teacher';
  assert.equal(routed.root.findAllByProps({ id: 'local-gate' }).length, 0, 'the administration program must not require a local password');
  assert.equal(routed.root.findAllByProps({ 'data-component': './components/AttendancePortal' }).length, isCloud ? 1 : 0);
  if (isCloud) {
    assert.equal(routed.root.findByProps({ 'data-component': './components/AttendancePortal' }).props['data-teacher-only'], String(pathname === '/teacher'));
    if (pathname === '/attendance-cloud') {
      await act(async () => routed.root.findByProps({ id: 'attendance-portal-exit' }).props.onClick());
      assert.equal(assignedLocations.pop(), '/attendance', 'cloud admin return must return to the local attendance administration, not reopen the cloud login');
    }
    if (pathname === '/teacher') {
      assert.equal(routed.root.findAllByProps({ id: 'attendance-portal-exit' }).length, 0, 'teachers must not get an admin return action');
    }
  }
  if (pathname === '/') await act(async () => routed.root.findByProps({ id: 'local-attendance-nav' }).props.onClick());
  if (!isCloud) {
    assert.equal(routed.root.findAllByProps({ id: 'local-admin-attendance' }).length, 1);
    if (pathname === '/') {
      await act(async () => routed.root.findByProps({ id: 'teacher-attendance-nav' }).props.onClick());
      const teacherPortal = routed.root.findByProps({ 'data-component': './components/AttendancePortal' });
      assert.equal(teacherPortal.props['data-teacher-only'], 'false', 'the admin shortcut must open the cloud admin portal, not the teacher route');
      await act(async () => routed.root.findByProps({ id: 'attendance-portal-exit' }).props.onClick());
      assert.equal(routed.root.findAllByProps({ 'data-component': './components/AttendancePortal' }).length, 0, 'admin return must not reopen the cloud login screen');
      assert.equal(routed.root.findAllByProps({ id: 'local-admin-attendance' }).length, 1, 'the admin return must open local absence management');
      await act(async () => routed.root.findByProps({ id: 'local-attendance-nav' }).props.onClick());
    }
  }
  await act(async () => routed.unmount());
}
routeWindow.location.pathname = '/attendance';
routeWindow.location.search = '';
let returnedToLocalAdmin;
await act(async () => { returnedToLocalAdmin = TestRenderer.create(React.createElement(appModule.default)); });
assert.equal(returnedToLocalAdmin.root.findAllByProps({ 'data-component': './components/AttendancePortal' }).length, 0);
assert.equal(returnedToLocalAdmin.root.findAllByProps({ id: 'local-admin-attendance' }).length, 1);
await act(async () => returnedToLocalAdmin.unmount());
console.log('PASS: local admin opens directly; cloud admin return no longer loops to login; teacher/cloud routes stay separate; local attendance opens correctly');
