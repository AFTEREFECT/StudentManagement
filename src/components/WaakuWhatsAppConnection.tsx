import React, { useEffect, useRef, useState } from "react";
import { dbManager } from "../utils/database";
import {
  AlertCircle,
  CheckCircle2,
  Layers3,
  Loader2,
  MessageSquare,
  QrCode,
  RefreshCw,
  Send,
  Smartphone,
  Trash2,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { waakuService, WaakuSessionStatus, Institution } from "../utils/waakuService";
import { supabase } from "../utils/supabase";

export type SessionView = WaakuSessionStatus & {
  sessionId?: string | null;
};

type UiMessage = {
  type: "success" | "error" | "info";
  text: string;
} | null;

type ChannelsLayerState = {
  ready: boolean;
  authenticated: boolean;
  waState?: string | null;
  clientState?: string | null;
  hasQr?: boolean;
  qr?: string | null;
  lastError?: string | null;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );

const pickSupabaseInstitutionId = (...values: any[]) => {
  for (const value of values) {
    const v = String(value || "").trim();
    if (v && isUuid(v)) return v;
  }
  return "";
};

const emptySession: SessionView = {
  status: "DISCONNECTED",
  sessionId: null,
  instanceName: null,
  phoneNumber: null,
  qrCode: null,
  source: null,
};

const emptyChannelsLayer: ChannelsLayerState = {
  ready: false,
  authenticated: false,
  waState: null,
  clientState: null,
  hasQr: false,
  qr: null,
  lastError: null,
};

export const WaakuWhatsAppConnection: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [institution, setInstitution] = useState<Institution | null>(null);

  const [session, setSession] = useState<SessionView>(emptySession);
  const [qrCode, setQrCode] = useState("");

  const [isChecking, setIsChecking] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingQr, setIsLoadingQr] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sessionCreatedAt, setSessionCreatedAt] = useState<number | null>(null);

  const [qrScannedByUser, setQrScannedByUser] = useState(false);
  const [connectionConfirmedByUser, setConnectionConfirmedByUser] = useState(false);

  const [channelsLayer, setChannelsLayer] = useState<ChannelsLayerState>(emptyChannelsLayer);
  const [isRefreshingChannels, setIsRefreshingChannels] = useState(false);

  const [message, setMessage] = useState<UiMessage>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("مرحباً! هذه رسالة تجريبية من نظام PROGTALAMID 📚");

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMessage = (type: "success" | "error" | "info", text: string) => {
    setMessage({ type, text });

    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    messageTimeoutRef.current = setTimeout(() => setMessage(null), 5000);
  };

  const clearPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const updateSessionStatusInDB = async (
    institutionId: string,
    status: "CONNECTED" | "SCANNING" | "DISCONNECTED",
    instanceName: string | null,
    phoneNumber: string | null
  ) => {
    try {
      await supabase
        .from("institutions")
        .update({
          whatsapp_session_status: status,
          whatsapp_last_checked: new Date().toISOString(),
          whatsapp_session_id: instanceName ?? null,
          whatsapp_phone_number: phoneNumber ?? null,
        })
        .eq("id", institutionId);
    } catch (error) {
      console.error("DB sync error:", error);
    }
  };

  const resolveInstitutionLocally = async (): Promise<Institution | null> => {
    try {
      await dbManager.initialize();

      let settings: any = null;
      try {
        settings = await dbManager.getInstitutionSettings();
      } catch {}

      let dbInstitutionId = "";
      try {
        dbInstitutionId = String(dbManager.getSupabaseInstitutionId?.() || "").trim();
      } catch {}

      let backup: any = null;
      try {
        const rawBackup = localStorage.getItem("institution_settings_backup");
        if (rawBackup) backup = JSON.parse(rawBackup);
      } catch {}

      let legacy: any = null;
      try {
        const rawLegacy = localStorage.getItem("institutionSettings");
        if (rawLegacy) legacy = JSON.parse(rawLegacy);
      } catch {}

      const id = pickSupabaseInstitutionId(
        settings?.supabaseInstitutionId,
        settings?.supabase_institution_id,
        settings?.id,
        settings?.institutionId,
        dbInstitutionId,
        backup?.supabaseInstitutionId,
        backup?.supabase_institution_id,
        backup?.id,
        legacy?.supabaseInstitutionId,
        legacy?.supabase_institution_id,
        legacy?.id
      );

      const name = String(
        settings?.institution ||
          settings?.name ||
          backup?.institution ||
          backup?.name ||
          legacy?.institution ||
          legacy?.name ||
          "المؤسسة"
      ).trim();

      if (!id) return null;
      return { id, name };
    } catch (error) {
      console.error("resolveInstitutionLocally error:", error);
      return null;
    }
  };

  const refreshChannelsLayer = async (silent = false) => {
    if (!silent) setIsRefreshingChannels(true);

    try {
      const data = await waakuService.getChannelsLayerStatus();

      setChannelsLayer({
        ready: !!data.ready,
        authenticated: !!data.authenticated,
        waState: data.waState || null,
        clientState: data.clientState || null,
        hasQr: !!data.hasQr,
        qr: data.qr || null,
        lastError: data.lastError || null,
      });

      if (!silent && data.ready) showMessage("success", "طبقة الشنلات والجروبات جاهزة");
    } catch (error: any) {
      console.error("refreshChannelsLayer error:", error);
      setChannelsLayer((prev) => ({
        ...prev,
        ready: false,
        lastError: error?.message || "فشل التحقق من طبقة الشنلات",
      }));
    } finally {
      if (!silent) setIsRefreshingChannels(false);
    }
  };

  const applyStatusToUI = async (
    institutionId: string,
    statusData: WaakuSessionStatus,
    options?: { updateDb?: boolean; silentSuccess?: boolean }
  ) => {
    const withinGraceWindow = sessionCreatedAt !== null && Date.now() - sessionCreatedAt < 30000;

    if (withinGraceWindow && session.status === "SCANNING" && statusData.status === "DISCONNECTED") {
      return;
    }

    if (statusData.status === "CONNECTED" && !qrScannedByUser) {
      setSession((prev) => ({
        ...prev,
        status: "SCANNING",
        sessionId: statusData.instanceName ?? prev.sessionId ?? null,
        instanceName: statusData.instanceName ?? prev.instanceName ?? null,
        phoneNumber: statusData.phoneNumber ?? prev.phoneNumber ?? null,
        source: statusData.source ?? "waaku_server",
      }));
      return;
    }

    setSession((prev) => ({
      status: statusData.status,
      sessionId: statusData.instanceName ?? prev.sessionId ?? null,
      instanceName: statusData.instanceName ?? prev.instanceName ?? null,
      phoneNumber: statusData.phoneNumber ?? prev.phoneNumber ?? null,
      qrCode: statusData.status === "SCANNING" ? statusData.qrCode ?? prev.qrCode ?? null : null,
      source: statusData.source ?? "waaku_server",
    }));

    if (statusData.status === "CONNECTED") {
      setConnectionConfirmedByUser(true);
      setSessionCreatedAt(null);
      setQrCode("");
      clearPolling();

      if (options?.updateDb !== false) {
        await updateSessionStatusInDB(
          institutionId,
          "CONNECTED",
          statusData.instanceName ?? null,
          statusData.phoneNumber ?? null
        );
      }

      if (!options?.silentSuccess) showMessage("success", "تم الاتصال بنجاح بواتساب الرسائل");
      return;
    }

    if (statusData.status === "SCANNING") {
      if (statusData.qrCode) setQrCode(statusData.qrCode);

      if (options?.updateDb !== false) {
        await updateSessionStatusInDB(
          institutionId,
          "SCANNING",
          statusData.instanceName ?? null,
          statusData.phoneNumber ?? null
        );
      }
      return;
    }

    if (withinGraceWindow && qrCode) return;

    setSessionCreatedAt(null);
    setQrCode("");
    clearPolling();
    setQrScannedByUser(false);
    setConnectionConfirmedByUser(false);

    if (options?.updateDb !== false) {
      await updateSessionStatusInDB(institutionId, "DISCONNECTED", null, null);
    }
  };

  const startPolling = (institutionId: string) => {
    if (!isUuid(institutionId)) return;

    clearPolling();

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const statusData = await waakuService.checkStatus(institutionId);
        await applyStatusToUI(institutionId, statusData, {
          updateDb: true,
          silentSuccess: true,
        });
      } catch (error) {
        console.error("خطأ أثناء polling الحالة:", error);
      }
    }, 8000);
  };

  const checkSessionStatus = async (instId?: string, silent = false) => {
    const institutionId = instId || institution?.id;
    if (!institutionId || !isUuid(institutionId)) return;

    if (!silent) setIsChecking(true);

    try {
      const statusData = await waakuService.checkStatus(institutionId);

      if (session.status === "CONNECTED" && statusData.status === "DISCONNECTED") return;

      await applyStatusToUI(institutionId, statusData, {
        updateDb: true,
        silentSuccess: true,
      });

      if (statusData.status === "SCANNING") startPolling(institutionId);
    } catch (e) {
      console.error("خطأ في فحص الجلسة:", e);
    } finally {
      if (!silent) setIsChecking(false);
    }
  };

  const loadInstitution = async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      const inst = await resolveInstitutionLocally();

      if (!inst?.id) {
        setInstitution(null);
        setSession({ ...emptySession, source: "no_institution" });
        setQrCode("");
        clearPolling();
        showMessage("error", "لم يتم العثور على Supabase UUID صالح للمؤسسة");
        return;
      }

      setInstitution(inst);

      const { data: dbState } = await supabase
        .from("institutions")
        .select("whatsapp_session_id, whatsapp_session_status, whatsapp_phone_number")
        .eq("id", inst.id)
        .single();

      if (dbState?.whatsapp_session_status) {
        setSession({
          status: dbState.whatsapp_session_status,
          sessionId: dbState.whatsapp_session_id || inst.id,
          instanceName: dbState.whatsapp_session_id || inst.id,
          phoneNumber: dbState.whatsapp_phone_number || null,
          qrCode: null,
          source: "db_bootstrap",
        });

        if (dbState.whatsapp_session_status === "CONNECTED") {
          setQrScannedByUser(true);
          setConnectionConfirmedByUser(true);
        }
      }

      await Promise.all([checkSessionStatus(inst.id, true), refreshChannelsLayer(true)]);
    } catch (e) {
      console.error(e);
      if (!silent) showMessage("error", "فشل تحميل المؤسسة");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleCreateSession = async () => {
    const inst = institution || (await resolveInstitutionLocally());

    if (!inst?.id || !isUuid(inst.id)) {
      showMessage("error", "لم يتم العثور على Supabase UUID صالح للمؤسسة");
      return;
    }

    setInstitution(inst);
    setIsCreating(true);
    setMessage(null);
    setQrScannedByUser(false);
    setConnectionConfirmedByUser(false);

    try {
      const result = await waakuService.startSession(inst.id);

      if (!result.success) {
        showMessage("error", result.error || "فشل إنشاء الجلسة");
        return;
      }

      setSession({
        status: "SCANNING",
        sessionId: result.instanceName || inst.id,
        instanceName: result.instanceName || inst.id,
        phoneNumber: result.phoneNumber || null,
        qrCode: result.qrCode || null,
        source: "waaku_server",
      });

      if (result.qrCode) setQrCode(result.qrCode);

      setSessionCreatedAt(Date.now());
      startPolling(inst.id);
      showMessage("success", "تم إنشاء جلسة الرسائل، يرجى مسح QR");
    } catch (e: any) {
      console.error(e);
      showMessage("error", e?.message || "فشل إنشاء الجلسة");
    } finally {
      setIsCreating(false);
    }
  };

  const handleShowQr = async () => {
    const institutionId = institution?.id;
    if (!institutionId || !isUuid(institutionId)) {
      showMessage("error", "لم يتم العثور على Supabase UUID صالح للمؤسسة");
      return;
    }

    if (session.status === "CONNECTED" && connectionConfirmedByUser) {
      showMessage("success", "جلسة الرسائل متصلة بالفعل");
      return;
    }

    setIsLoadingQr(true);

    try {
      const qrRes = await waakuService.getQr(institutionId);

      if (qrRes.success && qrRes.qr) {
        setQrCode(qrRes.qr);
        setSession((prev) => ({ ...prev, status: "SCANNING" }));
        showMessage("success", "تم تحميل QR");
        return;
      }

      showMessage("info", qrRes.error || "لم يتم العثور على QR حاليًا");
    } catch (e: any) {
      console.error(e);
      showMessage("error", e.message || "تعذر تحميل QR");
    } finally {
      setIsLoadingQr(false);
    }
  };

  const handleDeleteSession = async () => {
    const inst = institution || (await resolveInstitutionLocally());

    if (!inst?.id || !isUuid(inst.id)) {
      showMessage("error", "لم يتم العثور على Supabase UUID صالح للمؤسسة");
      return;
    }

    const ok = window.confirm("سيتم حذف جلسة واتساب الرسائل العادية فقط. هل تريد المتابعة؟");
    if (!ok) return;

    setIsDeleting(true);
    setMessage(null);

    try {
      const result = await waakuService.stopSession(inst.id);

      if (!result.success) {
        showMessage("error", result.error || "فشل حذف الجلسة");
        return;
      }

      setSession({ ...emptySession, source: "local_delete" });
      setSessionCreatedAt(null);
      setQrCode("");
      setQrScannedByUser(false);
      setConnectionConfirmedByUser(false);
      clearPolling();

      showMessage("success", "تم حذف جلسة الرسائل بنجاح");
    } catch (e: any) {
      console.error(e);
      showMessage("error", e.message || "فشل حذف الجلسة");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmQrScanned = async () => {
    setQrScannedByUser(true);
    showMessage("info", "تم تسجيل أنك مسحت QR، جاري التحقق من الربط...");
    await checkSessionStatus(undefined, false);
  };

  const handleTestSend = async () => {
    const inst = institution || (await resolveInstitutionLocally());

    if (!inst?.id || !isUuid(inst.id)) {
      showMessage("error", "لم يتم العثور على Supabase UUID صالح للمؤسسة");
      return;
    }

    if (!reallyConnected) {
      showMessage("error", "يجب إكمال ربط واتساب الرسائل أولاً");
      return;
    }

    if (!testPhone.trim()) {
      showMessage("error", "أدخل رقم الهاتف");
      return;
    }

    if (!testMessage.trim()) {
      showMessage("error", "أدخل نص الرسالة");
      return;
    }

    setIsSending(true);

    try {
      const res = await waakuService.sendMessage(inst.id, testPhone, testMessage);

      if (res.success) showMessage("success", "تم الإرسال");
      else showMessage("error", res.message);
    } catch (e: any) {
      console.error(e);
      showMessage("error", e.message || "فشل الإرسال");
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    void loadInstitution(false);

    const onFocus = () => void loadInstitution(true);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadInstitution(true);
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      clearPolling();
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
        messageTimeoutRef.current = null;
      }
    };
  }, []);

  const reallyConnected = session.status === "CONNECTED" && qrScannedByUser && connectionConfirmedByUser;

  const sessionBadge = reallyConnected
    ? { label: "متصل", color: "emerald", icon: Wifi }
    : session.status === "SCANNING" || qrScannedByUser
    ? { label: qrScannedByUser ? "جار التحقق" : "بانتظار QR", color: "amber", icon: QrCode }
    : { label: "غير متصل", color: "rose", icon: WifiOff };

  const SessionIcon = sessionBadge.icon;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" dir="rtl">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8 flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="font-semibold text-slate-700">جاري تحميل حالة واتساب...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="rounded-3xl overflow-hidden bg-gradient-to-l from-emerald-700 via-green-600 to-cyan-500 text-white shadow-xl">
          <div className="p-6 md:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/20 px-3 py-1.5 text-xs font-semibold mb-4">
                <MessageSquare className="w-4 h-4" />
                QR مستقل خاص بالرسائل العادية
              </div>
              <h1 className="text-2xl md:text-4xl font-black mb-2">ربط واتساب الرسائل</h1>
              <p className="text-white/90 max-w-2xl">
                هذه الصفحة خاصة بالرسائل العادية للأرقام الخاصة فقط. طبقة الشنلات والجروبات لها صفحة وربط مستقل.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-[300px]">
              <div className="rounded-2xl bg-white/15 border border-white/20 p-4">
                <div className="text-xs text-white/75 mb-1">جلسة الرسائل</div>
                <div className="flex items-center gap-2 font-bold">
                  <SessionIcon className="w-5 h-5" />
                  {sessionBadge.label}
                </div>
              </div>

              <div className="rounded-2xl bg-white/15 border border-white/20 p-4">
                <div className="text-xs text-white/75 mb-1">طبقة الشنلات</div>
                <div className="font-bold">{channelsLayer.ready ? "جاهزة" : "غير جاهزة"}</div>
              </div>

              <div className="rounded-2xl bg-white/15 border border-white/20 p-4">
                <div className="text-xs text-white/75 mb-1">المؤسسة</div>
                <div className="font-bold truncate">{institution?.name || "-"}</div>
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
            {message.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-semibold text-sm">{message.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 rounded-3xl bg-white border border-slate-200 shadow-sm p-5 md:p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Smartphone className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">جلسة واتساب الرسائل العادية</h2>
                <p className="text-sm text-slate-500">استعملها لاحقاً لإرسال رسائل مباشرة إلى أرقام أولياء الأمور.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500 mb-1">Session ID</div>
                <div className="font-bold text-slate-800 break-all">{session.sessionId || "-"}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500 mb-1">رقم الهاتف</div>
                <div className="font-bold text-slate-800">{session.phoneNumber || "-"}</div>
              </div>
            </div>

            <div className="min-h-[360px] rounded-3xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center p-6">
              {qrCode && !reallyConnected ? (
                <div className="text-center space-y-4">
                  <img src={qrCode} className="w-72 h-72 mx-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" alt="QR Code" />
                  <div>
                    <div className="font-bold text-slate-800">امسح QR الخاص بالرسائل العادية</div>
                    <p className="text-sm text-slate-500 mt-1">بعد المسح اضغط “لقد مسحت QR” ثم “تحديث الحالة”.</p>
                  </div>
                </div>
              ) : reallyConnected ? (
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-emerald-700">واتساب الرسائل متصل</div>
                    <p className="text-slate-500 mt-1">يمكنك تجربة الإرسال من النموذج أسفل الصفحة.</p>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
                    <QrCode className="w-12 h-12" />
                  </div>
                  <div>
                    <div className="text-xl font-black text-slate-700">لا توجد جلسة رسائل نشطة</div>
                    <p className="text-slate-500 mt-1">أنشئ جلسة جديدة أو اعرض QR إذا كانت الجلسة في وضع المسح.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 md:p-6 space-y-4">
            <h3 className="text-lg font-black text-slate-900">أوامر الرسائل العادية</h3>

            <button
              onClick={() => void checkSessionStatus(undefined, false)}
              disabled={isChecking}
              className="w-full rounded-2xl bg-blue-600 text-white px-4 py-4 font-bold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50"
            >
              {isChecking ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
              تحديث الحالة
            </button>

            <button
              onClick={() => void handleCreateSession()}
              disabled={isCreating}
              className="w-full rounded-2xl bg-emerald-600 text-white px-4 py-4 font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50"
            >
              {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
              إنشاء جلسة رسائل
            </button>

            <button
              onClick={() => void handleShowQr()}
              disabled={isLoadingQr}
              className="w-full rounded-2xl bg-violet-600 text-white px-4 py-4 font-bold flex items-center justify-center gap-2 hover:bg-violet-700 disabled:opacity-50"
            >
              {isLoadingQr ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
              عرض / إعادة عرض QR
            </button>

            <button
              onClick={() => void handleConfirmQrScanned()}
              disabled={!qrCode && session.status !== "SCANNING"}
              className="w-full rounded-2xl bg-amber-500 text-white px-4 py-4 font-bold flex items-center justify-center gap-2 hover:bg-amber-600 disabled:opacity-50"
            >
              <CheckCircle2 className="w-5 h-5" />
              لقد مسحت QR
            </button>

            <button
              onClick={() => void handleDeleteSession()}
              disabled={isDeleting}
              className="w-full rounded-2xl bg-rose-600 text-white px-4 py-4 font-bold flex items-center justify-center gap-2 hover:bg-rose-700 disabled:opacity-50"
            >
              {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
              حذف جلسة الرسائل
            </button>

            {channelsLayer.lastError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 p-4 text-sm">
                تنبيه طبقة الشنلات: {channelsLayer.lastError}
              </div>
            )}

            <button
              onClick={() => void refreshChannelsLayer(false)}
              disabled={isRefreshingChannels}
              className="w-full rounded-2xl bg-slate-800 text-white px-4 py-4 font-bold flex items-center justify-center gap-2 hover:bg-slate-900 disabled:opacity-50"
            >
              {isRefreshingChannels ? <Loader2 className="w-5 h-5 animate-spin" /> : <Layers3 className="w-5 h-5" />}
              فحص طبقة الشنلات فقط
            </button>

            <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm text-cyan-800 leading-7">
              الشنلات والجروبات تعمل من صفحة مستقلة. لا تحذف جلسة الرسائل إذا كان هدفك فقط إعادة ربط طبقة الشنلات.
            </div>
          </div>
        </div>

        {reallyConnected && (
          <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 md:p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Send className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">اختبار الرسائل العادية</h2>
                <p className="text-sm text-slate-500">هذا الجزء خاص بالرسائل المباشرة للأرقام، وليس الشنلات.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="رقم الهاتف"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />

              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="lg:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 min-h-[110px] focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <button
              onClick={() => void handleTestSend()}
              disabled={isSending}
              className="mt-4 rounded-2xl bg-blue-600 text-white px-6 py-4 font-bold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50"
            >
              {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              إرسال رسالة اختبار
            </button>
          </div>
        )}

        {!reallyConnected && session.status !== "SCANNING" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-3 text-slate-600">
            <XCircle className="w-5 h-5 text-slate-400" />
            <span className="text-sm">الرسائل العادية غير جاهزة حالياً، وهذا لا يمنع عمل الشنلات والجروبات إذا كانت طبقتها جاهزة.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WaakuWhatsAppConnection;
