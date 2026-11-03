import React, { useEffect, useMemo, useState } from 'react';
import { dbManager } from '../utils/database';

type Student = { id: string; firstName: string; lastName: string; section: string; studentId?: string; nationalId?: string };
type Lesson = { id: string; class: string; day: string; start_time: string; end_time: string; subject_arabic: string; teacher_name_arabic: string; room_name: string };
type Session = { id: string; date: string; section: string; timetableId: string; period: 'صباحية' | 'مسائية'; confirmedAt: string; startTime: string; endTime: string };
type Absence = { sessionId: string; studentId: string; status: string; justified: number; date: string; startTime: string; endTime: string; period: string };
type Period = 'صباحية' | 'مسائية';
const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const months = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'];
const localToday = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };
const periodOf = (lesson: Lesson): Period => {
  const suffix = (lesson.day || '').toLowerCase();
  if (suffix.endsWith('_s')) return 'مسائية';
  if (suffix.endsWith('_m')) return 'صباحية';
  return (lesson.start_time || '00:00') >= '12:00' ? 'مسائية' : 'صباحية';
};
const dateLessons = (lessons: Lesson[], date: string): Lesson[] => {
  if (!date) return [];
  const day = dayNames[new Date(date + 'T12:00:00').getDay()];
  return lessons.filter(l => (l.day || '').toLowerCase().split('_')[0] === day)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
};
const keyFor = (date: string, section: string, lessonId: string) => [date, section, lessonId].join('|');
const minutesOf = (from: string, to: string): number => {
  const parts = (time: string) => time.split(':').map(Number);
  const a = parts(from), b = parts(to);
  return Math.max(0, (b[0] * 60 + b[1]) - (a[0] * 60 + a[1]));
};
const readableDuration = (minutes: number) => (minutes / 60).toLocaleString('fr', { maximumFractionDigits: 2 }) + ' س';
const academicYearStart = (date: string) => {
  const year = Number(date.slice(0, 4));
  return Number(date.slice(5, 7)) >= 9 ? year : year - 1;
};

