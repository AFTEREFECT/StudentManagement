import React, { useEffect, useState } from 'react';
import { loadAttendanceTestData, readTestRecords, reviewTestAttendance, sampleAttendanceData, saveTestAttendance, TestData, TestRecord } from '../utils/attendanceSandbox';
import { getAttendanceErrorMessage } from '../utils/attendanceErrors';



export default function AttendanceTestPortal({ onExit }: { onExit: () => void }): React.ReactElement {
  const [data, setData] = useState<TestData | null>(null);
  const [role, setRole] = useState<'teacher' | 'admin'>('teacher');
  const [teacherId, setTeacherId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [date, setDate] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  const [records, setRecords] = useState<TestRecord[]>([]);
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    loadAttendanceTestData().then((loaded) => {
      if (!mounted) return;
      setData(loaded);
      const teacher = loaded.lessons[0]?.teacherId || loaded.teachers[0]?.id || '';
      setTeacherId(teacher);
      setLessonId(loaded.lessons.find((row) => row.teacherId === teacher)?.id || '');
      setRecords(readTestRecords());
    }).catch((loadError: unknown) => {
      if (mounted) setError(getAttendanceErrorMessage(loadError, 'تعذر تحميل البيانات المحلية.'));
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setAbsentIds(new Set(records.find((row) => row.lessonId === lessonId && row.date === date)?.absentIds || []));
  }, [records, lessonId, date]);

  const lesson = data?.lessons.find((row) => row.id === lessonId);
  const students = data?.students.filter((row) => row.className === lesson?.className) || [];
  const selectTeacher = (id: string) => {
    setTeacherId(id);
    setLessonId(data?.lessons.find((row) => row.teacherId === id)?.id || '');
    setMessage('');
  };
  const useSample = () => {
    const sample = sampleAttendanceData();
    setData(sample); setTeacherId(sample.teachers[0].id); setLessonId(sample.lessons[0].id); setError('');
  };
  const save = () => {
    if (!data) return;
    try {
      setRecords(saveTestAttendance(data, lessonId, date, [...absentIds]));
      setError(''); setMessage('حُفظ تسجيل الاختبار محليًا. يمكنك تعديله في أي وقت أو مراجعته من واجهة الإدارة.');
    } catch (saveError) { setError(getAttendanceErrorMessage(saveError, 'تعذر حفظ التجربة.')); }
  };
  const review = (id: string, status: 'confirmed' | 'cancelled') => {
    try { setRecords(reviewTestAttendance(id, status)); setError(''); setMessage('حُفظ قرار الإدارة التجريبي محليًا.'); }
    catch (reviewError) { setError(getAttendanceErrorMessage(reviewError, 'تعذرت المراجعة.')); }
  };
  const field = 'rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900';

  return (
    <main dir="rtl" className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">تجريب بوابة الغياب</h1>
          <button type="button" onClick={onExit} className={`${field} text-sm`}>الخروج من الاختبار</button>
        </header>
        <div role="status" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          وضع اختبار محلي · دخول مباشر دون كلمة مرور أو رمز تفعيل. يمكنك اختيار أي أستاذ ويوم والتعديل دون مهلة زمنية. نتائج الاختبار تُحفظ في هذا المتصفح ولا تُرفع إلى Supabase.
          {data && <p className="mt-2 font-semibold">{data.sample ? 'المعروض بيانات نموذجية للتجربة.' : 'المعروض من الجدول ولائحة التلاميذ المحفوظين محليًا.'}</p>}
        </div>
        <nav aria-label="اختيار واجهة الاختبار" className="mb-5 flex flex-wrap gap-3">
          <button type="button" aria-pressed={role === 'teacher'} onClick={() => setRole('teacher')} className={`rounded-xl px-5 py-3 font-bold ${role === 'teacher' ? 'bg-cyan-700 text-white' : 'bg-white'}`}>واجهة الأستاذ</button>
          <button type="button" aria-pressed={role === 'admin'} onClick={() => setRole('admin')} className={`rounded-xl px-5 py-3 font-bold ${role === 'admin' ? 'bg-cyan-700 text-white' : 'bg-white'}`}>واجهة الإدارة والمراجعة</button>
          <button type="button" onClick={useSample} className="rounded-xl border border-slate-300 bg-white px-4 py-3">استخدام بيانات نموذجية</button>
        </nav>
        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
        {message && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-emerald-800">{message}</p>}
        {!data && !error && <p>جارٍ تحميل البيانات المحلية...</p>}
        {data && role === 'teacher' && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-5 grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2 text-sm font-semibold">الأستاذ
                <select value={teacherId} onChange={(event) => selectTeacher(event.target.value)} className={field}>
                  {data.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold">الحصة
                <select value={lessonId} onChange={(event) => { setLessonId(event.target.value); setMessage(''); }} className={field}>
                  {data.lessons.filter((row) => row.teacherId === teacherId).map((row) => <option key={row.id} value={row.id}>{row.className} · {row.subject} · {row.day} · {row.time}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold">تاريخ التجربة
                <input type="date" value={date} onChange={(event) => { setDate(event.target.value); setMessage(''); }} className={field} />
              </label>
            </div>
            {!lesson && <p className="py-5 text-slate-600">لا توجد حصص محلية لهذا الأستاذ. اختر أستاذًا آخر أو استخدم البيانات النموذجية.</p>}
            {lesson && <>
              <h2 className="mb-4 text-lg font-bold">{lesson.className} · {students.length} تلميذًا</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {students.map((student) => {
                  const absent = absentIds.has(student.id);
                  return <button type="button" key={student.id} aria-pressed={absent} onClick={() => setAbsentIds((current) => {
                    const next = new Set(current); if (next.has(student.id)) next.delete(student.id); else next.add(student.id); return next;
                  })} className={`rounded-xl border p-5 text-right ${absent ? 'border-red-300 bg-red-50 text-red-900' : 'border-slate-200 bg-slate-50'}`}>
                    <span className="block font-semibold">{student.name}</span><span className="mt-2 block text-sm">{absent ? 'غائب' : 'حاضر'}</span>
                  </button>;
                })}
              </div>
              {!students.length && <p className="py-5 text-slate-600">لم أجد تلاميذ لهذا القسم في اللائحة المحلية. يمكنك تجربة البيانات النموذجية.</p>}
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={save} disabled={!students.length || !date} className="rounded-xl bg-cyan-700 px-6 py-3 font-bold text-white disabled:opacity-50">حفظ الغياب التجريبي · {absentIds.size}</button>
                <button type="button" onClick={() => setAbsentIds(new Set())} className={field}>تعيين الجميع حاضرين</button>
              </div>
            </>}
          </section>
        )}
        {role === 'admin' && <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">سجلات الاختبار · {records.length}</h2>
          {!records.length && <p className="text-slate-600">سجّل الغياب من واجهة الأستاذ، ثم عد هنا للمراجعة.</p>}
          <div className="space-y-3">{records.map((record) => <article key={record.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap justify-between gap-3"><h3 className="font-bold">{record.teacherName} · {record.className} · {record.subject}</h3><span>{record.date}</span></div>
            <p className="my-2">الغائبون: {record.absentNames.length ? record.absentNames.join('، ') : 'الجميع حاضر'}</p>
            <p className="mb-3 text-sm text-slate-600">الحالة: {record.status === 'confirmed' ? 'معتمد تجريبيًا' : record.status === 'cancelled' ? 'ملغى تجريبيًا' : 'بانتظار المراجعة'}</p>
            <div className="flex gap-3"><button type="button" onClick={() => review(record.id, 'confirmed')} className="rounded-lg bg-emerald-700 px-4 py-2 text-white">اعتماد</button><button type="button" onClick={() => review(record.id, 'cancelled')} className={field}>إلغاء التسجيل</button></div>
          </article>)}</div>
        </section>}
      </div>
    </main>
  );
}
