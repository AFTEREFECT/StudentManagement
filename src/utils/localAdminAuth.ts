// Local application access only; this does not encrypt the institution database.
interface LocalAdminBase {
  institutionName: string;
  installationId: string;
  username: string;
  recoverySalt: string;
  recoveryHash: string;
  iterations: number;
  revision: number;
  failedAttempts: number;
  lockedUntil: number;
}

interface LegacyLocalAdminRecord extends LocalAdminBase {
  version: 1;
  passwordSalt: string;
  passwordHash: string;
}

interface LocalAdminRecord extends LocalAdminBase {
  version: 2;
  accessCodeSalt: string;
  accessCodeHash: string;
}

type StoredLocalAdminRecord = LegacyLocalAdminRecord | LocalAdminRecord;

export interface LocalAdminStore {
  readLocalAdmin(): Promise<string | null>;
  writeLocalAdmin(next: string, expected: string | null): Promise<void>;
}

const ITERATIONS = 210_000;
const normalizeCode = (value: string) => value.trim().toUpperCase();
const normalizeRecoveryCode = (value: string) => value.replace(/[\s-]/g, '').toUpperCase();
const hex = (value: Uint8Array) => Array.from(value, b => b.toString(16).padStart(2, '0')).join('');
const fromHex = (value: string) => Uint8Array.from(value.match(/../g) || [], part => parseInt(part, 16));

