import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { dbManager } from '../utils/database';
import { createLocalAdminAuth } from '../utils/localAdminAuth';

type Mode = 'loading' | 'setup' | 'login' | 'upgrade' | 'recover' | 'reset' | 'change' | 'codes' | 'unlocked' | 'error';
const inputClass = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100';
const codeModes: Mode[] = ['setup', 'upgrade', 'reset', 'change'];

export default function LocalAdminGate({ children }: { children: ReactNode }) {
  const auth = useMemo(() => createLocalAdminAuth(dbManager), []);
  const [mode, setMode] = useState<Mode>('loading');
  const [institutionName, setInstitutionName] = useState('');
  const [secret, setSecret] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [generateCode, setGenerateCode] = useState(true);
  const [legacyRecovery, setLegacyRecovery] = useState(false);
  const [credentials, setCredentials] = useState<{ accessCode: string; recoveryCode: string } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    if (!auth.isCryptoAvailable()) {
      setError('يتطلب الدخول المحلي متصفحًا حديثًا وفتح البرنامج عبر localhost أو HTTPS، أو استعمال نسخة سطح المكتب.');
      setMode('error');
      return () => { active = false; };
    }
    auth.info().then(async info => {
      if (!active) return;
      if (info) {
        setInstitutionName(info.institutionName);
        setMode(info.needsUpgrade ? 'upgrade' : 'login');
      } else {
        const settings = await dbManager.getInstitutionSettings();
        if (!active) return;
        setInstitutionName(settings?.institution || settings?.name || '');
        setMode('setup');
      }
    }).catch(err => {
      if (active) { setError(err instanceof Error ? err.message : 'تعذر تحميل حساب المؤسسة المحلي.'); setMode('error'); }
    });
    return () => { active = false; };
  }, [auth]);

  function switchMode(next: Mode) {
    setSecret('');
    setAccessCode('');
    setConfirmation('');
    setCredentials(null);
    setError('');
    setMessage('');
    setGenerateCode(true);
    setLegacyRecovery(false);
    setMode(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (working) return;
    setError('');
    setMessage('');
    if (codeModes.includes(mode)) {
      if (!generateCode && !/^[a-z0-9]{6}$/i.test(accessCode)) {
        setError('يجب أن يتكون رمز الدخول من 6 أحرف لاتينية أو أرقام فقط.');
        return;
      }
      if (!generateCode && accessCode !== confirmation) {
        setError('رمز الدخول وتأكيده غير متطابقين.');
        return;
      }
    }
    setWorking(true);
    try {
      if (mode === 'login') {
        await auth.login(accessCode);
        switchMode('unlocked');
      } else if (mode === 'recover') {
        await auth.verifyRecovery(secret);
        setMessage('تم التحقق من رمز الاستعادة. اختر رمز دخول جديداً.');
        setAccessCode('');
        setConfirmation('');
        setGenerateCode(true);
        setMode('reset');
      } else {
        const result = mode === 'setup'
          ? await auth.setup(institutionName, generateCode ? undefined : accessCode)
          : mode === 'upgrade'
            ? await auth.upgrade(secret, generateCode ? undefined : accessCode, legacyRecovery)
            : await auth.replaceAccessCode(secret, generateCode ? undefined : accessCode, mode === 'reset');
        setCredentials(result);
        setAcknowledged(false);
        setSecret('');
        setMode('codes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ رمز دخول المؤسسة.');
    } finally {
      setWorking(false);
    }
  }

  function downloadCodes() {
    if (!credentials) return;
    const contents = `رموز الإدارة المحلية — progTalamid\nالمؤسسة: ${institutionName}\nرمز الدخول: ${credentials.accessCode}\nرمز الاستعادة: ${credentials.recoveryCode}\n\nاحفظ رمز الاستعادة خارج جهاز المؤسسة. لا تشاركه.\n`;
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'progTalamid-local-access-codes.txt';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (mode === 'unlocked') return <div className="flex h-screen flex-col" dir="rtl">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2 text-sm">
      <span className="font-semibold text-slate-800">الإدارة المحلية · {institutionName}</span>
      <div className="flex gap-4">
        <button type="button" onClick={() => switchMode('change')} className="text-cyan-800">تغيير رمز الدخول</button>
        <button type="button" onClick={() => switchMode('recover')} className="font-semibold text-cyan-800"><span aria-hidden="true">🔑 </span>إعادة تعيين الرمز</button>
        <button type="button" onClick={() => switchMode('login')} className="font-semibold text-slate-700">قفل البرنامج</button>
      </div>
    </header>
    <div className="min-h-0 flex-1">{children}</div>
  </div>;

  const title = mode === 'setup' ? 'إعداد رمز دخول المؤسسة'
    : mode === 'upgrade' ? 'تحديث الدخول إلى رمز المؤسسة'
      : mode === 'recover' ? 'إعادة تعيين رمز الدخول'
        : mode === 'reset' ? 'اختر رمز دخول جديداً'
          : mode === 'change' ? 'تغيير رمز الدخول'
            : mode === 'codes' ? 'احفظ رموز المؤسسة'
              : 'دخول الإدارة المحلية';
  const cryptoUnavailable = mode === 'error' && error.includes('localhost أو HTTPS');
  const localDevelopmentUrl = cryptoUnavailable && window.location.port === '8580' &&
    !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
    ? `http://localhost:8580${window.location.pathname}${window.location.search}${window.location.hash}`
    : null;
  return <main dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
    <section className="w-full max-w-lg space-y-5 rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      {institutionName && mode !== 'setup' && <p className="text-slate-600">{institutionName}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{message}</p>}
      {mode === 'loading' ? <p role="status">جارٍ تحميل حساب المؤسسة...</p> : mode === 'error' ?
        cryptoUnavailable ? <div className="space-y-3 text-sm leading-6 text-slate-700">
          <p>يتطلب إنشاء رمز الدخول والتحقق منه اتصالاً آمناً لتشفير بيانات الاعتماد. لم تُحفظ أي بيانات دخول.</p>
          {localDevelopmentUrl && <a href={localDevelopmentUrl} className="block rounded-xl bg-cyan-700 px-5 py-3 text-center font-semibold text-white">فتح البرنامج على هذا الجهاز عبر localhost</a>}
          <p>إذا كنت تفتح البرنامج من جهاز آخر، استخدم رابط HTTPS بشهادة موثوقة. ويمكنك بدلاً من ذلك تشغيل نسخة سطح المكتب.</p>
          <button type="button" onClick={() => window.location.reload()} className="w-full rounded-xl border border-slate-300 px-5 py-3 text-slate-700">إعادة المحاولة</button>
        </div> : <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-cyan-700 px-5 py-3 text-white">إعادة المحاولة</button>
      : mode === 'codes' && credentials ? <>
        <p className="text-sm leading-6 text-slate-700">رمز الدخول خاص بقاعدة بيانات المؤسسة، ورمز الاستعادة يُستخدم عند نسيانه. لن يظهر رمز الاستعادة مجدداً بعد إغلاق هذه الشاشة.</p>
        <div className="space-y-2 rounded-xl bg-slate-100 p-4 text-center">
          <p className="text-sm text-slate-600">رمز الدخول</p>
          <p dir="ltr" className="font-mono text-2xl font-bold tracking-widest text-slate-900">{credentials.accessCode}</p>
          <p className="pt-2 text-sm text-slate-600">رمز الاستعادة</p>
          <p dir="ltr" className="break-all font-mono text-lg font-bold tracking-wide text-slate-900">{credentials.recoveryCode}</p>
        </div>
        <button type="button" onClick={downloadCodes} className="w-full rounded-xl border border-cyan-700 p-3 font-semibold text-cyan-800">تنزيل الرمزين</button>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} className="mt-1" />حفظت رمز الاستعادة في مكان آمن خارج هذا الجهاز.</label>
        <button type="button" disabled={!acknowledged} onClick={() => switchMode('unlocked')} className="w-full rounded-xl bg-cyan-700 p-3 font-bold text-white disabled:opacity-50">حفظ الرمز والدخول إلى البرنامج</button>
      </> : <form onSubmit={submit} className="space-y-4">
        {mode === 'setup' && <>
          <p className="text-sm leading-6 text-slate-600">أنشئ رمزاً خاصاً بهذه المؤسسة. يمكنك اختيار رمز من 6 أحرف لاتينية أو أرقام، أو ترك البرنامج يولّد رمزاً عشوائياً.</p>
          <label className="block text-sm font-semibold">اسم المؤسسة<input required maxLength={200} value={institutionName} onChange={e => setInstitutionName(e.target.value)} className={inputClass} /></label>
        </>}
        {mode === 'upgrade' && <>
          <p className="text-sm leading-6 text-slate-600">تحقق من بيانات الدخول القديمة مرة واحدة لتحديث الحساب إلى رمز دخول من 6 أحرف أو أرقام. تبقى بيانات المؤسسة محفوظة.</p>
          <p className="text-sm leading-6 text-amber-800">إذا فقدت كلمة المرور ورمز الاستعادة معاً، لا توجد إعادة تعيين آمنة من هذا الجهاز وحده. لا تحذف قاعدة البيانات؛ استعد نسخة احتياطية تعرف بيانات دخولها أو تواصل مع دعم البرنامج.</p>
          <label className="block text-sm font-semibold">{legacyRecovery ? 'رمز الاستعادة القديم' : 'كلمة المرور الحالية'}
            <input required type="password" autoComplete={legacyRecovery ? 'off' : 'current-password'} value={secret} onChange={e => { setSecret(e.target.value); setError(''); }} className={inputClass} />
          </label>
          <button type="button" onClick={() => { setSecret(''); setError(''); setLegacyRecovery(!legacyRecovery); }} className="text-sm text-cyan-800">
            {legacyRecovery ? 'استخدام كلمة المرور القديمة' : 'نسيت كلمة المرور؟ استخدم رمز الاستعادة القديم'}
          </button>
        </>}
        {mode === 'login' && <label className="block text-sm font-semibold">رمز دخول المؤسسة
          <input required type="password" inputMode="text" autoComplete="current-password" maxLength={6} value={accessCode} onChange={e => setAccessCode(e.target.value)} className={inputClass} />
        </label>}
        {mode === 'recover' && <>
          <label className="block text-sm font-semibold">رمز الاستعادة المحفوظ
            <input required type="password" autoComplete="off" value={secret} onChange={e => { setSecret(e.target.value); setError(''); }} className={inputClass} />
          </label>
          <p className="text-sm leading-6 text-slate-600">الرمز الجديد خاص بهذه المؤسسة، وسيُصدر رمز استعادة جديد بعد إتمام العملية. إذا فقدت رمز الدخول ورمز الاستعادة معاً، لا تحذف قاعدة البيانات؛ استعد نسخة احتياطية تعرف بيانات دخولها أو تواصل مع دعم البرنامج.</p>
        </>}
        {mode === 'change' && <label className="block text-sm font-semibold">رمز الدخول الحالي
          <input required type="password" maxLength={6} autoComplete="current-password" value={secret} onChange={e => setSecret(e.target.value)} className={inputClass} />
        </label>}
        {codeModes.includes(mode) && <>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">طريقة إنشاء الرمز</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="code-choice" checked={generateCode} onChange={() => setGenerateCode(true)} />يولّد البرنامج رمزاً عشوائياً</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="code-choice" checked={!generateCode} onChange={() => setGenerateCode(false)} />أختار الرمز بنفسي</label>
          </fieldset>
          {!generateCode && <>
            <label className="block text-sm font-semibold">رمز الدخول الجديد (6 أحرف أو أرقام)
              <input required pattern="[A-Za-z0-9]{6}" minLength={6} maxLength={6} autoComplete="new-password" value={accessCode} onChange={e => setAccessCode(e.target.value)} className={inputClass} />
            </label>
            <label className="block text-sm font-semibold">تأكيد رمز الدخول
              <input required pattern="[A-Za-z0-9]{6}" minLength={6} maxLength={6} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} className={inputClass} />
            </label>
          </>}
        </>}
        {(mode === 'reset') && <label className="block text-sm font-semibold">رمز الاستعادة
          <input required type="password" autoComplete="off" value={secret} onChange={e => setSecret(e.target.value)} className={inputClass} />
        </label>}
        <button disabled={working} className="w-full rounded-xl bg-cyan-700 p-3 font-bold text-white disabled:opacity-50">
          {working ? 'جارٍ التحقق والحفظ...' : mode === 'login' ? 'دخول الإدارة' : mode === 'recover' ? 'التحقق والمتابعة' : mode === 'setup' ? 'إنشاء رمز المؤسسة' : mode === 'upgrade' ? 'تحديث الحساب' : 'حفظ رمز الدخول الجديد'}
        </button>
        {mode === 'login' && <button type="button" disabled={working} onClick={() => switchMode('recover')} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-cyan-50 p-3 font-bold text-cyan-900"><span aria-hidden="true">🔑</span><span>نسيت رمز الدخول؟ إعادة تعيينه</span></button>}
        {(mode === 'recover' || mode === 'reset' || mode === 'change') && <button type="button" disabled={working} onClick={() => switchMode('login')} className="w-full py-2 text-sm text-slate-600">العودة لتسجيل الدخول</button>}
      </form>}
      <p className="border-t pt-4 text-xs leading-6 text-slate-500">الرمز محلي ومخصص لقاعدة بيانات المؤسسة. قفل الدخول لا يشفّر ملف قاعدة البيانات؛ احمِ الجهاز والنسخ الاحتياطية.</p>
    </section>
  </main>;
}
