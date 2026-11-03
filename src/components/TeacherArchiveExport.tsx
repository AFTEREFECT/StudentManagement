import { useState } from 'react';
import { attendanceCloud, getAttendanceProfile } from '../utils/attendanceCloud';
import type { ReceivedAttendance } from '../utils/attendanceStartupSync';
import { schoolYear } from '../../teacher/offline/model';
import type { TeacherArchivePayload } from '../../teacher/offline/archive';
import { encryptArchiveEnvelope } from '../../teacher/offline/archiveTransport';

export default function TeacherArchiveExport({ rows, institutionId }: { rows: ReceivedAttendance[]; institutionId: string | null }) {
  const [teacherId, setTeacherId] = useState('');
  const [year, setYear] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [transferSecret, setTransferSecret] = useState('');
  const [startMonth, setStartMonth] = useState(9);
  const [termMonth, setTermMonth] = useState(2);
  const teachers = [...new Map(rows.map((row) => [row.teacher_id, row.teacherName])).entries()];
  const years = [...new Set(rows.map((row) => schoolYear(row.lesson_date, startMonth)))].sort().reverse();
  async function exportArchive() {
    if (!window.desktopAttendance || !attendanceCloud || !teacherId || !year || !institutionId) return;
    setBusy(true); setMessage('');
    try {
      const profile = await getAttendanceProfile();
      if (profile?.role !== 'admin' || profile.institution_id !== institutionId) throw new Error('يلزم دخول مسؤول المؤسسة المطابقة.');
      const settings = await attendanceCloud.from('attendance_settings').select('academic_year_start_month, second_semester_month')
        .eq('institution_id', institutionId).maybeSingle();
      if (settings.error) throw settings.error;
      const start = settings.data?.academic_year_start_month || 9;
      const term = settings.data?.second_semester_month || 2;
      if (start !== startMonth) { setStartMonth(start); setTermMonth(term); setYear(''); throw new Error('تم تحميل تقويم المؤسسة؛ اختر السنة مجددًا.'); }
      const selected = rows.filter((row) => row.institution_id === institutionId && row.teacher_id === teacherId && schoolYear(row.lesson_date, start) === year);
      if (!selected.length) throw new Error('لا توجد سجلات محلية للأستاذ والسنة المختارين.');
      const key = await window.desktopAttendance.archiveKey();
      const registered = await attendanceCloud.rpc('register_attendance_archive_key', { p_key_id: key.keyId, p_public_jwk: key.publicJwk });
      if (registered.error) throw registered.error;
      const payload: TeacherArchivePayload = { format: 'progtalamid-teacher-archive-v1', institutionId, teacherUserId: teacherId,
        year, startMonth: start, secondSemesterMonth: term, exportedAt: new Date().toISOString(),
        students: [...new Map(selected.flatMap((row) => row.marks.map((mark) => [mark.student_id,
          { id: mark.student_id, display_name: mark.display_name, class_name: row.lesson.class_name }] as const))).values()],
        records: selected.map((row) => ({ id: row.id, revision: row.sync_revision, timetableId: row.timetable_id,
          lessonDate: row.lesson_date, status: row.status, submittedAt: row.submitted_at, editDeadline: row.edit_deadline,
          absentStudentIds: row.marks.map((mark) => mark.student_id), source: 'institution',
          lesson: { ...row.lesson, subject_code: '', day_of_week: new Date(`${row.lesson_date}T12:00Z`).getUTCDay(), room: '' } })),
      };
      const envelope = await window.desktopAttendance.signArchive(JSON.stringify(payload));
      const encrypted = await encryptArchiveEnvelope(envelope, transferSecret);
      const url = URL.createObjectURL(new Blob([JSON.stringify(encrypted)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `teacher-archive-${year}-${teacherId}.json`; anchor.click(); URL.revokeObjectURL(url);
      setTransferSecret('');
      setMessage('أُنشئ أرشيف مشفر وموقّع خاص بهذا الأستاذ. سلّم رمز فتحه عبر قناة منفصلة؛ لا يُرفع الغياب إلى السحابة.');
    } catch (error) { setMessage(error && typeof error === 'object' && 'message' in error ? String(error.message) : 'تعذر التصدير.'); }
    finally { setBusy(false); }
  }
  async function saveCalendar() {
    if (!attendanceCloud) return;
    setBusy(true);
    try {
      const result = await attendanceCloud.rpc('set_attendance_academic_calendar', { p_start_month: startMonth, p_second_semester: termMonth });
      if (result.error) throw result.error;
      setMessage('حُفظ التقويم. اعتمد التغييرات قبل بداية السنة؛ الأرشيفات القديمة تحتفظ بحدودها.');
    } catch { setMessage('تعذر حفظ تقويم المؤسسة؛ تحقق من صلاحيات الإدارة.'); }
    finally { setBusy(false); }
  }
  return <details className="mt-3 rounded border p-3"><summary>استعادة سنة الأستاذ من أرشيف المؤسسة</summary>
    <div className="mt-3 flex flex-wrap gap-3">
      <label>بداية السنة (شهر) <input aria-label="شهر بداية السنة" type="number" min="1" max="12" value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))} className="w-16 border" /></label>
      <label>بداية الفصل الثاني <input aria-label="شهر الفصل الثاني" type="number" min="1" max="12" value={termMonth} onChange={(e) => setTermMonth(Number(e.target.value))} className="w-16 border" /></label>
      <button disabled={busy} onClick={() => void saveCalendar()} className="underline">حفظ التقويم</button>
    </div>
    <div className="mt-3 flex flex-wrap gap-3">
      <select aria-label="الأستاذ المطلوب أرشيفه" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="border"><option value="">اختر الأستاذ</option>{teachers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <select aria-label="السنة المطلوب استعادتها" value={year} onChange={(e) => setYear(e.target.value)} className="border"><option value="">اختر السنة</option>{years.map((item) => <option key={item}>{item}</option>)}</select>
      <label>رمز تسليم الملف (12 حرفًا على الأقل)<input type="password" autoComplete="off" value={transferSecret} onChange={(e) => setTransferSecret(e.target.value)} className="border" /></label>
      <button disabled={busy || !teacherId || !year || transferSecret.length < 12} onClick={() => void exportArchive()} className="underline disabled:opacity-50">تصدير ملف الأستاذ المشفر والموقّع</button>
    </div>{message && <p role="status" className="mt-2">{message}</p>}
  </details>;
}
