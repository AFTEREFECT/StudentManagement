// Run: node scripts/test-attendance-reactivation.mjs (no network or live users).
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(join(root, path), 'utf8');
const transpile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const identity = {};
vm.runInNewContext(transpile(read('supabase/functions/_shared/attendanceIdentity.ts')), { exports: identity });
const tables = { attendance_teacher_invites: [], attendance_profiles: [], attendance_teacher_directory: [] };
const users = new Map();
const authCalls = [];
let claimRace = false;
let failUpdate = false;
let failProfileInsert = false;
let failDirectory = false;
class Query {
  constructor(table) { this.table = table; this.operation = 'select'; this.filters = []; }
  select() { return this; }
  eq(key, value) { this.filters.push(row => row[key] === value); return this; }
  is(key, value) { return this.eq(key, value); }
  gt(key, value) { this.filters.push(row => row[key] > value); return this; }
  update(value) { this.operation = 'update'; this.value = value; return this; }
  insert(value) { this.operation = 'insert'; this.value = value; return this; }
  upsert(value) { this.operation = 'upsert'; this.value = value; return this; }
  delete() { this.operation = 'delete'; return this; }
  async run() {
    if (this.result) return this.result;
    let rows = tables[this.table].filter(row => this.filters.every(filter => filter(row)));
    let error = null;
    if (this.operation === 'update') {
      if (this.table === 'attendance_teacher_invites' && this.value.claimed_at && claimRace) { rows = []; claimRace = false; }
      else rows.forEach(row => Object.assign(row, this.value));
    } else if (this.operation === 'insert') {
      if (this.table === 'attendance_profiles' && failProfileInsert) error = new Error('Simulated profile failure');
      else { rows = [{ ...this.value }]; tables[this.table].push(...rows); }
    } else if (this.operation === 'upsert') {
      if (failDirectory) error = new Error('Simulated directory failure');
      else {
        const old = tables[this.table].find(row => row.institution_id === this.value.institution_id && row.teacher_id === this.value.teacher_id);
        if (old) Object.assign(old, this.value); else tables[this.table].push({ ...this.value });
      }
    } else if (this.operation === 'delete') tables[this.table] = tables[this.table].filter(row => !rows.includes(row));
    this.result = { data: rows, error }; return this.result;
  }
  async maybeSingle() { const result = await this.run(); return { data: result.data[0] || null, error: result.error }; }
  then(resolve, reject) { return this.run().then(resolve, reject); }
}
const admin = {
  from: table => new Query(table),
  auth: { admin: {
    async createUser(value) {
      authCalls.push('create');
      if ([...users.values()].some(user => user.email === value.email)) return { error: new Error('duplicate user') };
      const user = { id: `user-${users.size + 1}`, email: value.email, password: value.password };
      users.set(user.id, user); return { data: { user }, error: null };
    },
    async getUserById(id) { return { data: { user: users.get(id) }, error: null }; },
    async updateUserById(id, value) {
      authCalls.push('update');
      if (failUpdate) return { error: new Error('Simulated update failure') };
      Object.assign(users.get(id), value); return { error: null };
    },
    async deleteUser(id) { authCalls.push('delete'); users.delete(id); return { error: null }; },
  } },
};
let handler;
vm.runInNewContext(transpile(read('supabase/functions/attendance-redeem-invite/index.ts')), {
  exports: {}, crypto: webcrypto, Request, Response, TextEncoder,
  console: { error() {} },
  Deno: { env: { get: key => key === 'SUPABASE_URL' ? 'https://example.invalid' : 'test-only-service-key' }, serve: value => { handler = value; } },
  require(id) {
    if (id.startsWith('https://esm.sh/')) return { createClient: () => admin };
    if (id.includes('attendanceIdentity')) return identity;
    throw new Error(`Unexpected import: ${id}`);
  },
});
const code = 'AA11223344556677';
const hash = createHash('sha256').update(code).digest('hex');
const invite = { id: 'invite-1', institution_id: 'school-1', teacher_id: 'teacher-1', display_name: 'Test teacher', username: 'teacher-cba8eb8be543', code_hash: hash, claimed_at: null, expires_at: '2099-01-01T00:00:00.000Z' };
tables.attendance_teacher_invites.push(invite);
const request = (overrides = {}) => handler(new Request('https://example.invalid/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'cba8eb8be543', activationCode: code, password: 'test-password-one', ...overrides }) }));
let response = await request();
assert.equal(response.status, 200);
assert.equal(users.size, 1);
const originalId = tables.attendance_profiles[0].user_id;
assert.equal((await response.json()).username, 'teacher-cba8eb8be543');
assert.ok(invite.claimed_at);
assert.equal((await request()).status, 400);
assert.equal(users.get(originalId).password, 'test-password-one');
invite.claimed_at = null;
response = await request({ password: 'test-password-two' });
assert.equal(response.status, 200);
assert.equal(users.size, 1);
assert.equal(tables.attendance_profiles.length, 1);
assert.equal(tables.attendance_profiles[0].user_id, originalId);
assert.equal(users.get(originalId).password, 'test-password-two');
assert.equal(authCalls.filter(call => call === 'create').length, 1);
assert.equal(authCalls.filter(call => call === 'delete').length, 0);
console.log('PASS: activation accepts the short username; reactivation changes the same account password and preserves its profile; consumed codes cannot be replayed');

invite.claimed_at = null;
const beforeRace = authCalls.length;
claimRace = true;
assert.equal((await request()).status, 409);
assert.equal(authCalls.length, beforeRace);
assert.equal((await request({ activationCode: 'BB11223344556677' })).status, 400);
invite.expires_at = '2020-01-01T00:00:00.000Z';
assert.equal((await request()).status, 400);
assert.equal(authCalls.length, beforeRace);
invite.expires_at = '2099-01-01T00:00:00.000Z';
failUpdate = true;
assert.equal((await request({ password: 'test-password-three' })).status, 500);
assert.equal(invite.claimed_at, null);
assert.equal(users.get(originalId).password, 'test-password-two');
failUpdate = false;
failDirectory = true;
const beforeDirectoryFailure = authCalls.filter(call => call === 'update').length;
assert.equal((await request()).status, 500);
assert.equal(authCalls.filter(call => call === 'update').length, beforeDirectoryFailure);
assert.equal(invite.claimed_at, null);
failDirectory = false;
console.log('PASS: racing, expired and incorrect codes cannot reset passwords; failed updates retain the old password and release the claim');

const secondInvite = { ...invite, id: 'invite-2', teacher_id: 'teacher-2', username: 'teacher-123456abcdef' };
tables.attendance_teacher_invites.push(secondInvite);
failProfileInsert = true;
assert.equal((await request({ username: '123456abcdef' })).status, 500);
assert.equal(users.size, 1);
assert.equal(secondInvite.claimed_at, null);
assert.equal(tables.attendance_profiles.length, 1);
console.log('PASS: failed first activation removes only its newly created auth account and releases its code');