export const LessonAttendanceWorkspace: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [timetable, setTimetable] = useState<Lesson[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [section, setSection] = useState('');
  const [date, setDate] = useState(localToday());
  const [lessonId, setLessonId] = useState('');
  const [selectedAbsent, setSelectedAbsent] = useState<string[]>([]);
  const [cardStudentId, setCardStudentId] = useState('');
  const [tab, setTab] = useState<'capture' | 'card' | 'admin'>('capture');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');

  async function refresh(): Promise<void> {
    const [newSessions, newAbsences] = await Promise.all([dbManager.getLessonSessions(), dbManager.getLessonAbsences()]);
    setSessions(newSessions);
    setAbsences(newAbsences);
  }

  useEffect(() => {
    let live = true;
    async function boot() {
      try {
        await dbManager.initialize();
        const [ss, tt, regs, abs] = await Promise.all([
          dbManager.getStudents(), dbManager.getAllTimetable(), dbManager.getLessonSessions(), dbManager.getLessonAbsences()
        ]);
        if (!live) return;
        const castStudents = ss as Student[];
        const castLessons = tt as Lesson[];
        setStudents(castStudents);
        setTimetable(castLessons);
        setSessions(regs);
        setAbsences(abs);
        const firstSection = [...new Set(castStudents.map(s => s.section).filter(Boolean))].sort()[0] || '';
        setSection(firstSection);
      } catch (error) {
        if (live) setNotice('تعذر تحميل قاعدة البيانات: ' + String(error));
      } finally { if (live) setLoading(false); }
    }
    void boot();
    return () => { live = false; };
  }, []);

  const sections = useMemo(() => [...new Set(students.map(s => s.section).filter(Boolean))].sort(), [students]);
  const classStudents = useMemo(() => students.filter(s => s.section === section)
    .sort((a, b) => (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName, 'ar')), [students, section]);
  const classLessons = useMemo(() => timetable.filter(l => l.class === section), [timetable, section]);
  const scheduled = useMemo(() => dateLessons(classLessons, date), [classLessons, date]);
  const currentLesson = scheduled.find(l => l.id === lessonId);
  const selectedSession = currentLesson && sessions.find(s => s.id === keyFor(date, section, currentLesson.id));
  const cardStudent = classStudents.find(s => s.id === cardStudentId);
  const daySessions = sessions.filter(s => s.date === date && s.section === section);
  const absentSet = new Set(selectedAbsent);

  useEffect(() => {
    setLessonId(scheduled[0]?.id || '');
  }, [section, date, timetable]);
  useEffect(() => {
    const sessionKey = currentLesson ? keyFor(date, section, currentLesson.id) : '';
    setSelectedAbsent(absences.filter(a => a.sessionId === sessionKey && a.status === 'غائب').map(a => a.studentId));
  }, [lessonId, date, section, sessions, absences]);
  useEffect(() => {
    setCardStudentId(classStudents[0]?.id || '');
  }, [section, students]);

  async function save() {
    if (!currentLesson) return;
    setSaving(true);
    setNotice('');
    try {
      await dbManager.saveLessonAttendance({
        date, section, timetableId: currentLesson.id,
        subject: currentLesson.subject_arabic || '', teacher: currentLesson.teacher_name_arabic || '',
        startTime: currentLesson.start_time, endTime: currentLesson.end_time,
        period: periodOf(currentLesson), absentStudentIds: selectedAbsent
      });
      await refresh();
      setNotice('تم تأكيد الحصة وحفظ ' + selectedAbsent.length + ' غياب. يشمل التأكيد الحصص التي لا يوجد فيها غائبون.');
    } catch (error) {
      setNotice('فشل الحفظ: ' + String(error));
    } finally { setSaving(false); }
  }

  const startYear = academicYearStart(date);
  function cellFor(day: number, month: number, year: number, period: Period, studentId: string) {
    if (day > new Date(year, month, 0).getDate()) return null;
    const dateKey = [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
    const expected = dateLessons(classLessons, dateKey).filter(l => periodOf(l) === period);
    if (!expected.length) return { label: '—', title: 'لا حصص مبرمجة', state: 'empty' };
    const confirmed = expected.filter(l => sessions.some(s => s.id === keyFor(dateKey, section, l.id)));
    const absentCount = confirmed.filter(l => absences.some(a => a.sessionId === keyFor(dateKey, section, l.id) && a.studentId === studentId && a.status === 'غائب')).length;
    const absentMinutes = confirmed.reduce((total, l) => total + (absences.some(a => a.sessionId === keyFor(dateKey, section, l.id) && a.studentId === studentId && a.status === 'غائب') ? minutesOf(l.start_time, l.end_time) : 0), 0);
    const complete = confirmed.length === expected.length;
    if (!complete) return { label: '…', title: 'غير مكتمل: ' + confirmed.length + '/' + expected.length + ' حصص مؤكدة؛ الغياب المسجل: ' + readableDuration(absentMinutes), state: 'pending' };
    if (!absentCount) return { label: '', title: 'جميع الحصص مؤكدة: لا غياب', state: 'present' };
    if (absentCount === expected.length) return { label: 'X', title: 'غياب كامل: ' + readableDuration(absentMinutes), state: 'full' };
    return { label: absentCount + '/' + expected.length, title: 'غياب جزئي: ' + readableDuration(absentMinutes), state: 'partial' };
  }
  const cardMonths = months.map(month => ({ month, year: month >= 9 ? startYear : startYear + 1 }));

  const studentLessons = absences.filter(a => a.studentId === cardStudentId);
  const totalAbsentMinutes = studentLessons.reduce((sum, a) => sum + minutesOf(a.startTime, a.endTime), 0);
  const justifiedMinutes = studentLessons.filter(a => !!a.justified).reduce((sum, a) => sum + minutesOf(a.startTime, a.endTime), 0);
  const filtered = classStudents.filter(s => (s.firstName + ' ' + s.lastName + ' ' + (s.studentId || '')).toLowerCase().includes(query.toLowerCase()));

  if (loading) return <div className="p-6" dir="rtl">جاري تحميل بيانات الغياب...</div>;
  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-5 text-gray-900">
      <div className="rounded-xl bg-white border p-5">
        <h1 className="text-2xl font-bold">مسك الغياب حسب الحصص</h1>
        <p className="text-sm text-gray-600 mt-2">نسخة محسنة مرتبطة بجدول استعمال الزمن، مع بطاقة سنوية صباحًا ومساءً.</p>
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded p-3 mt-3">
          تنبيه تشغيلي: هذا المسار يستخدم حاليًا قاعدة SQL.js المحلية (IndexedDB) في نفس المتصفح.
          لا تتم مزامنة سجلات أساتذة مختلفين عبر الأجهزة؛ لا تعتمدوه كنظام مؤسسي متعدد المستخدمين
          قبل ربطه بخادم مركزي وتفعيل التوثيق والصلاحيات والنسخ الاحتياطي.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {([['capture', 'مسك الحصة'], ['card', 'بطاقة التلميذ'], ['admin', 'متابعة الإدارة']] as const).map(([id, label]) =>
          <button key={id} type="button" onClick={() => setTab(id)}
            className={'px-4 py-2 rounded-lg border font-semibold ' + (tab === id ? 'bg-blue-700 text-white' : 'bg-white text-gray-800')}>{label}</button>)}
      </div>
      <div className="rounded-xl bg-white border p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-1"><span className="font-semibold block">القسم</span>
          <select className="border rounded w-full p-2" value={section} onChange={e => setSection(e.target.value)}>
            {sections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="space-y-1"><span className="font-semibold block">التاريخ</span>
          <input type="date" className="border rounded w-full p-2" value={date} onChange={e => setDate(e.target.value)} />
        </label>
      </div>
      {notice && <div role="status" className="border bg-blue-50 rounded-lg p-3">{notice}</div>}
      {tab === 'capture' && (
        <div className="rounded-xl bg-white border p-4 space-y-4">
          <label className="block space-y-2">
            <span className="font-bold">الحصة المبرمجة</span>
            <select className="border rounded p-3 w-full" value={lessonId} onChange={e => setLessonId(e.target.value)}>
              {scheduled.length === 0 && <option value="">لا توجد حصص في جدول هذا اليوم</option>}
              {scheduled.map(l => <option key={l.id} value={l.id}>{l.start_time} – {l.end_time} | {l.subject_arabic} | {l.teacher_name_arabic}</option>)}
            </select>
          </label>
          {currentLesson && <>
            <div className="flex flex-wrap gap-3 items-center text-sm">
              <strong>{currentLesson.subject_arabic}</strong>
              <span>الأستاذ: {currentLesson.teacher_name_arabic}</span>
              <span>الفترة: {periodOf(currentLesson)}</span>
              <span className={selectedSession ? 'text-green-700 font-bold' : 'text-amber-700'}>
                {selectedSession ? 'حصة مؤكدة (يمكن تصحيحها)' : 'لم تؤكد بعد'}
              </span>
            </div>
            <input type="search" className="border rounded-lg p-2 w-full" placeholder="بحث عن تلميذ أو رقم مسار" value={query} onChange={e => setQuery(e.target.value)} />
            <p className="text-sm text-gray-600">الحاضرون افتراضيًا؛ اضغط «غائب» لتحديد الغائبين. لا يُحتسب الحضور قبل تأكيد الحصة.</p>
            <div className="space-y-2 max-h-[440px] overflow-y-auto">
              {filtered.map(s => <button type="button" key={s.id}
                className={'w-full flex items-center justify-between text-right rounded-lg border p-3 ' + (absentSet.has(s.id) ? 'bg-red-50 border-red-300' : 'bg-white')}
                onClick={() => setSelectedAbsent(old => old.includes(s.id) ? old.filter(id => id !== s.id) : [...old, s.id])}>
                <span>{s.lastName} {s.firstName} <span className="text-gray-500 text-xs">{s.studentId}</span></span>
                <strong className={absentSet.has(s.id) ? 'text-red-700' : 'text-green-700'}>{absentSet.has(s.id) ? 'غائب ✕' : 'حاضر ✓'}</strong>
              </button>)}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <strong>الغائبون: {selectedAbsent.length} / {classStudents.length}</strong>
              <button type="button" disabled={saving} onClick={save} className="bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg px-5 py-3 disabled:opacity-50">
                {saving ? 'جاري الحفظ' : 'تأكيد الحصة وحفظ الغياب'}
              </button>
            </div>
          </>}
        </div>
      )}
      {tab === 'admin' && (
        <div className="rounded-xl bg-white border p-4 space-y-3">
          <h2 className="text-lg font-bold">متابعة مسك الحصص — {date}</h2>
          <p>الحصص المؤكدة: {daySessions.length} من {scheduled.length} | الحصص غير المؤكدة: {Math.max(0, scheduled.length - daySessions.length)}</p>
          {scheduled.map(l => {
            const item = daySessions.find(s => s.id === keyFor(date, section, l.id));
            const count = absences.filter(a => a.sessionId === keyFor(date, section, l.id)).length;
            return <div key={l.id} className="flex justify-between gap-3 border-b p-2 text-sm">
              <span>{l.start_time} – {l.end_time} | {l.subject_arabic} | {l.teacher_name_arabic}</span>
              <span className={item ? 'text-green-700' : 'text-amber-700'}>{item ? 'مؤكدة: ' + count + ' غائب' : 'غير مؤكدة'}</span>
            </div>;
          })}
        </div>
      )}
      {tab === 'card' && (
        <div className="space-y-4">
          <label className="block bg-white border rounded-xl p-4 space-y-2">
            <span className="font-bold block">التلميذ</span>
            <select className="border rounded w-full p-2" value={cardStudentId} onChange={e => setCardStudentId(e.target.value)}>
              {classStudents.map(s => <option key={s.id} value={s.id}>{s.lastName} {s.firstName} — {s.studentId || s.nationalId}</option>)}
            </select>
          </label>
          {cardStudent && <div className="bg-white border rounded-xl p-4 space-y-3" id="annual-absence-card">
            <div className="flex flex-wrap justify-between gap-2">
              <div><h2 className="font-bold text-xl">بطاقة تتبع الغياب الفردية</h2>
                <p>{cardStudent.lastName} {cardStudent.firstName} — القسم {section} — السنة الدراسية {startYear}/{startYear + 1}</p>
              </div>
              <button type="button" onClick={() => window.print()} className="border rounded px-4 py-2 print:hidden">طباعة البطاقة</button>
            </div>
            <div className="text-sm bg-gray-50 rounded p-2">
              مجموع الغياب المسجل: <strong>{readableDuration(totalAbsentMinutes)}</strong> |
              المبرر: <strong>{readableDuration(justifiedMinutes)}</strong> |
              غير المبرر: <strong>{readableDuration(totalAbsentMinutes - justifiedMinutes)}</strong>
            </div>
            <p className="text-xs text-gray-600">X = غياب كامل في فترة مؤكدة بجميع حصصها؛ 1/4 = غياب جزئي؛ … = توجد حصص لم يؤكد الأستاذ تسجيلها بعد؛ — = لا حصص مبرمجة.</p>
            <div className="overflow-x-auto">
              <table className="text-center text-xs border-collapse w-full">
                <thead><tr className="bg-gray-100"><th className="border p-1">الشهر</th><th className="border p-1">الفترة</th>
                  {Array.from({ length: 31 }, (_, i) => <th className="border p-1" key={i}>{i + 1}</th>)}
                </tr></thead>
                <tbody>{cardMonths.flatMap(({ month, year }) => (['صباحية', 'مسائية'] as Period[]).map(period =>
                  <tr key={year + '-' + month + period}>
                    {period === 'صباحية' && <th className="border p-1 bg-gray-50" rowSpan={2}>{monthNames[month - 1]} {year}</th>}
                    <th className="border p-1">{period}</th>
                    {Array.from({ length: 31 }, (_, i) => {
                      const item = cellFor(i + 1, month, year, period, cardStudent.id);
                      return <td key={i} title={item?.title || ''} className={'border p-1 min-w-5 ' +
                        (item?.state === 'full' ? 'bg-red-100 text-red-800 font-bold' :
                         item?.state === 'partial' ? 'bg-orange-100 text-orange-900' :
                         item?.state === 'pending' ? 'bg-amber-50 text-amber-700' : '')}>{item?.label || ''}</td>;
                    })}
                  </tr>))}</tbody>
              </table>
            </div>
          </div>}
        </div>
      )}
    </div>
  );
};