export function createLocalAdminAuth(store: LocalAdminStore, cryptoApi = globalThis.crypto, now = () => Date.now()) {
  let queue = Promise.resolve();
  const serialized = <T,>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation);
    queue = result.then(() => undefined, () => undefined);
    return result;
  };
  function requireCrypto() {
    if (!cryptoApi?.subtle) throw new Error('يتطلب الدخول المحلي متصفحًا حديثًا وفتح البرنامج عبر localhost أو HTTPS، أو استعمال نسخة سطح المكتب.');
  }
  async function hash(value: string, salt: string, iterations: number) {
    requireCrypto();
    const material = await cryptoApi.subtle.importKey('raw', new TextEncoder().encode(value), 'PBKDF2', false, ['deriveBits']);
    return hex(new Uint8Array(await cryptoApi.subtle.deriveBits({ name: 'PBKDF2', salt: fromHex(salt), iterations, hash: 'SHA-256' }, material, 256)));
  }
  function randomHex() {
    requireCrypto();
    return hex(cryptoApi.getRandomValues(new Uint8Array(16)));
  }
  function generatedAccessCode() {
    requireCrypto();
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = cryptoApi.getRandomValues(new Uint8Array(6));
    return Array.from(bytes, value => alphabet[value % alphabet.length]).join('');
  }
  function validateAccessCode(code: string) {
    if (!/^[a-z0-9]{6}$/i.test(code)) throw new Error('يجب أن يتكون رمز الدخول من 6 أحرف لاتينية أو أرقام فقط.');
    return normalizeCode(code);
  }
  async function load() {
    const raw = await store.readLocalAdmin();
    if (raw === null) return { raw, record: null };
    let record: StoredLocalAdminRecord;
    try {
      const parsed = JSON.parse(raw);
      const commonValid = parsed.institutionName && parsed.username && parsed.installationId &&
        [parsed.recoverySalt].every((v: unknown) => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v)) &&
        [parsed.recoveryHash].every((v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)) &&
        Number.isInteger(parsed.iterations) && parsed.iterations >= ITERATIONS && parsed.iterations <= 1_000_000 &&
        Number.isInteger(parsed.revision) && parsed.revision >= 1 &&
        Number.isSafeInteger(parsed.failedAttempts) && parsed.failedAttempts >= 0 &&
        Number.isSafeInteger(parsed.lockedUntil) && parsed.lockedUntil >= 0;
      const accessValid = parsed.version === 1
        ? typeof parsed.passwordSalt === 'string' && /^[a-f0-9]{32}$/.test(parsed.passwordSalt) &&
          typeof parsed.passwordHash === 'string' && /^[a-f0-9]{64}$/.test(parsed.passwordHash)
        : parsed.version === 2 && typeof parsed.accessCodeSalt === 'string' &&
          /^[a-f0-9]{32}$/.test(parsed.accessCodeSalt) && typeof parsed.accessCodeHash === 'string' &&
          /^[a-f0-9]{64}$/.test(parsed.accessCodeHash);
      if (!commonValid || !accessValid) throw new Error();
      record = parsed as StoredLocalAdminRecord;
    } catch {
      throw new Error('بيانات حساب الإدارة المحلي تالفة أو غير مدعومة. استعد نسخة احتياطية سليمة؛ لن يُعاد إنشاء الحساب تلقائيًا.');
    }
    return { raw, record };
  }
  function validatePassword(password: string) {
    if (password.length < 8 || password.length > 256) throw new Error('كلمة المرور الحالية يجب أن تتكون من 8 إلى 256 حرفًا.');
  }
  async function credentials(accessCode?: string) {
    const code = accessCode === undefined ? generatedAccessCode() : validateAccessCode(accessCode);
    const accessCodeSalt = randomHex();
    const recoverySalt = randomHex();
    const recoveryCode = randomHex().toUpperCase().match(/.{4}/g)!.join('-');
    return {
      accessCode: code,
      recoveryCode,
      values: {
        accessCodeSalt,
        recoverySalt,
        iterations: ITERATIONS,
        accessCodeHash: await hash(code, accessCodeSalt, ITERATIONS),
        recoveryHash: await hash(normalizeRecoveryCode(recoveryCode), recoverySalt, ITERATIONS),
      },
    };
  }
  async function recordFailure(raw: string, record: StoredLocalAdminRecord) {
    const failedAttempts = record.failedAttempts + 1;
    const delay = failedAttempts >= 5 ? Math.min(15 * 60_000, 60_000 * 2 ** Math.min(4, failedAttempts - 5)) : 0;
    await store.writeLocalAdmin(JSON.stringify({ ...record, failedAttempts, lockedUntil: delay ? now() + delay : 0 }), raw);
  }
  async function verifySecret(raw: string, record: StoredLocalAdminRecord, secret: string, recovery: boolean) {
    if (record.lockedUntil > now()) throw new Error(`محاولات كثيرة. أعد المحاولة بعد ${Math.ceil((record.lockedUntil - now()) / 1000)} ثانية.`);
    const current = record.version === 1
      ? { salt: record.passwordSalt, hash: record.passwordHash }
      : { salt: record.accessCodeSalt, hash: record.accessCodeHash };
    const actual = await hash(recovery ? normalizeRecoveryCode(secret) : normalizeCode(secret), recovery ? record.recoverySalt : current.salt, record.iterations);
    const expected = recovery ? record.recoveryHash : current.hash;
    let difference = 0;
    for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
    if (difference !== 0) {
      await recordFailure(raw, record);
      throw new Error(recovery ? 'رمز استعادة المؤسسة غير صحيح.' : 'رمز دخول المؤسسة غير صحيح.');
    }
  }

  return {
    isCryptoAvailable() {
      return Boolean(cryptoApi?.subtle && cryptoApi?.getRandomValues);
    },
    async info() {
      const { record } = await load();
      return record ? {
        institutionName: record.institutionName,
        username: record.username,
        needsUpgrade: record.version === 1,
      } : null;
    },
    setup: (institutionName: string, accessCode?: string) => serialized(async () => {
      const { raw, record } = await load();
      if (record) throw new Error('حساب الإدارة المحلي موجود مسبقًا.');
      const name = institutionName.trim();
      if (!name || name.length > 200) throw new Error('أدخل اسم المؤسسة (200 حرف كحد أقصى).');
      const { accessCode: savedCode, recoveryCode, values } = await credentials(accessCode);
      const next: LocalAdminRecord = {
        version: 2, institutionName: name, username: 'admin', installationId: randomHex(),
        ...values, revision: 1, failedAttempts: 0, lockedUntil: 0,
      };
      await store.writeLocalAdmin(JSON.stringify(next), raw);
      return { accessCode: savedCode, recoveryCode };
    }),
    upgrade: (secret: string, accessCode?: string, recovery = false) => serialized(async () => {
      if (!recovery) validatePassword(secret);
      const { raw, record } = await load();
      if (!record || record.version !== 1 || !raw) throw new Error('لا يوجد حساب قديم يحتاج إلى التحديث.');
      if (record.lockedUntil > now()) throw new Error(`محاولات كثيرة. أعد المحاولة بعد ${Math.ceil((record.lockedUntil - now()) / 1000)} ثانية.`);
      if (recovery) {
        await verifySecret(raw, record, secret, true);
      } else {
        const actual = await hash(secret, record.passwordSalt, record.iterations);
        let difference = 0;
        for (let i = 0; i < record.passwordHash.length; i++) difference |= record.passwordHash.charCodeAt(i) ^ actual.charCodeAt(i);
        if (difference !== 0) {
          await recordFailure(raw, record);
          throw new Error('كلمة المرور القديمة غير صحيحة.');
        }
      }
      const { accessCode: savedCode, recoveryCode, values } = await credentials(accessCode);
      const next: LocalAdminRecord = {
        version: 2, institutionName: record.institutionName, username: record.username,
        installationId: record.installationId, ...values,
        revision: record.revision + 1, failedAttempts: 0, lockedUntil: 0,
      };
      await store.writeLocalAdmin(JSON.stringify(next), raw);
      return { accessCode: savedCode, recoveryCode };
    }),
    login: (accessCode: string) => serialized(async () => {
      const { raw, record } = await load();
      if (!record || !raw) throw new Error('لم يُعد حساب الإدارة المحلي بعد.');
      if (record.version === 1) throw new Error('يجب تحديث رمز دخول المؤسسة قبل المتابعة.');
      await verifySecret(raw, record, accessCode, false);
      if (record.failedAttempts || record.lockedUntil) await store.writeLocalAdmin(JSON.stringify({ ...record, failedAttempts: 0, lockedUntil: 0 }), raw);
    }),
    verifyRecovery: (code: string) => serialized(async () => {
      const { raw, record } = await load();
      if (!record || !raw) throw new Error('لم يُعد حساب الإدارة المحلي بعد.');
      if (record.version === 1) throw new Error('حدّث الحساب أولاً باستخدام كلمة المرور الحالية.');
      await verifySecret(raw, record, code, true);
    }),
    replaceAccessCode: (secret: string, accessCode: string | undefined, recovery: boolean) => serialized(async () => {
      const { raw, record } = await load();
      if (!record || record.version !== 2 || !raw) throw new Error('لم يُعد حساب الإدارة المحلي بعد.');
      await verifySecret(raw, record, secret, recovery);
      const { accessCode: savedCode, recoveryCode, values } = await credentials(accessCode);
      const next: LocalAdminRecord = {
        ...record, ...values, revision: record.revision + 1, failedAttempts: 0, lockedUntil: 0,
      };
      await store.writeLocalAdmin(JSON.stringify(next), raw);
      return { accessCode: savedCode, recoveryCode };
    }),
  };
}
