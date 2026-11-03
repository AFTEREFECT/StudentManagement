import type { TeacherIdentity, YearData } from './model';
import { attendanceLoginEmail } from '../../supabase/functions/_shared/attendanceIdentity';

type Sealed = { iv: Uint8Array; ciphertext: ArrayBuffer };
type VaultHeader = { id: string; salt: Uint8Array; wrapped: Sealed; profile: Sealed };
type Document = { id: string; owner: string; year: string; revision: number; sealed: Sealed };
const encode = new TextEncoder();
const decode = new TextDecoder();
const DATABASE = 'progtalamid-teacher-v1';
const iterations = 310000;
async function fingerprint(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', encode.encode(value)))].map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function passwordKey(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', encode.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(key: CryptoKey, value: BufferSource, aad: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return { iv, ciphertext: await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encode.encode(aad) }, key, value) };
}
async function open(key: CryptoKey, value: Sealed, aad: string) {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: value.iv, additionalData: encode.encode(aad) }, key, value.ciphertext);
}
function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error); });
}
function completed(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('فشل الحفظ المحلي.')); });
}
export class TeacherVault {
  private db: IDBDatabase | null = null;
  private key: CryptoKey | null = null;
  private owner = '';
  private identity: TeacherIdentity | null = null;
  private epoch = 0;
  private async database() {
    if (this.db) return this.db;
    const pending = indexedDB.open(DATABASE, 1);
    pending.onupgradeneeded = () => {
      pending.result.createObjectStore('vaults', { keyPath: 'id' });
      const docs = pending.result.createObjectStore('years', { keyPath: 'id' });
      docs.createIndex('owner', 'owner', { unique: false });
    };
    this.db = await request(pending);
    this.db.onversionchange = () => { this.db?.close(); this.db = null; this.lock(); };
    return this.db;
  }
  lock() { this.epoch++; this.key = null; this.identity = null; this.owner = ''; }
  get profile() { return this.identity; }
  private context() {
    if (!this.key || !this.identity) throw new Error('افتح الأرشيف برمز حسابك أولًا.');
    return { key: this.key, identity: this.identity, owner: this.owner, epoch: this.epoch };
  }
  private current(epoch: number) { if (this.epoch !== epoch) throw new Error('أُغلق الحساب المحلي.'); }
  async unlock(login: string, password: string, verified?: TeacherIdentity) {
    this.lock();
    const epoch = this.epoch;
    const id = await fingerprint(attendanceLoginEmail(login));
    const db = await this.database();
    let header = await request<VaultHeader | undefined>(db.transaction('vaults').objectStore('vaults').get(id));
    let key: CryptoKey;
    let identity: TeacherIdentity;
    if (header) {
      try {
        const wrappingKey = await passwordKey(password, header.salt);
        const raw = await open(wrappingKey, header.wrapped, `${id}:key`);
        key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
        identity = JSON.parse(decode.decode(await open(key, header.profile, `${id}:profile`)));
      } catch {
        // Never silently reset a vault after a password change: that would strand
        // a whole year's drafts/history. Recovery requires its old unlock secret.
        throw new Error('تعذر فتح الأرشيف. استخدم رمز فتحه السابق إن تغير رمز الحساب؛ لا تُحذف البيانات القديمة.');
      }
      if (verified && (identity.user_id !== verified.user_id || identity.institution_id !== verified.institution_id)) {
        throw new Error('الأرشيف لا يطابق الحساب المتحقق منه.');
      }
    } else {
      if (!verified || verified.role !== 'teacher') throw new Error('لا يوجد أرشيف محلي لهذا الحساب؛ سجّل الدخول عبر الإنترنت أولًا.');
      identity = { user_id: verified.user_id, institution_id: verified.institution_id, role: 'teacher',
        display_name: verified.display_name, must_change_password: verified.must_change_password };
      const raw = crypto.getRandomValues(new Uint8Array(32));
      key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
      const salt = crypto.getRandomValues(new Uint8Array(16));
      header = { id, salt, wrapped: await seal(await passwordKey(password, salt), raw, `${id}:key`),
        profile: await seal(key, encode.encode(JSON.stringify(identity)), `${id}:profile`) };
      this.current(epoch);
      const transaction = db.transaction('vaults', 'readwrite');
      const done = completed(transaction);
      transaction.objectStore('vaults').add(header); // Racing first unlock must never overwrite an existing key.
      await done;
    }
    this.current(epoch);
    this.key = key; this.owner = id; this.identity = verified || identity;
    return this.identity;
  }
  async years() {
    const ctx = this.context();
    const db = await this.database();
    const docs = await request<Document[]>(db.transaction('years').objectStore('years').index('owner').getAll(ctx.owner));
    this.current(ctx.epoch);
    return docs.map((doc) => doc.year).sort().reverse();
  }
  async read(year: string): Promise<YearData | null> {
    const ctx = this.context();
    const db = await this.database();
    const doc = await request<Document | undefined>(db.transaction('years').objectStore('years').get(`${ctx.owner}:${year}`));
    if (!doc) return null;
    const data: YearData = JSON.parse(decode.decode(await open(ctx.key, doc.sealed, doc.id)));
    this.current(ctx.epoch);
    if (data.teacherUserId !== ctx.identity.user_id || data.institutionId !== ctx.identity.institution_id || data.year !== year) {
      throw new Error('نطاق الأرشيف المحلي غير صحيح.');
    }
    return data;
  }
  async mutate(year: string, initial: () => YearData, change: (data: YearData) => void) {
    const ctx = this.context();
    const db = await this.database();
    const id = `${ctx.owner}:${year}`;
    for (let attempt = 0; attempt < 8; attempt++) {
      const doc = await request<Document | undefined>(db.transaction('years').objectStore('years').get(id));
      const data: YearData = doc ? JSON.parse(decode.decode(await open(ctx.key, doc.sealed, id))) : initial();
      if (data.teacherUserId !== ctx.identity.user_id || data.institutionId !== ctx.identity.institution_id || data.year !== year) throw new Error('الحساب غير مطابق.');
      this.current(ctx.epoch);
      change(data);
      const sealed = await seal(ctx.key, encode.encode(JSON.stringify(data)), id);
      this.current(ctx.epoch);
      // Encryption is outside the transaction. CAS inside one read/write
      // transaction prevents lost edits between tabs, even without Web Locks.
      const transaction = db.transaction('years', 'readwrite');
      const done = completed(transaction);
      const store = transaction.objectStore('years');
      const latest = store.get(id);
      let wrote = false;
      latest.onsuccess = () => {
        if ((latest.result?.revision || 0) !== (doc?.revision || 0) || this.epoch !== ctx.epoch) return;
        store.put({ id, owner: ctx.owner, year, revision: (doc?.revision || 0) + 1, sealed });
        wrote = true;
      };
      await done;
      this.current(ctx.epoch);
      if (wrote) return data;
    }
    throw new Error('يوجد تعديل متزامن في نافذة أخرى؛ أعد المحاولة.');
  }
}
export const teacherVault = new TeacherVault();
