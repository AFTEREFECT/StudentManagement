import React, { useEffect, useState } from 'react';
import ExcelJS from 'exceljs';
import { Download, FileSpreadsheet } from 'lucide-react';
import { dbManager } from '../utils/database';
import { attendanceCloud } from '../utils/attendanceCloud';
import type { ReceivedAttendance } from '../utils/attendanceStartupSync';

interface LocalRosterStudent {
  id: string;
  nationalId?: string;
  firstName?: string;
  lastName?: string;
  studentId?: string;
  section?: string;
  level?: string;
  status?: string;
}

interface AbsenceTotals {
  excusedDates: Set<string>;
  unexcusedDates: Set<string>;
  excusedHours: number;
  unexcusedHours: number;
}

interface Props {
  institutionId: string;
}

function textValue(value: ExcelJS.CellValue | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in value) return String(value.text).trim();
  return String(value).trim();
}

function arabicMonth(month: number): string {
  return [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
    'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر',
  ][month - 1];
}

function lessonDurationHours(start: string, end: string): number {
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  };
  const duration = toMinutes(end) - toMinutes(start);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`مدة الحصة غير صالحة: ${start}–${end}`);
  }
  return duration / 60;
}

export const AttendanceMonthlyExport: React.FC<Props> = ({ institutionId }) => {
  const [roster, setRoster] = useState<LocalRosterStudent[]>([]);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [cycle, setCycle] = useState('الدورة الأولى');
  const [template, setTemplate] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    dbManager.initialize()
      .then(() => dbManager.getStudents())
      .then((students) => {
        const currentRoster = (students as LocalRosterStudent[]).filter((student) =>
          student.id &&
          student.section &&
          ['نشط', 'متمدرس'].includes(student.status || '')
        );
        setRoster(currentRoster);
        const classes = [...new Set(currentRoster.map((student) => String(student.section)))].sort((a, b) => a.localeCompare(b, 'ar'));
        setClassNames(classes);
        setSelectedClass((previous) => previous || classes[0] || '');
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل الأقسام المحلية.'));
  }, []);

  const exportMonth = async () => {
    if (!attendanceCloud && !window.desktopAttendance) {
      setError('إعدادات الاتصال بالسحابة غير مكتملة.');
      return;
    }
    if (!template || !selectedClass || !month) {
      setError('اختر القالب الرسمي والقسم والشهر قبل التصدير.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const [yearText, monthText] = month.split('-');
      const year = Number(yearText);
      const monthNumber = Number(monthText);
      if (!year || monthNumber < 1 || monthNumber > 12) throw new Error('صيغة الشهر غير صحيحة.');
      const startDate = `${month}-01`;
      const monthEnd = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await template.arrayBuffer());
      const worksheet = workbook.getWorksheet('Data') || workbook.worksheets[0];
      if (!worksheet) throw new Error('القالب لا يحتوي على ورقة بيانات.');
      if (textValue(worksheet.getCell('F9').value) !== 'غياب مبرر' ||
          textValue(worksheet.getCell('H9').value) !== 'غياب غير مبرر' ||
          textValue(worksheet.getCell('F10').value) !== 'عدد الأيام' ||
          textValue(worksheet.getCell('G10').value) !== 'عدد الساعات' ||
          textValue(worksheet.getCell('H10').value) !== 'عدد الأيام' ||
          textValue(worksheet.getCell('I10').value) !== 'عدد الساعات') {
        throw new Error('بنية القالب لا تطابق النموذج الشهري المتوقع؛ لم يتم تعديل الملف.');
      }

      const localClassStudents = roster.filter((student) => student.section === selectedClass);
      if (!localClassStudents.length) throw new Error('القسم المحدد لا يحتوي على تلاميذ نشطين.');
      if (localClassStudents.some((student) => !String(student.nationalId || '').trim())) {
        throw new Error('يوجد تلميذ في القسم دون رمز مسار محلي؛ أكمل بياناته قبل التصدير الرسمي.');
      }
      const byLocalId = new Map(localClassStudents.map((student) => [student.id, student]));
      const links = await dbManager.getAttendanceCloudLinks('student');
      const localByCloudId = new Map(
        Object.entries(links)
          .filter(([localId]) => byLocalId.has(localId))
          .map(([localId, cloudId]) => [cloudId, byLocalId.get(localId)!])
      );
      const localByNationalId = new Map(
        localClassStudents
          .filter((student) => student.nationalId)
          .map((student) => [String(student.nationalId).trim(), student])
      );

      const worksheetStudents = new Map<string, number>();
      for (let rowNumber = 11; rowNumber <= worksheet.rowCount; rowNumber++) {
        const massarId = textValue(worksheet.getCell(rowNumber, 3).value);
        if (massarId) {
          if (worksheetStudents.has(massarId)) throw new Error(`رمز مسار مكرر في القالب: ${massarId}`);
          worksheetStudents.set(massarId, rowNumber);
        }
      }
      const localMassarIds = new Set(localByNationalId.keys());
      const missingFromTemplate = [...localMassarIds].filter((id) => !worksheetStudents.has(id));
      const unknownInTemplate = [...worksheetStudents.keys()].filter((id) => !localByNationalId.has(id));
      if (missingFromTemplate.length || unknownInTemplate.length) {
        throw new Error(
          `قائمة القالب لا تطابق القسم المحلي. غير موجود في القالب: ${missingFromTemplate.length}، ` +
          `غير مطابق للقسم في القالب: ${unknownInTemplate.length}. حدّث القالب الرسمي أو لائحة التلاميذ قبل التصدير.`
        );
      }

      const institution = await dbManager.getInstitutionSettings();
      const levelName = localClassStudents[0]?.level || '';
      const metadata = [
        ['D4', institution?.academy],
        ['G4', institution?.directorate],
        ['D5', institution?.institution],
        ['G5', institution?.academicYear],
        ['D6', levelName],
        ['G6', selectedClass],
        ['D7', arabicMonth(monthNumber)],
        ['G7', cycle],
      ] as const;
      const missingMetadata = metadata.filter(([, value]) => !String(value || '').trim());
      if (missingMetadata.length) {
        throw new Error('بيانات المؤسسة ناقصة (الأكاديمية أو المديرية أو المؤسسة أو السنة الدراسية أو المستوى)، أكملها في إعدادات المؤسسة قبل التصدير.');
      }
      metadata.forEach(([address, value]) => { worksheet.getCell(address).value = value; });

      const archived = window.desktopAttendance
        ? (await dbManager.getReceivedAttendance(institutionId)).filter((row) =>
          row.lesson.class_name === selectedClass && row.lesson_date >= startDate && row.lesson_date <= monthEnd)
        : null;
      let classTimetable: Array<Pick<ReceivedAttendance['lesson'], 'id' | 'start_time' | 'end_time'>>;
      let sessions: Array<Pick<ReceivedAttendance, 'id' | 'lesson_date' | 'status' | 'timetable_id'>>;
      let receivedMarks: Array<{ id: string; session_id: string; student_id: string }> = [];
      if (archived) {
        classTimetable = [...new Map(archived.map((row) => [row.lesson.id, row.lesson])).values()];
        sessions = archived;
        receivedMarks = archived.filter((row) => row.status === 'confirmed')
          .flatMap((row) => row.marks.map((mark) => ({ ...mark, session_id: row.id })));
      } else {
        const { data: remoteTimetable, error: timetableError } = await attendanceCloud!
          .from('attendance_timetable')
          .select('id, start_time, end_time')
          .eq('institution_id', institutionId)
          .eq('class_name', selectedClass);
        if (timetableError) throw timetableError;
        classTimetable = remoteTimetable || [];
        if (!classTimetable.length) throw new Error('لا يوجد استعمال زمن منشور لهذا القسم.');

        const { data: remoteSessions, error: sessionError } = await attendanceCloud!
          .from('attendance_sessions')
          .select('id, lesson_date, status, timetable_id')
          .gte('lesson_date', startDate)
          .lte('lesson_date', monthEnd)
          .in('timetable_id', classTimetable.map((lesson) => lesson.id));
        if (sessionError) throw sessionError;
        sessions = remoteSessions || [];
      }
      const timetableById = new Map(classTimetable.map((lesson) => [lesson.id, lesson]));
      const pendingCount = (sessions || []).filter((session) => session.status === 'submitted').length;
      if (pendingCount) throw new Error(`هناك ${pendingCount} تسجيلات بانتظار مراجعة الإدارة في هذا الشهر؛ راجعها قبل التصدير.`);
      const confirmedSessions = (sessions || []).filter((session) => session.status === 'confirmed');
      const totalsByLocalStudent = new Map<string, AbsenceTotals>();
      if (confirmedSessions.length) {
        let marks = receivedMarks;
        if (!archived) {
          const { data: remoteMarks, error: marksError } = await attendanceCloud!
            .from('attendance_marks')
            .select('id, session_id, student_id')
            .in('session_id', confirmedSessions.map((session) => session.id));
          if (marksError) throw marksError;
          marks = remoteMarks || [];
        }
        const localReviews = await dbManager.getAttendanceLocalJustifications((marks || []).map((mark) => mark.id));
        const sessionById = new Map(confirmedSessions.map((session) => [session.id, session]));

        for (const mark of marks || []) {
          const student = localByCloudId.get(mark.student_id);
          const session = sessionById.get(mark.session_id);
          const lesson = session ? timetableById.get(session.timetable_id) : undefined;
          if (!student) {
            throw new Error('تعذر ربط غياب سحابي بتلميذ محلي. أعد مزامنة اللائحة أو أصلح الربط قبل التصدير.');
          }
          if (!session || !lesson) continue;
          const isJustified = localReviews[mark.id]?.status === 'justified';
          const totals = totalsByLocalStudent.get(student.id) || {
            excusedDates: new Set<string>(),
            unexcusedDates: new Set<string>(),
            excusedHours: 0,
            unexcusedHours: 0,
          };
          const duration = lessonDurationHours(lesson.start_time, lesson.end_time);
          if (isJustified) {
            totals.excusedDates.add(session.lesson_date);
            totals.excusedHours += duration;
          } else {
            totals.unexcusedDates.add(session.lesson_date);
            totals.unexcusedHours += duration;
          }
          totalsByLocalStudent.set(student.id, totals);
        }
      }

      for (const student of localClassStudents) {
        const massarId = String(student.nationalId || '').trim();
        const rowNumber = worksheetStudents.get(massarId);
        if (!rowNumber) continue;
        const totals = totalsByLocalStudent.get(student.id);
        worksheet.getCell(rowNumber, 6).value = totals?.excusedDates.size || 0;
        worksheet.getCell(rowNumber, 7).value = Number((totals?.excusedHours || 0).toFixed(2));
        worksheet.getCell(rowNumber, 8).value = totals?.unexcusedDates.size || 0;
        worksheet.getCell(rowNumber, 9).value = Number((totals?.unexcusedHours || 0).toFixed(2));
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([new Uint8Array(buffer)], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `غياب_${selectedClass}_${month}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(`تم إنشاء الملف وفق القالب المرفق. شمل ${localClassStudents.length} تلميذًا و${confirmedSessions.length} تسجيلات معتمدة.`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'تعذر إنشاء الملف الشهري.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><FileSpreadsheet className="h-5 w-5 text-cyan-700" /> التصدير الشهري إلى النموذج الرسمي</h2>
      <p className="mb-4 text-sm leading-6 text-slate-600">ارفع نسخة القالب الرسمي، ثم اختر القسم والشهر. تُكتب المجاميع في أعمدة النموذج مع الحفاظ على بنيته؛ لا يُرفع الملف أو رموز مسار إلى السحابة.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-semibold">القالب الرسمي
          <input type="file" accept=".xlsx" onChange={(event) => setTemplate(event.target.files?.[0] || null)} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
        </label>
        <label className="text-sm font-semibold">القسم
          <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-3">
            {classNames.map((className) => <option key={className}>{className}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">الشهر
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-3" />
        </label>
        <label className="text-sm font-semibold">الدورة
          <select value={cycle} onChange={(event) => setCycle(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-3">
            <option>الدورة الأولى</option>
            <option>الدورة الثانية</option>
          </select>
        </label>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      <button disabled={busy || !classNames.length} onClick={() => void exportMonth()} className="mt-4 flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-3 font-bold text-white disabled:opacity-50">
        <Download className="h-5 w-5" /> {busy ? 'جارٍ التحقق والتصدير...' : 'إنشاء الملف الشهري'}
      </button>
    </section>
  );
};

export default AttendanceMonthlyExport;
