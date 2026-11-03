import { AbsenceManagement } from './AbsenceManagement';

export default function LocalAttendanceAdmin({ onNavigate }: { onNavigate: (tab: string) => void }) {
  return <div dir="rtl">
    <section className="m-6 space-y-3 rounded-xl border border-cyan-200 bg-cyan-50 p-5">
      <h1 className="text-2xl font-bold text-slate-900">إدارة الغياب المحلية</h1>
      <p className="text-sm leading-6 text-slate-700">أنت داخل حساب إدارة المؤسسة المحلي. يمكنك تسجيل الغياب وتعديله من بيانات التلاميذ والجدول المحفوظين على هذا الجهاز دون تسجيل دخول آخر.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => onNavigate('schedule-import')} className="rounded-lg border border-cyan-700 bg-white px-4 py-2 text-sm font-semibold text-cyan-900">استيراد جدول الحصص</button>
        <button type="button" onClick={() => onNavigate('attendance-sheet-generator')} className="rounded-lg border border-cyan-700 bg-white px-4 py-2 text-sm font-semibold text-cyan-900">طباعة أوراق الغياب</button>
      </div>
      <p className="text-xs leading-6 text-slate-600">حسابات الأساتذة وتفعيلهم واستقبال إرسالهم عبر الإنترنت تخص البوابة السحابية وحسابها المستقل. إشعارات واتساب، إن استعملتها، تحتاج اتصالًا.</p>
    </section>
    <AbsenceManagement />
  </div>;
}
