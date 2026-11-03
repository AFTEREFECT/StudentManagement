import { attendanceCloud, getAttendanceProfile, getTeacherTimetable, getStudentsForLesson } from '../../src/utils/attendanceCloud';
import { entryKey, mergeConfirmed, newYear, type ConfirmedRecord, type TeacherIdentity } from './model';
import { teacherVault, type TeacherVault } from './vault';

function deadline<T>(operation: PromiseLike<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('تعذر الاتصال؛ بقيت المسودة محفوظة محليًا.')), 12000);
    Promise.resolve(operation).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

async function authorized(vault: TeacherVault): Promise<TeacherIdentity> {
  const local = vault.profile;
  if (!local) throw new Error('الأرشيف مغلق.');
  const remote = await deadline(getAttendanceProfile());
  if (!remote || remote.role !== 'teacher' || remote.must_change_password
    || remote.user_id !== local.user_id || remote.institution_id !== local.institution_id) {
    throw new Error('سجّل الدخول عبر الإنترنت بالحساب المطابق قبل الإرسال.');
  }
  return remote;
}
export async function refreshTeacherYear(year?: string, vault = teacherVault) {
  if (!attendanceCloud) throw new Error('الاتصال السحابي غير مهيأ.');
  const identity = await authorized(vault);
  const lessons = await deadline(getTeacherTimetable());
  const students = (await Promise.all([...new Set(lessons.map((lesson) => lesson.class_name))]
    .map((name) => deadline(getStudentsForLesson(name))))).flat();
  let after: string | null = null;
  let selectedYear = year;
  for (;;) {
    const { data, error } = await deadline(attendanceCloud.rpc('teacher_attendance_bundle', { p_year: selectedYear || null, p_after: after }));
    if (error) throw error;
    if (data.userId !== identity.user_id || data.institutionId !== identity.institution_id) throw new Error('تغيرت هوية الحساب.');
    selectedYear = data.year as string;
    if (year && selectedYear !== year) throw new Error('استجابة سنة دراسية غير مطابقة.');
    const records = data.sessions as Omit<ConfirmedRecord, 'source'>[];
    await vault.mutate(selectedYear, () => newYear(identity, selectedYear!, data.startMonth, data.secondSemesterMonth), (local) => {
      local.lessons = lessons;
      const known = new Map(local.students.map((student) => [student.id, student]));
      students.forEach((student) => known.set(student.id, { id: student.id, display_name: student.display_name, class_name: student.class_name }));
      local.students = [...known.values()];
      local.activeStudentIds = students.map((student) => student.id);
      local.archiveKeys = data.archiveKeys;
      local.refreshedAt = new Date().toISOString();
      records.forEach((record) => mergeConfirmed(local, { ...record, source: 'server' }));
    });
    if (!records.length) break;
    const next = records[records.length - 1].id;
    if (after && next <= after) throw new Error('استجابة ترقيم غير صالحة.');
    after = next;
  }
  return selectedYear!;
}

const sending = new WeakMap<TeacherVault, Promise<void>>();
export function sendPendingTeacherAttendance(vault = teacherVault) {
  const existing = sending.get(vault);
  if (existing) return existing;
  const work = sendPending(vault).finally(() => { sending.delete(vault); });
  sending.set(vault, work);
  return work;
}
async function sendPending(vault: TeacherVault) {
  if (!attendanceCloud) throw new Error('الاتصال السحابي غير مهيأ.');
  const identity = await authorized(vault);
  for (const year of await vault.years()) {
    const cached = await vault.read(year);
    if (!cached) continue;
    for (const item of Object.values(cached.entries)) {
      const draft = item.draft;
      if (!draft || draft.state !== 'pending') continue;
      const current = await vault.read(year);
      if (current?.entries[entryKey(draft.timetableId, draft.lessonDate)]?.draft?.operationId !== draft.operationId) continue;
      const { data, error } = await deadline(attendanceCloud.rpc('teacher_submit_attendance_operation', {
        p_operation_id: draft.operationId, p_timetable_id: draft.timetableId, p_lesson_date: draft.lessonDate,
        p_student_ids: draft.absentStudentIds, p_expected_revision: draft.expectedRevision,
      }));
      if (error && !['42501', '22023', 'P0001', '23503', '23514'].includes(error.code || '')) throw error;
      await vault.mutate(year, () => newYear(identity, year), (local) => {
        const entry = local.entries[entryKey(draft.timetableId, draft.lessonDate)];
        if (!entry) throw new Error('فُقدت المسودة المحلية.');
        const sameDraft = entry.draft?.operationId === draft.operationId;
        if (error) {
          const explanation = error.code === '22023' ? 'تاريخ الحصة غير مقبول للإرسال الآن؛ احتفظ بالمسودة وراجع المؤسسة.'
            : error.code === '42501' ? 'لا يملك الحساب إذن إرسال هذه الحصة؛ تحقق من الدخول وتكليف المؤسسة.'
            : 'انتهت مهلة التصحيح أو أُغلق التسجيل أو تغيرت لائحة التلاميذ؛ راجع المؤسسة.';
          if (sameDraft) entry.draft = { ...draft, state: 'rejected', error: explanation };
          entry.history.push({ at: new Date().toISOString(), kind: 'rejected', draft: { ...draft, error: error.message } });
        } else if (data.outcome === 'conflict') {
          if (data.current) mergeConfirmed(local, { ...data.current, lesson: entry.lesson, source: 'server' });
          if (sameDraft) entry.draft = { ...draft, state: 'conflict', error: 'قارن إصدار الخادم بمسودتك قبل الاختيار.' };
          entry.history.push({ at: new Date().toISOString(), kind: 'conflict', draft });
        } else if (data.outcome === 'accepted' && data.receipt?.revision) {
          if (sameDraft) delete entry.draft;
          mergeConfirmed(local, { ...data.receipt, absentStudentIds: draft.absentStudentIds, lesson: item.lesson, source: 'server' });
          if (!entry.history.some((event) => event.kind === 'receipt' && event.operationId === draft.operationId)) {
            entry.history.push({ at: new Date().toISOString(), kind: 'receipt', operationId: draft.operationId });
          }
        } else throw new Error('لم يؤكد الخادم استلام العملية.');
      });
    }
  }
}
