import { useMemo, useState } from 'react';
import { localDate, periodRange, statistics, type YearData } from './offline/model';

export default function TeacherStatistics({ data, onOpen }: { data: YearData; onOpen: (lessonId: string, date: string) => void }) {
  const [period, setPeriod] = useState<'month' | 'semester1' | 'semester2' | 'year'>('year');
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [from, to] = periodRange(data, period, month);
  const totals = useMemo(() => statistics(data, from, to, className, subject), [data, from, to, className, subject]);
  const entries = Object.values(data.entries);
  const classes = [...new Set(entries.map((item) => item.lesson.class_name))];
  const subjects = [...new Map(entries.map((item) => [item.lesson.subject_code || item.lesson.subject_name, item.lesson.subject_name || item.lesson.subject_code])).entries()];
  return <section className="panel statistics-panel"><h2>إحصائياتي · {data.year}</h2>
    <p>تُحسب من الأرشيف المحلي فقط. المسودات مستبعدة من أعداد الغياب، والاستلام من الخادم يختلف عن اعتماد المؤسسة.</p>
    <div className="pwa-controls">
      <label>الفترة<select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}><option value="month">شهرية</option><option value="semester1">الفصل الأول</option><option value="semester2">الفصل الثاني</option><option value="year">سنوية</option></select></label>
      {period === 'month' && <label>الشهر<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>}
      <label>القسم<select value={className} onChange={(e) => setClassName(e.target.value)}><option value="">جميع أقسامي</option>{classes.map((name) => <option key={name}>{name}</option>)}</select></label>
      <label>المادة<select value={subject} onChange={(e) => setSubject(e.target.value)}><option value="">جميع موادي</option>{subjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
    </div>
    <p>{from} — {to}</p><div className="stat-grid">
      <div><strong>{totals.lessons}</strong><span>حصص مستلمة</span></div><div><strong>{totals.absences}</strong><span>حالات غياب</span></div>
      <div><strong>{totals.absentHours.toFixed(2)}</strong><span>ساعات غياب التلاميذ</span></div><div><strong>{totals.studentDays}</strong><span>أيام غياب التلاميذ</span></div>
      <div><strong>{totals.institutionApproved}</strong><span>حصص اعتمدتها المؤسسة</span></div><div><strong>{totals.pendingDrafts}</strong><span>مسودات غير محتسبة</span></div>
    </div>
    <h3>سجل السنة وإصدارات الحصص</h3><div className="archive-list">{entries.sort((a, b) => (b.confirmed?.lessonDate || b.draft?.lessonDate || '').localeCompare(a.confirmed?.lessonDate || a.draft?.lessonDate || '')).map((item) => {
      const date = item.confirmed?.lessonDate || item.draft!.lessonDate;
      if (date < from || date > to || (className && item.lesson.class_name !== className) || (subject && (item.lesson.subject_code || item.lesson.subject_name) !== subject)) return null;
      return <button key={`${date}:${item.lesson.id}`} className="secondary-button" onClick={() => onOpen(item.lesson.id, date)}>
        {date} · {item.lesson.class_name} · {item.lesson.subject_name || item.lesson.subject_code} · {item.draft ? 'مسودة/تعديل محلي' : item.confirmed?.source === 'institution' ? 'أرشيف المؤسسة' : 'أكد الخادم الاستلام'} · {item.history.length} إصدار/حدث
      </button>;
    })}</div>
  </section>;
}
