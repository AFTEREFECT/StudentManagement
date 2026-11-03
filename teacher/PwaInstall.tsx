import { useEffect, useState } from 'react';
interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }
export default function PwaInstall() {
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    const available = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); };
    const update = (event: Event) => setWaiting((event as CustomEvent<ServiceWorker>).detail);
    window.addEventListener('beforeinstallprompt', available); window.addEventListener('teacher-pwa-update', update);
    void navigator.serviceWorker?.getRegistration().then((registration) => { if (registration?.waiting) setWaiting(registration.waiting); });
    return () => { window.removeEventListener('beforeinstallprompt', available); window.removeEventListener('teacher-pwa-update', update); };
  }, []);
  return <div className="pwa-install">
    {install ? <button className="secondary-button" onClick={() => { void install.prompt().then(() => install.userChoice).then(() => setInstall(null)); }}>تثبيت بوابة الأستاذ على الهاتف</button>
      : <small>يمكن إضافة المنصة إلى الشاشة الرئيسية من قائمة المتصفح. يلزم فتحها مرة متصلًا وتجهيز الأرشيف للعمل دون اتصال.</small>}
    {waiting && <p>تتوفر نسخة جديدة. احفظ المسودات ثم <button className="text-button" onClick={() => {
      if (window.confirm('هل حفظت تعديلاتك المحلية؟ سيتم تحديث الواجهة دون حذف الأرشيف.')) {
        navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
        waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }}>حدّث التطبيق</button>.</p>}
  </div>;
}
