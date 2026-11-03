import React from 'react';

interface TeacherAccess {
  displayName: string;
  username?: string;
  activated?: boolean;
  reactivation?: boolean;
  activationCode?: string;
  activationExpired?: boolean;
}

export default function AttendanceTeacherAccess({ teacher, working, onIssue }: {
  teacher: TeacherAccess;
  working: boolean;
  onIssue: (reactivate: boolean) => void;
}): React.ReactElement {
  return <>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="font-semibold">{teacher.displayName}</p><p className="text-xs text-slate-500">رقم البطاقة محفوظ محليًا للمطابقة فقط</p></div>
      <button disabled={working} onClick={() => onIssue(Boolean(teacher.activated || teacher.reactivation))} className="rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {teacher.reactivation ? 'إصدار رمز جديد' : teacher.activated ? 'إعادة تعيين كلمة المرور' : teacher.username ? 'إصدار رمز جديد' : 'إنشاء دخول'}
      </button>
    </div>
    {teacher.reactivation
      ? <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {teacher.activationExpired
            ? 'انتهت صلاحية الرمز. اضغط «إصدار رمز جديد» ثم أرسل الرمز إلى الأستاذ.'
            : 'أرسل الرمز إلى الأستاذ ليختار كلمة مرور جديدة. الحساب والجدول وسجل الغياب محفوظة.'}
        </p>
      : teacher.activated && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">الحساب مفعّل{teacher.username ? ` · ${teacher.username}` : ''}</p>}
    {teacher.username && (!teacher.activated || teacher.reactivation || teacher.activationCode) && (
      <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm" dir="ltr">
        المستخدم: {teacher.username}
        {teacher.activationCode && <><br />{teacher.reactivation ? 'رمز إعادة تعيين كلمة المرور' : 'رمز التفعيل'}: {teacher.activationCode}</>}
      </p>
    )}
  </>;
}
