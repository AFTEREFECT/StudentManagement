import { mergeConfirmed, newYear, type ConfirmedRecord, type TeacherIdentity } from './model';
import { teacherVault, type TeacherVault } from './vault';
import { decryptArchiveEnvelope } from './archiveTransport';

export interface TeacherArchivePayload {
  format: 'progtalamid-teacher-archive-v1'; institutionId: string; teacherUserId: string;
  year: string; startMonth: number; secondSemesterMonth: number; exportedAt: string;
  students: Array<{ id: string; display_name: string; class_name: string }>; records: ConfirmedRecord[];
}
const base64 = (text: string) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
export async function importInstitutionArchive(text: string, trustedKeys: Array<{ keyId: string; jwk: JsonWebKey }>, vault: TeacherVault = teacherVault, transferSecret = '') {
  const identity = vault.profile;
  if (!identity) throw new Error('افتح حسابك أولًا.');
  if (text.length > 30_000_000) throw new Error('ملف الأرشيف أكبر من الحد المسموح.');
  const envelope = await decryptArchiveEnvelope(JSON.parse(text), transferSecret);
  if (typeof envelope.payload !== 'string' || typeof envelope.signature !== 'string') throw new Error('ملف أرشيف غير صالح.');
  const trusted = trustedKeys.find((key) => key.keyId === envelope.keyId);
  if (!trusted) throw new Error('مفتاح المؤسسة غير موثوق؛ حدّث بيانات الحساب عبر الإنترنت أولًا.');
  const key = await crypto.subtle.importKey('jwk', trusted.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, base64(envelope.signature), new TextEncoder().encode(envelope.payload))) {
    throw new Error('توقيع المؤسسة غير صحيح؛ لم يُستورد أي سجل.');
  }
  const payload: TeacherArchivePayload = JSON.parse(envelope.payload);
  validateArchive(payload, identity);
  await vault.mutate(payload.year, () => newYear(identity, payload.year, payload.startMonth, payload.secondSemesterMonth), (data) => {
    const students = new Map(data.students.map((student) => [student.id, student]));
    payload.students.forEach((student) => students.set(student.id, { id: student.id, display_name: student.display_name, class_name: student.class_name }));
    data.students = [...students.values()];
    payload.records.forEach((record) => mergeConfirmed(data, { ...record, source: 'institution', institutionExportedAt: payload.exportedAt }));
    data.archiveKeys = trustedKeys;
  });
  return payload.year;
}
function validateArchive(payload: TeacherArchivePayload, identity: TeacherIdentity) {
  if (payload.format !== 'progtalamid-teacher-archive-v1' || payload.institutionId !== identity.institution_id
    || payload.teacherUserId !== identity.user_id || !/^\d{4}-\d{4}$/.test(payload.year)
    || !Array.isArray(payload.records) || !Array.isArray(payload.students)
    || !Number.isInteger(payload.startMonth) || !Number.isInteger(payload.secondSemesterMonth)
    || payload.startMonth < 1 || payload.startMonth > 12 || payload.secondSemesterMonth < 1 || payload.secondSemesterMonth > 12
    || !Number.isFinite(new Date(payload.exportedAt).getTime())) {
    throw new Error('الأرشيف لا يطابق المؤسسة وحساب الأستاذ والسنة الدراسية.');
  }
  for (const record of payload.records) {
    if (!record.lesson || record.lesson.id !== record.timetableId || !/^\d+$/.test(record.revision)
      || !Array.isArray(record.absentStudentIds) || !['submitted', 'confirmed', 'cancelled'].includes(record.status)) {
      throw new Error('بنية سجلات الأرشيف غير صالحة.');
    }
  }
}
