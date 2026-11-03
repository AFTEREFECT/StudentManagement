import React, { useMemo, useState } from "react";
import { supabase } from "./utils/supabase";
import { AlertCircle, CheckCircle2, Loader2, Smartphone } from "lucide-react";

const INSTITUTION_ID =
  import.meta.env.VITE_INSTITUTION_ID || "04b1dd76-b9f8-476f-99ba-afeef9fddba3";

const SECTIONS = [
  "1APIC-1","1APIC-2","1APIC-3","1APIC-4","1APIC-5","1APIC-6","1APIC-7","1APIC-8",
  "2APIC-1","2APIC-2","2APIC-3","2APIC-4","2APIC-5","2APIC-6","2APIC-7","2APIC-8",
  "3APIC-1","3APIC-2","3APIC-3","3APIC-4","3APIC-5","3APIC-6","3APIC-7","3APIC-8",
];

type UiMessage = { type: "success" | "error" | "info"; text: string } | null;

const normalizeMassar = (value: string) =>
  String(value || "").trim().toUpperCase().replace(/\s+/g, "");

const normalizePhone = (value: string) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^0[67]\d{8}$/.test(digits)) return digits;
  if (/^212[67]\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^[67]\d{8}$/.test(digits)) return `0${digits}`;
  return digits;
};

const StudentPhoneRequestForm: React.FC = () => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const sectionFromUrl = params.get("section") || "";
  const massarFromUrl = params.get("id") || params.get("massar") || "";

  const [sectionName, setSectionName] = useState(sectionFromUrl);
  const [nationalId, setNationalId] = useState(normalizeMassar(massarFromUrl));
  const [birthDate, setBirthDate] = useState("");
  const [phoneOwner, setPhoneOwner] = useState("student");
  const [phone, setPhone] = useState("");
  const [confirmPhone, setConfirmPhone] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<UiMessage>(null);

  const validate = () => {
    if (!sectionName.trim()) return "اختر القسم";
    if (!nationalId.trim()) return "أدخل رقم مسار";

    const p1 = normalizePhone(phone);
    const p2 = normalizePhone(confirmPhone);

    if (!p1 || !p2) return "أدخل رقم واتساب وأعد تأكيده";
    if (p1 !== p2) return "رقما واتساب غير متطابقين";
    if (!/^0[67]\d{8}$/.test(p1)) return "رقم واتساب غير صحيح. مثال: 0612345678";
    if (!accepted) return "يجب تأكيد أن الرقم صحيح ويخصك أو يخص ولي أمرك";

    return "";
  };

  const handleSubmit = async () => {
    setMessage(null);

    const err = validate();
    if (err) {
      setMessage({ type: "error", text: err });
      return;
    }

    setLoading(true);

    try {
      const payload = {
        institution_id: INSTITUTION_ID,
        national_id: normalizeMassar(nationalId),
        section_name: sectionName.trim(),
        submitted_phone: normalizePhone(phone),
        phone_owner: phoneOwner,
        birth_date: birthDate || null,
        status: "pending",
      };

      const { error } = await supabase.from("student_phone_requests").insert(payload);

      if (error) {
        if (error.code === "23505" || error.message?.includes("unique_pending_phone_request")) {
          setMessage({ type: "info", text: "لديك طلب قيد المراجعة مسبقاً. انتظر مصادقة الإدارة." });
          return;
        }
        throw error;
      }

      setMessage({ type: "success", text: "تم إرسال الطلب بنجاح. سيتم اعتماد الرقم بعد مراجعة الإدارة." });
      setPhone("");
      setConfirmPhone("");
      setAccepted(false);
    } catch (error: any) {
      console.error("submit phone request error:", error);
      setMessage({ type: "error", text: error?.message || "تعذر إرسال الطلب. حاول لاحقاً." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-xl">
        <div className="rounded-3xl overflow-hidden bg-white border border-slate-200 shadow-xl">
          <div className="bg-gradient-to-l from-emerald-600 to-blue-600 text-white p-6 text-center">
            <div className="w-16 h-16 rounded-3xl bg-white/15 border border-white/20 mx-auto mb-4 flex items-center justify-center">
              <Smartphone className="w-9 h-9" />
            </div>
            <h1 className="text-2xl font-black mb-2">طلب اعتماد رقم واتساب</h1>
            <p className="text-white/90 text-sm">أدخل معلوماتك بدقة. لن يتم اعتماد الرقم حتى تراجع الإدارة الطلب.</p>
          </div>

          <div className="p-5 md:p-6 space-y-4">
            {message && (
              <div
                className={`rounded-2xl border p-4 flex items-start gap-3 ${
                  message.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : message.type === "error"
                    ? "bg-red-50 text-red-800 border-red-200"
                    : "bg-blue-50 text-blue-800 border-blue-200"
                }`}
              >
                {message.type === "success" ? <CheckCircle2 className="w-5 h-5 mt-0.5" /> : <AlertCircle className="w-5 h-5 mt-0.5" />}
                <span className="text-sm font-semibold leading-7">{message.text}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">القسم</label>
              <select value={sectionName} onChange={(e) => setSectionName(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">اختر القسم</option>
                {SECTIONS.map((section) => <option key={section} value={section}>{section}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">رقم مسار</label>
              <input value={nationalId} onChange={(e) => setNationalId(normalizeMassar(e.target.value))} placeholder="مثال: R170051757" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" dir="ltr" />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">تاريخ الازدياد اختياري</label>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">صاحب الرقم</label>
              <select value={phoneOwner} onChange={(e) => setPhoneOwner(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="student">رقمي الشخصي</option>
                <option value="father">رقم الأب</option>
                <option value="mother">رقم الأم</option>
                <option value="guardian">رقم ولي الأمر</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">رقم واتساب</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0612345678" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" dir="ltr" />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">تأكيد رقم واتساب</label>
              <input value={confirmPhone} onChange={(e) => setConfirmPhone(e.target.value)} placeholder="0612345678" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" dir="ltr" />
            </div>

            <label className="flex items-start gap-3 rounded-2xl bg-slate-50 border border-slate-200 p-4 cursor-pointer">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1" />
              <span className="text-sm text-slate-700 leading-7">أؤكد أن الرقم صحيح ويخصني أو يخص ولي أمري، وأوافق على استعماله للتواصل المدرسي.</span>
            </label>

            <button onClick={handleSubmit} disabled={loading} className="w-full rounded-2xl bg-blue-600 text-white px-5 py-4 font-black hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Smartphone className="w-5 h-5" />}
              إرسال الطلب للمراجعة
            </button>

            <div className="rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 p-4 text-xs leading-6">لن يتم استعمال هذا الرقم في الإرسال حتى توافق الإدارة عليه داخل البرنامج.</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentPhoneRequestForm;
