import type { AttendanceProfile, CloudLesson, CloudStudent } from '../../src/utils/attendanceCloud';

export type TeacherIdentity = Pick<AttendanceProfile, 'user_id' | 'institution_id' | 'display_name' | 'role' | 'must_change_password'>;
export interface ConfirmedRecord {
  id: string; revision: string; timetableId: string; lessonDate: string;
  status: 'submitted' | 'confirmed' | 'cancelled'; submittedAt: string; editDeadline: string;
  absentStudentIds: string[]; lesson: CloudLesson; source: 'server' | 'institution'; institutionExportedAt?: string;
}
export interface Draft {
  operationId: string; timetableId: string; lessonDate: string; absentStudentIds: string[];
  expectedRevision: string; savedAt: string; state: 'pending' | 'conflict' | 'rejected'; error?: string;
}
export interface Entry {
  lesson: CloudLesson; confirmed?: ConfirmedRecord; draft?: Draft;
  history: Array<{ at: string; kind: string; operationId?: string; record?: ConfirmedRecord; draft?: Draft }>;
}
export interface YearData {
  schema: 1; institutionId: string; teacherUserId: string; year: string;
  startMonth: number; secondSemesterMonth: number; lessons: CloudLesson[]; students: CloudStudent[]; activeStudentIds: string[];
  entries: Record<string, Entry>; archiveKeys: Array<{ keyId: string; jwk: JsonWebKey }>; refreshedAt?: string;
}
export const entryKey = (lessonId: string, date: string) => `${date}:${lessonId}`;
export function localDate(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Casablanca',
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function schoolYear(date: string, startMonth = 9) {
  const start = Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < startMonth ? 1 : 0);
  return `${start}-${start + 1}`;
}
export function newYear(identity: TeacherIdentity, year: string, startMonth = 9, secondSemesterMonth = 2): YearData {
  return { schema: 1, institutionId: identity.institution_id, teacherUserId: identity.user_id, year,
    startMonth, secondSemesterMonth, lessons: [], students: [], activeStudentIds: [], entries: {}, archiveKeys: [] };
}
export function saveDraft(data: YearData, lesson: CloudLesson, date: string, ids: string[], expectedOperation?: string, baseRevision?: string) {
  if (schoolYear(date, data.startMonth) !== data.year) throw new Error('التاريخ خارج السنة المختارة.');
  const key = entryKey(lesson.id, date);
  const entry = data.entries[key] ||= { lesson, history: [] };
  if ((entry.draft?.operationId || undefined) !== expectedOperation) throw new Error('تغيرت المسودة في نافذة أخرى؛ أعد تحميل الحصة.');
  if (entry.draft) entry.history.push({ at: new Date().toISOString(), kind: 'superseded-draft', draft: entry.draft });
  entry.draft = { operationId: crypto.randomUUID(), timetableId: lesson.id, lessonDate: date,
    absentStudentIds: [...new Set(ids)].sort(), expectedRevision: baseRevision || entry.confirmed?.revision || '0',
    savedAt: new Date().toISOString(), state: 'pending' };
  entry.lesson = lesson;
  entry.history.push({ at: entry.draft.savedAt, kind: 'draft', operationId: entry.draft.operationId, draft: { ...entry.draft } });
  return entry.draft;
}
export function mergeConfirmed(data: YearData, record: ConfirmedRecord) {
  // Whitelist persisted fields even for a correctly signed institution file.
  record = { id: record.id, revision: record.revision, timetableId: record.timetableId, lessonDate: record.lessonDate,
    status: record.status, submittedAt: record.submittedAt, editDeadline: record.editDeadline,
    absentStudentIds: [...new Set(record.absentStudentIds)].sort(), source: record.source, institutionExportedAt: record.institutionExportedAt,
    lesson: { id: record.lesson.id, class_name: record.lesson.class_name, subject_code: record.lesson.subject_code,
      subject_name: record.lesson.subject_name, day_of_week: record.lesson.day_of_week,
      start_time: record.lesson.start_time, end_time: record.lesson.end_time, room: record.lesson.room } };
  if (schoolYear(record.lessonDate, data.startMonth) !== data.year) throw new Error('السجل خارج السنة الدراسية.');
  const entry = data.entries[entryKey(record.timetableId, record.lessonDate)] ||= { lesson: record.lesson, history: [] };
  if (entry.confirmed?.source === 'institution' && record.source === 'server' && BigInt(record.revision) <= BigInt(entry.confirmed.revision)) return;
  if (entry.confirmed && BigInt(entry.confirmed.revision) > BigInt(record.revision)) return;
  if (entry.confirmed?.source === 'institution' && record.source === 'institution'
    && entry.confirmed.revision === record.revision && (entry.confirmed.institutionExportedAt || '') > (record.institutionExportedAt || '')) return;
  if (entry.confirmed && entry.confirmed.revision === record.revision && entry.confirmed.source === record.source
    && JSON.stringify(entry.confirmed) === JSON.stringify(record)) return;
  entry.confirmed = record;
  entry.lesson = record.lesson;
  entry.history.push({ at: new Date().toISOString(), kind: record.source, record: structuredClone(record) });
  if (entry.draft && entry.draft.expectedRevision !== record.revision) {
    entry.draft.state = 'conflict';
    entry.draft.error = 'يوجد إصدار أحدث؛ قارن النسختين قبل إعادة الإرسال.';
  }
}
export function statistics(data: YearData, from: string, to: string, className = '', subjectCode = '') {
  const totals = { lessons: 0, absences: 0, absentHours: 0, studentDays: 0, institutionApproved: 0, pendingDrafts: 0 };
  const days = new Set<string>();
  for (const entry of Object.values(data.entries)) {
    const item = entry.confirmed;
    const date = item?.lessonDate || entry.draft?.lessonDate || '';
    if (date < from || date > to || (className && entry.lesson.class_name !== className)
      || (subjectCode && (entry.lesson.subject_code || entry.lesson.subject_name) !== subjectCode)) continue;
    if (entry.draft) totals.pendingDrafts++;
    if (!item || item.status === 'cancelled') continue;
    totals.lessons++;
    if (item.status === 'confirmed') totals.institutionApproved++;
    totals.absences += item.absentStudentIds.length;
    const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
    totals.absentHours += Math.max(0, minutes(item.lesson.end_time) - minutes(item.lesson.start_time)) / 60 * item.absentStudentIds.length;
    item.absentStudentIds.forEach((id) => days.add(`${item.lessonDate}:${id}`));
  }
  totals.studentDays = days.size;
  return totals;
}
export function periodRange(data: YearData, period: 'month' | 'semester1' | 'semester2' | 'year', month: string) {
  const y = Number(data.year.slice(0, 4));
  const start = `${y}-${String(data.startMonth).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(y + 1, data.startMonth - 1, 0)).toISOString().slice(0, 10);
  const splitYear = y + (data.secondSemesterMonth < data.startMonth ? 1 : 0);
  const split = `${splitYear}-${String(data.secondSemesterMonth).padStart(2, '0')}-01`;
  const firstEnd = new Date(Date.UTC(splitYear, data.secondSemesterMonth - 1, 0)).toISOString().slice(0, 10);
  if (period === 'semester1') return [start, firstEnd];
  if (period === 'semester2') return [split, end];
  if (period === 'month' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [`${month}-01`, new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10)];
  return [start, end];
}
