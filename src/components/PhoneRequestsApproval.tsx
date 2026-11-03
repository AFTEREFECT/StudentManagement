 import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";

import { dbManager } from "../utils/database";
import { supabase } from "../utils/supabase";
import { waakuService } from "../utils/waakuService";
import {
  approvePhoneRequest,
  fetchPhoneRequests,
  rejectPhoneRequest,
  StudentPhoneRequest,
  PhoneRequestStatus,
} from "../utils/studentPhoneRequests";

type DbStudent = {
  id: string | number;
  firstName?: string;
  lastName?: string;
  nationalId?: string;
  sectionName?: string;
  section?: string;
  phone?: string;
  status?: string;
};

type UiMessage = {
  type: "success" | "error" | "info";
  text: string;
} | null;

const statusLabels: Record<PhoneRequestStatus | "all", string> = {
  pending: "قيد المراجعة",
  approved: "مقبولة",
  rejected: "مرفوضة",
  all: "الكل",
};

const normalizeToWhatsappNumber = (value: string) => {
  const digits = String(value || "").replace(/\D/g, "");

  // 0662705774 -> 212662705774
  if (/^0[67]\d{8}$/.test(digits)) {
    return `212${digits.slice(1)}`;
  }

  // 662705774 -> 212662705774
  if (/^[67]\d{8}$/.test(digits)) {
    return `212${digits}`;
  }

  // 212662705774 -> 212662705774
  if (/^212[67]\d{8}$/.test(digits)) {
    return digits;
  }

  return digits;
};

