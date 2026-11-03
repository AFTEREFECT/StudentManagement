import { useEffect, useState, useSyncExternalStore } from 'react';
import { dbManager } from '../utils/database';
import { getStartupSyncState, subscribeStartupSync, ReceivedAttendance } from '../utils/attendanceStartupSync';
import TeacherArchiveExport from './TeacherArchiveExport';

export default function AttendanceSyncStatus() {
  const state = useSyncExternalStore(subscribeStartupSync, getStartupSyncState);
  const [showArchive, setShowArchive] = useState(false);
  const [rows, setRows] = useState<ReceivedAttendance[]>([]);
  useEffect(() => {
    if (state.institutionId) {
      void dbManager.getReceivedAttendance(state.institutionId).then(setRows).catch(() => setRows([]));
    } else setRows([]);
  }, [state.institutionId, state.lastSuccess, state.phase]);
  if (!window.desktopAttendance) return null;
  const labels = { waiting: 'بانتظار دخول مسؤول المؤسسة', syncing: 'جارٍ استلام الغياب',
    success: 'اكتملت مزامنة الغياب', failed: 'تعذرت مزامنة الغياب — العمل المحلي متاح' };
  return (
    <section dir="rtl" className="border-b border-slate-200 bg-white p-3 text-sm text-slate-700">
      <div role="status" aria-live="polite">
        <span>{labels[state.phase]}</span>
        <span className="mr-4">آخر مزامنة ناجحة: {state.lastSuccess
          ? new Intl.DateTimeFormat('ar-MA', { timeZone: 'Africa/Casablanca', dateStyle: 'short', timeStyle: 'short' }).format(new Date(state.lastSuccess))
          : 'لم تتم بعد'}</span>
        {state.error && <p className="mt-1 text-amber-800">{state.error}</p>}
      </div>
      <button className="mt-2 text-cyan-800 underline" onClick={() => setShowArchive(!showArchive)}>
        {showArchive ? 'إخفاء الأرشيف المحلي' : `عرض الغياب المستلم محليًا (${rows.length})`}
      </button>
      {showArchive && <div className="mt-3 max-h-96 overflow-auto">
        <table className="w-full text-right"><thead><tr><th>التاريخ</th><th>القسم</th><th>الأستاذ</th><th>التلاميذ الغائبون</th><th>الحالة</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id} className="border-t">
            <td className="p-2">{row.lesson_date}</td><td>{row.lesson.class_name}</td><td>{row.teacherName}</td>
            <td>{row.marks.map((mark) => mark.display_name).join('، ') || 'الجميع حاضر'}</td>
            <td>{{ submitted: 'بانتظار المراجعة', confirmed: 'معتمد', cancelled: 'ملغى' }[row.status]}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <TeacherArchiveExport rows={rows} institutionId={state.institutionId} />
    </section>
  );
}
