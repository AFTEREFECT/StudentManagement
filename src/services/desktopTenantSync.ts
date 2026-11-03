/**
 * Desktop pilot security/sync API. Does not provide an offline database or
 * device attestation: callers MUST supply a trusted desktop host + encrypted
 * outbox and must not use these APIs for students/absence data yet.
 *
 * Unlike a UI-only institution filter, every action is checked in PostgreSQL.
 */
import { supabase } from '../utils/supabase';

export type DesktopRole = 'institution_admin' | 'staff' | 'teacher';
export type DesktopMembership = {
  institution_id: string;
  user_id: string;
  role: DesktopRole;
  active: boolean;
};
export type DesktopDevice = {
  id: string;
  institution_id: string;
  user_id: string;
  label: string;
  status: 'pending' | 'approved' | 'revoked';
};
export type PilotDocumentKind = 'administrative_note' | 'institution_preferences';
export type DesktopChange = {
  operation_id: string;    // generated once, kept across retries
  kind: PilotDocumentKind;
  document_id: string;
  expected_revision: number;
  content: Record<string, unknown>;
};
export type SyncReceipt = {
  operation_id: string;
  status: 'applied' | 'duplicate' | 'conflict';
  revision: number;
};

const requireUuid = (value: string, name: string) => {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)) {
    throw new Error('Invalid ' + name);
  }
};
const assertAuthenticated = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sign in required');
  return data.user;
};

/** Requires Internet. First sign-in of admin must then complete TOTP MFA. */
export async function signInDesktop(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** Obtain the next MFA factor, then challenge and verify with authenticator OTP. */
export async function verifyAdminTotp(factorId: string, code: string): Promise<void> {
  requireUuid(factorId, 'factor id');
  if (!/^\d{6}$/.test(code)) throw new Error('Expected six-digit code');
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;
  const { error } = await supabase.auth.mfa.verify({
    factorId, challengeId: challenge.id, code,
  });
  if (error) throw error;
}

export async function listMyDesktopMemberships(): Promise<DesktopMembership[]> {
  const user = await assertAuthenticated();
  const { data, error } = await supabase.from('desktop_memberships')
    .select('institution_id,user_id,role,active')
    .eq('user_id', user.id)
    .eq('active', true);
  if (error) throw error;
  return (data || []) as DesktopMembership[];
}

export async function requestDesktopDevice(institutionId: string, label: string): Promise<DesktopDevice> {
  requireUuid(institutionId, 'institution id');
  const user = await assertAuthenticated();
  if (!label.trim() || label.length > 120) throw new Error('Invalid device label');
  const { data, error } = await supabase.from('desktop_devices')
    .insert({ institution_id: institutionId, user_id: user.id, label: label.trim(), status: 'pending' })
    .select('id,institution_id,user_id,label,status').single();
  if (error) throw error;
  return data as DesktopDevice;
}

/** Only an active institution admin with Supabase AAL2 may approve a device. */
export async function reviewDesktopDevice(institutionId: string, deviceId: string, approve: boolean) {
  requireUuid(institutionId, 'institution id');
  requireUuid(deviceId, 'device id');
  const { error } = await supabase.rpc('desktop_review_device', {
    p_institution: institutionId, p_device: deviceId, p_approve: approve,
  });
  if (error) throw error;
}

/** Persist local edits *before* calling this function, using host-encrypted storage. */
export async function pushDesktopPilotBatch(
  institutionId: string, deviceId: string, operations: DesktopChange[],
): Promise<SyncReceipt[]> {
  requireUuid(institutionId, 'institution id');
  requireUuid(deviceId, 'device id');
  if (operations.length < 1 || operations.length > 50) throw new Error('Batch must contain 1–50 items');
  for (const op of operations) {
    requireUuid(op.operation_id, 'operation id');
    requireUuid(op.document_id, 'document id');
    if (!['administrative_note', 'institution_preferences'].includes(op.kind)) {
      throw new Error('Unsupported pilot document type');
    }
    if (!Number.isSafeInteger(op.expected_revision) || op.expected_revision < 0 ||
        !op.content || typeof op.content !== 'object' || Array.isArray(op.content)) {
      throw new Error('Invalid document payload');
    }
  }
  const { data, error } = await supabase.rpc('desktop_apply_batch', {
    p_institution: institutionId, p_device: deviceId, p_operations: operations,
  });
  if (error) throw error;
  return data as SyncReceipt[];
}

/**
 * The app host owns encrypted persistent storage. Never serialize all schools
 * into one shared unencrypted localStorage / IndexedDB key.
 */
export interface EncryptedDesktopOutbox {
  peek(institutionId: string, limit: number): Promise<DesktopChange[]>;
  markAcknowledged(institutionId: string, operationIds: string[]): Promise<void>;
  markConflict(institutionId: string, operationId: string, serverRevision: number): Promise<void>;
}

/** Serializable on a single device; duplicate IDs are idempotent on server. */
export async function flushDesktopOutbox(
  institutionId: string, deviceId: string, outbox: EncryptedDesktopOutbox,
): Promise<{ acknowledged: number; conflicts: number }> {
  let acknowledged = 0;
  let conflicts = 0;
  const visited = new Set<string>();
  // Bounded loop avoids infinite retries on a malformed outbox.
  for (let page = 0; page < 100; page++) {
    const items = (await outbox.peek(institutionId, 50)).filter(o => !visited.has(o.operation_id));
    if (!items.length) break;
    items.forEach(o => visited.add(o.operation_id));
    const receipts = await pushDesktopPilotBatch(institutionId, deviceId, items);
    const allowed = new Set(items.map(o => o.operation_id));
    const successIds = receipts.filter(r => allowed.has(r.operation_id) &&
      (r.status === 'applied' || r.status === 'duplicate')).map(r => r.operation_id);
    if (successIds.length) await outbox.markAcknowledged(institutionId, successIds);
    for (const r of receipts) {
      if (allowed.has(r.operation_id) && r.status === 'conflict') {
        await outbox.markConflict(institutionId, r.operation_id, r.revision);
        conflicts++;
      }
    }
    acknowledged += successIds.length;
    if (!successIds.length && !receipts.some(r => r.status === 'conflict')) {
      throw new Error('Unexpected empty sync receipt: operations left pending');
    }
  }
  return { acknowledged, conflicts };
}

/**
 * Call once in an authenticated desktop window, after an encrypted outbox
 * has been mounted and device approval confirmed. Online writes should
 * attempt immediately; pending offline writes are flushed on reconnect.
 * A tab/desktop process that is closed cannot guarantee background syncing.
 */
export function installReconnectSync(runSync: () => Promise<void>): () => void {
  let running = false;
  const sync = async () => {
    if (running || !navigator.onLine) return;
    running = true;
    try { await runSync(); }
    catch (error) { console.warn('Desktop sync failed; pending operations retained', error); }
    finally { running = false; }
  };
  const onVisible = () => { if (document.visibilityState === 'visible') void sync(); };
  const onOnline = () => { void sync(); };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  void sync();
  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
