import React, { useEffect, useRef, useState } from "react";
import { waakuService } from "../utils/waakuService";

type UiMessage = {
  type: "success" | "error" | "info";
  text: string;
} | null;

const WaakuMessagesConnection: React.FC = () => {
  const [institution, setInstitution] = useState<any>(null);
  const [session, setSession] = useState<any>({
    status: "DISCONNECTED",
    instanceName: null,
    phoneNumber: null,
    qrCode: null,
    source: null,
  });
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<UiMessage>(null);

  const pollingRef = useRef<number | null>(null);
const [isDeleting, setIsDeleting] = useState(false);
  const showMessage = (type: "success" | "error" | "info", text: string) => {
    setMessage({ type, text });
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const startPolling = (institutionId: string) => {
    stopPolling();

    pollingRef.current = window.setInterval(async () => {
      await refresh(true, institutionId);
    }, 370000);
  };

  const refresh = async (silent = false, forcedInstitutionId?: string) => {
    try {
      if (!silent) setLoading(true);

      const inst = institution || (await waakuService.getDefaultInstitution());
      if (!inst) {
        setInstitution(null);
        setSession({
          status: "DISCONNECTED",
          instanceName: null,
          phoneNumber: null,
          qrCode: null,
          source: "no_institution",
        });
        setQr(null);
        stopPolling();
        if (!silent) showMessage("error", "لم يتم العثور على المؤسسة");
        return;
      }

      setInstitution(inst);

      const institutionId = forcedInstitutionId || inst.id;
      const status = await waakuService.checkStatus(institutionId);

      setSession(status);

      if (status.status === "SCANNING") {
        const qrRes = await waakuService.getQr(institutionId);
        setQr(qrRes?.success ? qrRes.qr || null : null);
        startPolling(institutionId);
      } else {
        setQr(null);
        if (status.status === "CONNECTED") {
          stopPolling();
        }
      }

      if (!silent) {
        if (status.status === "CONNECTED") {
          showMessage("success", "واتساب الرسائل متصل");
        } else if (status.status === "SCANNING") {
          showMessage("info", "بانتظار مسح QR");
        } else {
          showMessage("info", "واتساب الرسائل غير متصل");
        }
      }
    } catch (error: any) {
      console.error(error);
      if (!silent) showMessage("error", error?.message || "فشل تحديث الحالة");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const createSession = async () => {
    try {
      setBusy(true);
      const inst = institution || (await waakuService.getDefaultInstitution());

      if (!inst) {
        showMessage("error", "لم يتم العثور على المؤسسة");
        return;
      }

      setInstitution(inst);

      const res = await waakuService.startSession(inst.id);
      if (!res.success) {
        showMessage("error", res.error || "فشل إنشاء الجلسة");
        return;
      }

      setSession({
        status: res.status || "SCANNING",
        instanceName: res.instanceName || inst.id,
        phoneNumber: res.phoneNumber || null,
        qrCode: res.qrCode || null,
        source: "start_session",
      });

      if (res.qrCode) {
        setQr(res.qrCode);
      } else {
        const qrRes = await waakuService.getQr(inst.id);
        setQr(qrRes?.success ? qrRes.qr || null : null);
      }

      startPolling(inst.id);
      showMessage("success", "تم بدء جلسة الرسائل");
    } catch (error: any) {
      console.error(error);
      showMessage("error", error?.message || "فشل إنشاء الجلسة");
    } finally {
      setBusy(false);
    }
  };

  const reloadQr = async () => {
    try {
      setBusy(true);

      const inst = institution || (await waakuService.getDefaultInstitution());
      if (!inst) {
        showMessage("error", "لم يتم العثور على المؤسسة");
        return;
      }

      const qrRes = await waakuService.getQr(inst.id);
      if (qrRes?.success && qrRes.qr) {
        setQr(qrRes.qr);
        setSession((prev: any) => ({ ...prev, status: "SCANNING" }));
        showMessage("success", "تم تحميل QR");
      } else {
        setQr(null);
        showMessage("info", qrRes?.error || "لا يوجد QR حاليًا");
      }
    } catch (error: any) {
      console.error(error);
      showMessage("error", error?.message || "تعذر تحميل QR");
    } finally {
      setBusy(false);
    }
  };


  const handleDeleteChannelsSession = async () => {
  try {
    setIsDeleting(true);

    await waakuService.resetChannelsSession();

    setStatus({
      ready: false,
      authenticated: false,
      waState: "booting",
      clientState: null,
      hasQr: false,
      qr: null,
      lastError: null,
    });

    setChannelsQrScannedByUser(false);
    setChannelsConfirmedByUser(false);

    showMessage("success", "تم حذف ربط الشنلات، انتظر ظهور QR جديد");

    setTimeout(() => {
      void refresh(false);
    }, 2500);
  } catch (error: any) {
    console.error(error);
    showMessage("error", error?.message || "فشل حذف ربط الشنلات");
  } finally {
    setIsDeleting(false);
  }
};

  const deleteSession = async () => {
    try {
      setBusy(true);

      const inst = institution || (await waakuService.getDefaultInstitution());
      if (!inst) {
        showMessage("error", "لم يتم العثور على المؤسسة");
        return;
      }

      const res = await waakuService.stopSession(inst.id);
      if (!res.success) {
        showMessage("error", res.error || "فشل حذف الجلسة");
        return;
      }

      setSession({
        status: "DISCONNECTED",
        instanceName: null,
        phoneNumber: null,
        qrCode: null,
        source: "deleted",
      });
      setQr(null);
      stopPolling();

      showMessage("success", "تم حذف جلسة الرسائل");
    } catch (error: any) {
      console.error(error);
      showMessage("error", error?.message || "فشل حذف الجلسة");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh(false);

    return () => {
      stopPolling();
    };
  }, []);

  const statusLabel =
    session?.status === "CONNECTED"
      ? "متصل"
      : session?.status === "SCANNING"
      ? "بانتظار مسح QR"
      : "غير متصل";

  return (
    <div className="p-6 space-y-4" dir="rtl">
      <h2 className="text-2xl font-bold">ربط واتساب الرسائل</h2>

      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-green-100 text-green-800"
              : message.type === "error"
              ? "bg-red-100 text-red-800"
              : "bg-blue-100 text-blue-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-xl border bg-white p-4 space-y-2">
        <div>Session ID: {session?.instanceName || institution?.id || "-"}</div>
        <div>Institution ID: {institution?.id || "-"}</div>
        <div>الحالة: {statusLabel}</div>
        <div>الهاتف: {session?.phoneNumber || "-"}</div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => refresh(false)}
          disabled={loading || busy}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          تحديث
        </button>

        <button
          onClick={createSession}
          disabled={busy}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          بدء الجلسة
        </button>
<button
  onClick={deleteSession}
  disabled={busy}
  className="bg-red-600 text-white px-4 py-2 rounded"
>
  حذف
</button>
        <button
          onClick={reloadQr}
          disabled={busy}
          className="bg-purple-600 text-white px-4 py-2 rounded"
        >
          إعادة عرض QR
        </button>

        <button
          onClick={deleteSession}
          disabled={busy}
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          حذف
        </button>
      </div>

      <div className="rounded-xl border bg-white p-4">
        {loading ? (
          <div>جاري التحميل...</div>
        ) : qr ? (
          <div className="space-y-3">
            <div className="font-medium">امسح هذا QR من واتساب</div>
            <img src={qr} alt="qr" className="max-w-[320px] rounded border" />
          </div>
        ) : session?.status === "CONNECTED" ? (
          <div className="text-green-700 font-medium">الجلسة متصلة ولا يوجد QR لأن الاتصال قائم بالفعل</div>
        ) : (
          <div className="text-slate-600">لا يوجد QR حاليًا</div>
        )}
      </div>
    </div>
  );
};

export default WaakuMessagesConnection;