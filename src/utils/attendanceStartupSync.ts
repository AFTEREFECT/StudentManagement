import { attendanceCloud } from './attendanceCloud';
import { dbManager } from './database';

export interface ReceivedAttendance {
  id: string;
  institution_id: string;
  sync_revision: string;
  lesson_date: string;
  submitted_at: string;
  edit_deadline: string;
  status: 'submitted' | 'confirmed' | 'cancelled';
  teacher_id: string;
  timetable_id: string;
  teacherName: string;
  lesson: { id: string; class_name: string; subject_name: string; start_time: string; end_time: string };
  marks: Array<{ id: string; student_id: string; display_name: string }>;
}

export interface StartupSyncState {
  phase: 'waiting' | 'syncing' | 'success' | 'failed';
  lastSuccess: string | null;
  error: string;
  institutionId: string | null;
}

type SyncClient = {
  pull(after: string | null): Promise<{ institution_id: string; records: ReceivedAttendance[] }>;
  save(institutionId: string, records: ReceivedAttendance[]): Promise<void>;
  acknowledge(records: Array<{ id: string; revision: string }>): Promise<void>;
  complete(institutionId: string, at: string): Promise<void>;
};

// Do not use a timestamp watermark: a late correction of an old lesson must be
// returned until its exact revision has been saved durably and acknowledged.
export async function receivePendingAttendance(client: SyncClient) {
  let after: string | null = null;
  let institutionId: string | null = null;
  let count = 0;
  for (;;) {
    const page = await client.pull(after);
    if (!page.institution_id || (institutionId && institutionId !== page.institution_id)) {
      throw new Error('تغيرت هوية المؤسسة أثناء المزامنة.');
    }
    institutionId = page.institution_id;
    if (!Array.isArray(page.records) || page.records.some((row) => row.institution_id !== institutionId)) {
      throw new Error('بيانات الغياب لا تطابق المؤسسة المصرح بها.');
    }
    if (!page.records.length) break;
    const next = page.records[page.records.length - 1].id;
    if (after && next <= after) throw new Error('استجابة ترقيم غير صالحة.');
    await client.save(institutionId, page.records);
    await client.acknowledge(page.records.map((row) => ({ id: row.id, revision: row.sync_revision })));
    count += page.records.length;
    after = next;
  }
  const lastSuccess = new Date().toISOString();
  await client.complete(institutionId, lastSuccess);
  return { institutionId, lastSuccess, count };
}

let state: StartupSyncState = { phase: 'waiting', lastSuccess: null, error: '', institutionId: null };
let activeKey = '';
let generation = 0;
const listeners = new Set<() => void>();
export const getStartupSyncState = () => state;
export function subscribeStartupSync(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function update(next: Partial<StartupSyncState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function resetAttendanceStartupSync() {
  generation++;
  activeKey = '';
  update({ phase: 'waiting', lastSuccess: null, error: '', institutionId: null });
}

function loginKey(session: { access_token: string; user: { id: string } }) {
  const payload = session.access_token.split('.')[1];
  const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  if (typeof claims.session_id !== 'string') throw new Error('معرّف جلسة الدخول غير متاح.');
  return `${session.user.id}:${claims.session_id}`;
}

function bounded<T>(operation: PromiseLike<T>): Promise<T> {
  // A per-request deadline, never a polling/retry timer.
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('انتهت مهلة الاتصال؛ يمكنك متابعة العمل محليًا.')), 20000);
    Promise.resolve(operation).then(resolve, reject).finally(() => window.clearTimeout(timeout));
  });
}

export async function startAttendanceStartupSync() {
  const desktop = window.desktopAttendance;
  if (!desktop || !attendanceCloud) return;
  let key = '';
  let token = '';
  let runGeneration = generation;
  const assertCurrentLogin = () => {
    if (runGeneration !== generation) throw new Error('تغيرت جلسة الدخول أثناء المزامنة.');
  };
  try {
    await dbManager.initialize();
    if (!state.institutionId) {
      const last = await dbManager.getAttendanceSyncSuccess();
      assertCurrentLogin();
      if (last) update({ lastSuccess: last.lastSuccess, institutionId: last.institutionId });
    }
    const { data, error } = await bounded(attendanceCloud.auth.getSession());
    if (error) throw error;
    assertCurrentLogin();
    if (!data.session) return;
    key = loginKey(data.session);
    if (activeKey && activeKey !== key) {
      resetAttendanceStartupSync();
      runGeneration = generation;
    }
    activeKey = key;
    const claim = await desktop.claim(key);
    token = claim.claimed ? claim.token : '';
    const previous = await dbManager.getAttendanceSyncSuccess(data.session.user.id);
    assertCurrentLogin();
    update({ phase: claim.phase, error: claim.error, lastSuccess: previous?.lastSuccess || null,
      institutionId: previous?.institutionId || null });
    if (!claim.claimed) return;
    const cloud = attendanceCloud;
    const result = await receivePendingAttendance({
      async pull(after) {
        assertCurrentLogin();
        const { data: page, error: pullError } = await bounded(cloud.rpc('attendance_pull_pending', { p_after: after }));
        if (pullError) throw pullError;
        assertCurrentLogin();
        if (page?.user_id !== data.session!.user.id) throw new Error('تغيرت هوية المستخدم أثناء المزامنة.');
        return page;
      },
      async save(institutionId, rows) {
        assertCurrentLogin();
        await dbManager.saveReceivedAttendance(institutionId, rows);
        assertCurrentLogin();
        update({ institutionId });
      },
      async acknowledge(rows) {
        assertCurrentLogin();
        const { data: acknowledged, error: ackError } = await bounded(cloud.rpc('attendance_acknowledge', { p_receipts: rows }));
        if (ackError) throw ackError;
        assertCurrentLogin();
        if (acknowledged !== rows.length) {
          throw new Error('تغير أحد السجلات قبل تأكيد استلامه؛ سيُسترجع آخر إصدار عند تشغيل التطبيق مجددًا.');
        }
      },
      async complete(institutionId, at) {
        assertCurrentLogin();
        await dbManager.saveAttendanceSyncSuccess(data.session!.user.id, institutionId, at);
      },
    });
    assertCurrentLogin();
    await desktop.finish(key, token, { phase: 'success', error: '' });
    update({ phase: 'success', error: '', lastSuccess: result.lastSuccess, institutionId: result.institutionId });
    window.dispatchEvent(new Event('attendance-received'));
  } catch (error) {
    const message = error && typeof error === 'object' && 'message' in error
      ? String(error.message) : 'تعذرت مزامنة الغياب؛ يمكنك متابعة العمل محليًا.';
    if (key && token) await desktop.finish(key, token, { phase: 'failed', error: message }).catch(() => {});
    if (runGeneration === generation) update({ phase: 'failed', error: message });
  }
}
