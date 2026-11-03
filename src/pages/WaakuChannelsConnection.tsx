import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Layers3,
  Loader2,
  QrCode,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { waakuService } from "../utils/waakuService";

type UiMessage = {
  type: "success" | "error" | "info";
  text: string;
} | null;

type ChannelsStatus = {
  ready: boolean;
  authenticated: boolean;
  waState?: string | null;
  clientState?: string | null;
  hasQr?: boolean;
  qr?: string | null;
  lastError?: string | null;
};

const emptyStatus: ChannelsStatus = {
  ready: false,
  authenticated: false,
  waState: null,
  clientState: null,
  hasQr: false,
  qr: null,
  lastError: null,
};

const statusText = (status: ChannelsStatus) => {
  if (status.ready) return "جاهزة";
  if (status.authenticated || status.hasQr || status.qr) return "في طور الربط";
  return "غير جاهزة";
};

const WaakuChannelsConnection: React.FC = () => {
  const [status, setStatus] = useState<ChannelsStatus>(emptyStatus);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<UiMessage>(null);

  const pollingRef = useRef<number | null>(null);

  const stateLabel = useMemo(() => {
    return status.waState || status.clientState || statusText(status);
  }, [status]);

  const showMessage = (type: "success" | "error" | "info", text: string) => {
    setMessage({ type, text });
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const startPolling = () => {
    stopPolling();
    pollingRef.current = window.setInterval(() => {
      void refresh(true);
    }, 8000);
  };

  const refresh = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const res = await waakuService.getChannelsLayerStatus();
      setStatus({
        ready: !!res.ready,
        authenticated: !!res.authenticated,
        waState: res.waState || null,
        clientState: res.clientState || null,
        hasQr: !!res.hasQr,
        qr: res.qr || null,
        lastError: res.lastError || null,
      });

      if (res.ready) {
        stopPolling();
        if (!silent) showMessage("success", "طبقة الشنلات والجروبات جاهزة");
      } else if (res.authenticated || res.hasQr || res.qr) {
        startPolling();
        if (!silent) showMessage("info", "الطبقة في طور الربط، امسح QR ثم حدّث الحالة");
      } else if (!silent) {
        showMessage("info", "طبقة الشنلات غير جاهزة، ابدأ الجلسة أولاً");
      }
    } catch (error: any) {
      console.error(error);
      if (!silent) showMessage("error", error?.message || "فشل تحديث طبقة الشنلات");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const isStartEndpoint404 = (error: any) => {
    const raw = typeof error?.message === "string" ? error.message : JSON.stringify(error || {});
    return (
      raw.includes('"functionName":"channels-start"') ||
      raw.includes("channels-start") ||
      raw.includes("Cannot POST /start") ||
      raw.includes('"status":404')
    );
  };

  const start = async () => {
    try {
      setBusy(true);
      showMessage("info", "جاري طلب تشغيل طبقة الشنلات... انتظر قليلاً حتى يظهر QR");

      const res = await waakuService.startChannelsSession();

      if (!res?.success) {
        showMessage("info", res?.error || "تم طلب التشغيل. إذا لم يظهر QR اضغط تحديث الحالة بعد قليل");
        startPolling();
        window.setTimeout(() => void refresh(true), 2000);
        window.setTimeout(() => void refresh(false), 5000);
        return;
      }

      showMessage("success", "تم طلب تشغيل جلسة الشنلات. انتظر ظهور QR أو حالة الجاهزية");
      startPolling();

      window.setTimeout(() => void refresh(true), 2000);
      window.setTimeout(() => void refresh(false), 5000);
    } catch (error: any) {
      console.warn("channels-start warning:", error);

      if (isStartEndpoint404(error)) {
        showMessage(
          "info",
          "تم طلب تشغيل الطبقة، والخادم ما زال يجهز QR. انتظر قليلاً أو اضغط تحديث الحالة"
        );

        startPolling();
        window.setTimeout(() => void refresh(true), 1500);
        window.setTimeout(() => void refresh(false), 4000);
        window.setTimeout(() => void refresh(true), 8000);
        return;
      }

      showMessage("error", error?.message || "فشل بدء الجلسة");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    const ok = window.confirm(
      "سيتم حذف ربط طبقة الشنلات والجروبات فقط.\n\nهذا لا يحذف الشنلات المنشأة سابقاً، لكنه يطلب QR جديداً للطبقة.\n\nهل تريد المتابعة؟"
    );

    if (!ok) return;

    try {
      setBusy(true);
      await waakuService.resetChannelsSession();
      stopPolling();
      setStatus({ ...emptyStatus, waState: "booting" });
      showMessage("success", "تم حذف ربط الطبقة. ابدأ الجلسة أو حدّث الحالة للحصول على QR جديد");
      window.setTimeout(() => {
        void refresh(false);
      }, 2500);
    } catch (error: any) {
      console.error(error);
      showMessage("error", error?.message || "فشل حذف ربط الشنلات");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh(false);
    return () => stopPolling();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" dir="rtl">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8 flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="font-semibold text-slate-700">جاري تحميل حالة طبقة الشنلات...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="rounded-3xl overflow-hidden bg-gradient-to-l from-indigo-700 via-blue-600 to-cyan-500 text-white shadow-xl">
          <div className="p-6 md:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/20 px-3 py-1.5 text-xs font-semibold mb-4">
                <Layers3 className="w-4 h-4" />
                QR مستقل خاص بالشنلات والجروبات
              </div>
              <h1 className="text-2xl md:text-4xl font-black mb-2">ربط الشنلات والجروبات</h1>
              <p className="text-white/90 max-w-2xl">
                هذه الصفحة خاصة فقط بطبقة إنشاء الشنلات والجروبات وإرسال الرسائل إليها. لا تخلطها مع QR الرسائل العادية.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-[300px]">
              <div className="rounded-2xl bg-white/15 border border-white/20 p-4">
                <div className="text-xs text-white/75 mb-1">الحالة</div>
                <div className="flex items-center gap-2 font-bold">
                  {status.ready ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                  {statusText(status)}
                </div>
              </div>

              <div className="rounded-2xl bg-white/15 border border-white/20 p-4">
                <div className="text-xs text-white/75 mb-1">Authenticated</div>
                <div className="font-bold">{status.authenticated ? "نعم" : "لا"}</div>
              </div>

              <div className="rounded-2xl bg-white/15 border border-white/20 p-4">
                <div className="text-xs text-white/75 mb-1">State</div>
                <div className="font-bold break-all">{stateLabel}</div>
              </div>
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`rounded-2xl border p-4 flex items-center gap-3 ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : message.type === "error"
                ? "bg-red-50 text-red-800 border-red-200"
                : "bg-blue-50 text-blue-800 border-blue-200"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-semibold text-sm">{message.text}</span>
          </div>
        )}

        {status.lastError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-semibold">{status.lastError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 rounded-3xl bg-white border border-slate-200 shadow-sm p-5 md:p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <QrCode className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">QR طبقة الشنلات والجروبات</h2>
                <p className="text-sm text-slate-500">امسح هذا الرمز مرة واحدة من واتساب المخصص للطبقة.</p>
              </div>
            </div>

            <div className="min-h-[360px] rounded-3xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center p-6">
              {status.qr && !status.ready ? (
                <div className="text-center space-y-4">
                  <img
                    src={status.qr}
                    alt="channels-qr"
                    className="w-72 h-72 mx-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                  />
                  <div>
                    <div className="font-bold text-slate-800">امسح QR الخاص بطبقة الشنلات</div>
                    <p className="text-sm text-slate-500 mt-1">
                      بعد المسح اضغط “تحديث الحالة” حتى تظهر “جاهزة”.
                    </p>
                  </div>
                </div>
              ) : status.ready ? (
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <ShieldCheck className="w-12 h-12" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-emerald-700">الطبقة جاهزة</div>
                    <p className="text-slate-500 mt-1">
                      يمكنك الآن إنشاء الشنلات والجروبات وإرسال الرسائل إليها من صفحة التواصل.
                    </p>
                  </div>
                </div>
              ) : status.authenticated ? (
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mx-auto">
                    <RefreshCw className="w-12 h-12" />
                  </div>
                  <div>
                    <div className="text-xl font-black text-blue-700">الطبقة authenticated</div>
                    <p className="text-slate-500 mt-1">
                      قد لا يظهر QR لأن الجلسة مربوطة مسبقاً. اضغط تحديث الحالة للتأكد.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
                    <QrCode className="w-12 h-12" />
                  </div>
                  <div>
                    <div className="text-xl font-black text-slate-700">لا يوجد QR حالياً</div>
                    <p className="text-slate-500 mt-1">اضغط تشغيل / إظهار QR الشنلات ثم انتظر قليلاً. قد يظهر QR بعد بضع ثوانٍ.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 md:p-6 space-y-4">
            <h3 className="text-lg font-black text-slate-900">أوامر الطبقة</h3>

            <button
              onClick={() => void refresh(false)}
              disabled={busy || loading}
              className="w-full rounded-2xl bg-blue-600 text-white px-4 py-4 font-bold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className="w-5 h-5" />
              تحديث الحالة
            </button>

            <button
              onClick={start}
              disabled={busy}
              className="w-full rounded-2xl bg-emerald-600 text-white px-4 py-4 font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
              تشغيل / إظهار QR الشنلات
            </button>

            <button
              onClick={reset}
              disabled={busy}
              className="w-full rounded-2xl bg-rose-600 text-white px-4 py-4 font-bold flex items-center justify-center gap-2 hover:bg-rose-700 disabled:opacity-50"
            >
              <Trash2 className="w-5 h-5" />
              حذف ربط الطبقة
            </button>

            <button
              onClick={() => void refresh(false)}
              disabled={busy}
              className="w-full rounded-2xl bg-violet-600 text-white px-4 py-4 font-bold flex items-center justify-center gap-2 hover:bg-violet-700 disabled:opacity-50"
            >
              <RotateCcw className="w-5 h-5" />
              إعادة فحص QR
            </button>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-800 leading-7">
              <strong>مهم:</strong> هذا الربط خاص بالشنلات والجروبات فقط. إرسال الرسائل العادية له QR آخر في صفحة ربط واتساب الرسائل.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaakuChannelsConnection;