const PhoneRequestsApproval: React.FC = () => {
  const [institutionId, setInstitutionId] = useState("");
  const [students, setStudents] = useState<DbStudent[]>([]);
  const [requests, setRequests] = useState<StudentPhoneRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<PhoneRequestStatus | "all">("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<UiMessage>(null);

  const showMessage = (type: "success" | "error" | "info", text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 5500);
  };

  const getInstitutionId = async () => {
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
      const raw = localStorage.getItem("institution_settings_backup");
      backup = raw ? JSON.parse(raw) : null;
    } catch {}

    return (
      String(settings?.supabaseInstitutionId || "").trim() ||
      String(settings?.supabase_institution_id || "").trim() ||
      String(settings?.id || "").trim() ||
      dbInstitutionId ||
      String(backup?.supabaseInstitutionId || "").trim() ||
      String(backup?.supabase_institution_id || "").trim()
    );
  };

  const loadData = async () => {
    setLoading(true);

    try {
      const id = await getInstitutionId();

      if (!id) {
        setInstitutionId("");
        setRequests([]);
        showMessage("error", "لم يتم العثور على معرف المؤسسة Supabase");
        return;
      }

      setInstitutionId(id);

      const [studentsData, requestsData] = await Promise.all([
        dbManager.getStudents(),
        fetchPhoneRequests(id, statusFilter),
      ]);

      setStudents(Array.isArray(studentsData) ? (studentsData as DbStudent[]) : []);
      setRequests(requestsData);
    } catch (error: any) {
      console.error("PhoneRequestsApproval loadData error:", error);
      showMessage("error", error?.message || "فشل تحميل طلبات أرقام واتساب");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [statusFilter]);

  const normalizeMatchText = (value?: string | number | null) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFKC")
      .replace(/[\s_-]+/g, "");

  const findStudent = (request: StudentPhoneRequest) => {
    const nationalId = normalizeMatchText(request.national_id);
    const section = normalizeMatchText(request.section_name);

    const matchesByNationalId = students.filter((student) => {
      const studentNationalId = normalizeMatchText(student.nationalId);
      return studentNationalId === nationalId;
    });

    if (!matchesByNationalId.length) return undefined;
    if (!section) return matchesByNationalId[0];

    const exactSectionMatch = matchesByNationalId.find((student) => {
      const studentSection = normalizeMatchText(student.sectionName || student.section);
      return studentSection === section;
    });

    if (exactSectionMatch) return exactSectionMatch;

    return matchesByNationalId.length === 1 ? matchesByNationalId[0] : undefined;
  };

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return requests;

    return requests.filter((request) => {
      const student = findStudent(request);
      const fullName = `${student?.firstName || ""} ${student?.lastName || ""}`.trim();

      return (
        String(request.national_id || "").toLowerCase().includes(q) ||
        String(request.section_name || "").toLowerCase().includes(q) ||
        String(request.submitted_phone || "").toLowerCase().includes(q) ||
        fullName.toLowerCase().includes(q)
      );
    });
  }, [requests, search, students]);

  const stats = useMemo(
    () => ({
      pending: requests.filter((item) => item.status === "pending").length,
      approved: requests.filter((item) => item.status === "approved").length,
      rejected: requests.filter((item) => item.status === "rejected").length,
      total: requests.length,
    }),
    [requests]
  );

  const sendApprovalNotification = async (
    targetInstitutionId: string,
    phone: string,
    studentName: string
  ) => {
    const text = `السلام عليكم ورحمة الله وبركاته،

تم قبول طلب اعتماد رقم واتساب الخاص بكم بنجاح.

التلميذ(ة): ${studentName || "غير محدد"}

سيتم استعمال هذا الرقم للتواصل المدرسي مستقبلاً.

إدارة المؤسسة`;

    try {
      if (!targetInstitutionId) {
        return {
          success: false,
          message: "تعذر إرسال الإشعار: معرف المؤسسة غير موجود",
        };
      }

      const result = await waakuService.sendMessage(targetInstitutionId, phone, text);

      if (!result.success) {
        return {
          success: false,
          message: result.message || "تم الاعتماد، لكن تعذر إرسال إشعار واتساب",
        };
      }

      return {
        success: true,
        message: "تم إرسال إشعار القبول بنجاح",
      };
    } catch (error: any) {
      console.error("approval notification error:", error);

      return {
        success: false,
        message: error?.message || "تم الاعتماد، لكن تعذر إرسال إشعار واتساب",
      };
    }
  };

  const handleApprove = async (request: StudentPhoneRequest) => {
    const student = findStudent(request);

    if (!student) {
      showMessage(
        "error",
        "تعذر العثور على التلميذ في قاعدة البيانات المحلية بنفس رقم مسار والقسم"
      );
      return;
    }

    const whatsappPhone = normalizeToWhatsappNumber(request.submitted_phone);

    if (!/^212[67]\d{8}$/.test(whatsappPhone)) {
      showMessage("error", "رقم واتساب غير صحيح. يجب أن يكون مثل 212662705774");
      return;
    }

    const studentName = `${student.firstName || ""} ${student.lastName || ""}`.trim();

    const confirmed = window.confirm(
      `هل تريد اعتماد الرقم التالي للتلميذ؟\n\n` +
        `التلميذ: ${studentName || "-"}\n` +
        `القسم: ${request.section_name}\n` +
        `رقم مسار: ${request.national_id}\n` +
        `الهاتف الأصلي: ${request.submitted_phone}\n` +
        `الهاتف المعتمد: ${whatsappPhone}`
    );

    if (!confirmed) return;

    setBusyId(request.id);

    try {
      // 1) تحديث رقم التلميذ محلياً بصيغة واتساب الدولية
      await dbManager.updateStudent(student.id, {
        phone: whatsappPhone,
      });

      // 2) تحديث حالة الطلب في Supabase إلى approved
      await approvePhoneRequest(request.id, "admin");

      // 3) محاولة إرسال إشعار القبول عبر واتساب
      const notifyResult = await sendApprovalNotification(
        institutionId || request.institution_id,
        whatsappPhone,
        studentName
      );

      if (notifyResult.success) {
        showMessage(
          "success",
          `تم اعتماد الرقم وربطه بالتلميذ، وتم إرسال إشعار القبول: ${whatsappPhone}`
        );
      } else {
        showMessage(
          "info",
          `تم اعتماد الرقم وربطه بالتلميذ: ${whatsappPhone}. ${notifyResult.message}`
        );
      }

      await loadData();
    } catch (error: any) {
      console.error("approve request error:", error);
      showMessage("error", error?.message || "فشل اعتماد الرقم");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (request: StudentPhoneRequest) => {
  if (!request?.id) {
    showMessage("error", "معرف الطلب غير موجود");
    return;
  }

  const confirmed = window.confirm(
    `هل تريد رفض هذا الطلب؟\n\n` +
      `رمز مسار: ${request.national_id}\n` +
      `القسم: ${request.section_name}\n` +
      `الهاتف: ${request.submitted_phone}`
  );

  if (!confirmed) return;

  const reason = "رقم مسار أو القسم لا يطابق قاعدة البيانات المحلية";

  setBusyId(request.id);

  try {
    try {
      await rejectPhoneRequest(request.id, reason, "admin");
    } catch {
      const { error } = await supabase
        .from("student_phone_requests")
        .update({
          status: "rejected",
          reject_reason: reason,
          approved_at: new Date().toISOString(),
          approved_by: "admin",
        })
        .eq("id", request.id);

      if (error) throw error;
    }

    showMessage("success", "تم رفض الطلب بنجاح");
    await loadData();
  } catch (error: any) {
    console.error("reject request error:", error);
    showMessage("error", error?.message || "فشل رفض الطلب");
  } finally {
    setBusyId(null);
  }
};

  const statusBadge = (status: PhoneRequestStatus) => {
    if (status === "approved") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4" />
          مقبول
        </span>
      );
    }

    if (status === "rejected") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 text-xs font-bold">
          <XCircle className="w-4 h-4" />
          مرفوض
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 text-xs font-bold">
        <Clock3 className="w-4 h-4" />
        قيد المراجعة
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" dir="rtl">
        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-8 flex items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="font-bold text-slate-700">جاري تحميل طلبات الأرقام...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="rounded-3xl overflow-hidden bg-gradient-to-l from-emerald-700 via-green-600 to-cyan-500 text-white shadow-xl">
          <div className="p-6 md:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
                <ShieldCheck className="w-8 h-8" />
              </div>

              <div>
                <h1 className="text-2xl md:text-4xl font-black mb-2">
                  مراجعة طلبات أرقام واتساب
                </h1>
                <p className="text-white/90 max-w-2xl">
                  لا يتم اعتماد أي رقم حتى تضغط الإدارة على Approved. عند القبول فقط يتم ربط الرقم بالتلميذ.
                </p>
              </div>
            </div>

            <button
              onClick={() => void loadData()}
              className="rounded-2xl bg-white text-emerald-700 px-5 py-3 font-bold hover:bg-emerald-50 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              تحديث الطلبات
            </button>
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
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold text-sm">{message.text}</span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
            <div className="text-xs text-slate-500 mb-1">قيد المراجعة</div>
            <div className="text-3xl font-black text-amber-600">{stats.pending}</div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
            <div className="text-xs text-slate-500 mb-1">مقبولة</div>
            <div className="text-3xl font-black text-emerald-600">{stats.approved}</div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
            <div className="text-xs text-slate-500 mb-1">مرفوضة</div>
            <div className="text-3xl font-black text-rose-600">{stats.rejected}</div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
            <div className="text-xs text-slate-500 mb-1">المجموع المعروض</div>
            <div className="text-3xl font-black text-slate-800">{stats.total}</div>
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
            <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث برقم مسار أو الهاتف أو القسم أو اسم التلميذ..."
                className="w-full pr-12 pl-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as PhoneRequestStatus | "all")
              }
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="pending">{statusLabels.pending}</option>
              <option value="approved">{statusLabels.approved}</option>
              <option value="rejected">{statusLabels.rejected}</option>
              <option value="all">{statusLabels.all}</option>
            </select>
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          {filteredRequests.length === 0 ? (
            <div className="p-12 text-center">
              <Smartphone className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <div className="text-lg font-bold text-slate-700">لا توجد طلبات</div>
              <p className="text-slate-500 mt-1">لا توجد طلبات مطابقة للفلتر الحالي.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="p-4 text-right">الحالة</th>
                    <th className="p-4 text-right">التلميذ</th>
                    <th className="p-4 text-right">القسم</th>
                    <th className="p-4 text-right">رمز مسار</th>
                    <th className="p-4 text-right">الهاتف المقترح</th>
                    <th className="p-4 text-right">صاحب الرقم</th>
                    <th className="p-4 text-right">تاريخ الطلب</th>
                    <th className="p-4 text-right">الإجراءات</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRequests.map((request) => {
                    const student = findStudent(request);
                    const fullName = student
                      ? `${student.firstName || ""} ${student.lastName || ""}`.trim()
                      : "غير موجود محلياً";

                    const disabled = busyId === request.id;

                    return (
                      <tr
                        key={request.id}
                        className="border-t border-slate-100 hover:bg-slate-50"
                      >
                        <td className="p-4">{statusBadge(request.status)}</td>

                        <td className="p-4 font-bold text-slate-800">
                          {fullName}
                          {!student && (
                            <div className="text-xs text-rose-600 mt-1">
                              رقم مسار أو القسم لا يطابق قاعدة البيانات المحلية
                            </div>
                          )}
                        </td>

                        <td className="p-4">{request.section_name}</td>
                        <td className="p-4 font-mono">{request.national_id}</td>
                        <td className="p-4 font-bold text-blue-700">
                          {request.submitted_phone}
                        </td>
                        <td className="p-4">{request.phone_owner || "-"}</td>
                        <td className="p-4 text-slate-500">
                          {request.created_at
                            ? new Date(request.created_at).toLocaleString("ar-MA")
                            : "-"}
                        </td>

                        <td className="p-4">
                          {request.status === "pending" ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => void handleApprove(request)}
                                disabled={disabled || !student}
                                className="rounded-xl bg-emerald-600 text-white px-3 py-2 font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                              >
                                <UserCheck className="w-4 h-4" />
                                Approved
                              </button>

                              <button
                                onClick={() => void handleReject(request)}
                                disabled={disabled}
                                className="rounded-xl bg-rose-600 text-white px-3 py-2 font-bold hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1"
                              >
                                <UserX className="w-4 h-4" />
                                Reject
                              </button>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500">
                              {request.reject_reason || request.approved_by || "-"}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 text-blue-800 p-4 text-sm leading-7">
          <strong>ملاحظة:</strong> عند الضغط على Approved يتم اعتماد الرقم وربطه بالتلميذ، ثم يحاول البرنامج إرسال إشعار قبول عبر واتساب.
        </div>
      </div>
    </div>
  );
};

export default PhoneRequestsApproval;