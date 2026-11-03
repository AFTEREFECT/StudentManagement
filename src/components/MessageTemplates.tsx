import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Edit3,
  FileText,
  MessageSquare,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteMessageTemplate,
  loadMessageTemplates,
  MessageTemplate,
  saveMessageTemplates,
  upsertMessageTemplate,
} from "../utils/messageTemplatesStorage";

type Props = {
  setActiveTab?: (tab: string) => void;
};

type UiMessage = {
  type: "success" | "error" | "info";
  text: string;
} | null;

const emptyForm = {
  id: "",
  title: "",
  category: "",
  content: "",
  createdAt: "",
};

const MessageTemplates: React.FC<Props> = ({ setActiveTab }) => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState<UiMessage>(null);

  const showMessage = (type: "success" | "error" | "info", text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 3500);
  };

  const loadData = () => {
    const loaded = loadMessageTemplates();
    setTemplates(loaded);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredTemplates = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    if (!q) return templates;

    return templates.filter((template) => {
      return (
        template.title.toLowerCase().includes(q) ||
        template.content.toLowerCase().includes(q) ||
        String(template.category || "").toLowerCase().includes(q)
      );
    });
  }, [templates, searchTerm]);

  const categories = useMemo(() => {
    return Array.from(
      new Set(templates.map((item) => String(item.category || "").trim()).filter(Boolean))
    );
  }, [templates]);

  const resetForm = () => {
    setForm(emptyForm);
    setIsEditing(false);
    setShowForm(false);
  };

  const handleNew = () => {
    setForm(emptyForm);
    setIsEditing(false);
    setShowForm(true);
  };

  const handleEdit = (template: MessageTemplate) => {
    setForm({
      id: template.id,
      title: template.title,
      category: template.category || "",
      content: template.content,
      createdAt: template.createdAt,
    });
    setIsEditing(true);
    setShowForm(true);
  };

  const handleSave = () => {
    try {
      const next = upsertMessageTemplate({
        id: form.id || undefined,
        title: form.title,
        category: form.category,
        content: form.content,
        createdAt: form.createdAt || undefined,
      });

      setTemplates(next);
      resetForm();
      showMessage("success", isEditing ? "تم تعديل النموذج بنجاح" : "تم حفظ النموذج بنجاح");
    } catch (error: any) {
      showMessage("error", error?.message || "تعذر حفظ النموذج");
    }
  };

  const handleDelete = (template: MessageTemplate) => {
    const ok = window.confirm(`هل تريد حذف النموذج "${template.title}"؟`);
    if (!ok) return;

    const next = deleteMessageTemplate(template.id);
    setTemplates(next);
    showMessage("success", "تم حذف النموذج");
  };

  const handleCopy = async (template: MessageTemplate) => {
    try {
      await navigator.clipboard.writeText(template.content);
      showMessage("success", "تم نسخ نص النموذج");
    } catch {
      showMessage("error", "تعذر نسخ النص");
    }
  };

  const handleUseInWhatsApp = (template: MessageTemplate) => {
    localStorage.setItem("selectedWhatsAppTemplate", template.content);
    setActiveTab?.("whatsapp-communication");
    showMessage("success", "تم اختيار النموذج للتواصل عبر واتساب");
  };

  const handleCreateSampleTemplates = () => {
    const now = new Date().toISOString();

    const samples: MessageTemplate[] = [
      {
        id: crypto.randomUUID(),
        title: "إخبار بغياب تلميذ",
        category: "إداري",
        content:
          "السلام عليكم ورحمة الله وبركاته،\nنخبركم أن ابنكم/ابنتكم تغيب(ت) عن المؤسسة. يرجى التواصل مع الإدارة لتبرير الغياب.\nمع تحيات إدارة المؤسسة.",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        title: "دعوة لاجتماع الآباء",
        category: "اجتماعات",
        content:
          "السلام عليكم ورحمة الله وبركاته،\nتدعوكم إدارة المؤسسة لحضور اجتماع الآباء والأمهات يوم ... على الساعة ...\nحضوركم مهم لدعم تمدرس أبنائنا.",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        title: "إعلان هام",
        category: "إعلانات",
        content:
          "السلام عليكم،\nتنهي إدارة المؤسسة إلى علمكم أن ...\nوشكراً على تفهمكم.",
        createdAt: now,
        updatedAt: now,
      },
    ];

    const merged = [...samples, ...templates];
    saveMessageTemplates(merged);
    setTemplates(merged);
    showMessage("success", "تم إنشاء نماذج أولية");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="rounded-3xl overflow-hidden bg-gradient-to-l from-blue-600 via-indigo-600 to-violet-700 text-white shadow-xl">
          <div className="p-6 md:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
                <MessageSquare className="w-8 h-8" />
              </div>

              <div>
                <h1 className="text-2xl md:text-4xl font-black mb-2">نماذج الرسائل الجاهزة</h1>
                <p className="text-white/90 max-w-2xl">
                  أنشئ نماذج رسائل واحفظها لاستعمالها لاحقاً في صفحة التواصل عبر واتساب.
                </p>
              </div>
            </div>

            <button
              onClick={handleNew}
              className="rounded-2xl bg-white text-blue-700 px-5 py-3 font-bold hover:bg-blue-50 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              نموذج جديد
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
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold text-sm">{message.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 space-y-5">
            <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ابحث بعنوان النموذج أو التصنيف أو محتوى الرسالة..."
                    className="w-full pr-12 pl-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                {templates.length === 0 && (
                  <button
                    onClick={handleCreateSampleTemplates}
                    className="rounded-2xl bg-slate-800 text-white px-4 py-3 font-semibold hover:bg-slate-900"
                  >
                    إنشاء نماذج أولية
                  </button>
                )}
              </div>

              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {categories.map((category) => (
                    <span
                      key={category}
                      className="rounded-full bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 text-xs font-semibold"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {filteredTemplates.length === 0 ? (
              <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-12 text-center">
                <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <div className="text-lg font-bold text-slate-700 mb-1">لا توجد نماذج رسائل</div>
                <p className="text-slate-500 mb-5">
                  قم بإنشاء نموذج جديد ثم استعمله في صفحة التواصل عبر واتساب.
                </p>
                <button
                  onClick={handleNew}
                  className="rounded-2xl bg-blue-600 text-white px-5 py-3 font-bold hover:bg-blue-700 inline-flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  إنشاء نموذج جديد
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        {template.category && (
                          <div className="inline-flex rounded-full bg-violet-50 text-violet-700 border border-violet-100 px-3 py-1 text-xs font-bold mb-2">
                            {template.category}
                          </div>
                        )}

                        <h3 className="text-lg font-black text-slate-900">{template.title}</h3>
                      </div>

                      <FileText className="w-6 h-6 text-slate-300 flex-shrink-0" />
                    </div>

                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 min-h-[130px] text-sm text-slate-700 whitespace-pre-wrap leading-7">
                      {template.content}
                    </div>

                    <div className="text-[11px] text-slate-400 mt-3">
                      آخر تعديل: {new Date(template.updatedAt).toLocaleString("ar-MA")}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                      <button
                        onClick={() => handleUseInWhatsApp(template)}
                        className="rounded-xl bg-blue-600 text-white px-3 py-2 text-sm font-bold hover:bg-blue-700 flex items-center justify-center gap-1"
                      >
                        <Send className="w-4 h-4" />
                        استعمال
                      </button>

                      <button
                        onClick={() => handleEdit(template)}
                        className="rounded-xl bg-amber-500 text-white px-3 py-2 text-sm font-bold hover:bg-amber-600 flex items-center justify-center gap-1"
                      >
                        <Edit3 className="w-4 h-4" />
                        تعديل
                      </button>

                      <button
                        onClick={() => handleCopy(template)}
                        className="rounded-xl bg-slate-700 text-white px-3 py-2 text-sm font-bold hover:bg-slate-800 flex items-center justify-center gap-1"
                      >
                        <Copy className="w-4 h-4" />
                        نسخ
                      </button>

                      <button
                        onClick={() => handleDelete(template)}
                        className="rounded-xl bg-rose-600 text-white px-3 py-2 text-sm font-bold hover:bg-rose-700 flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="xl:col-span-1">
            <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sticky top-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-black text-slate-900">
                  {showForm ? (isEditing ? "تعديل النموذج" : "نموذج جديد") : "إنشاء نموذج"}
                </h2>

                {showForm && (
                  <button
                    onClick={resetForm}
                    className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {!showForm ? (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-blue-800 text-sm leading-7">
                    أنشئ نماذج مثل: الغياب، الاجتماع، إعلان هام، تذكير، ثم اخترها من صفحة التواصل.
                  </div>

                  <button
                    onClick={handleNew}
                    className="w-full rounded-2xl bg-blue-600 text-white px-5 py-4 font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    نموذج جديد
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">عنوان النموذج</label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="مثال: إخبار بغياب تلميذ"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">التصنيف اختياري</label>
                    <input
                      value={form.category}
                      onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                      placeholder="مثال: إداري / اجتماع / غياب"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">نص الرسالة</label>
                    <textarea
                      value={form.content}
                      onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                      placeholder="اكتب نص الرسالة هنا..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 min-h-[220px] focus:outline-none focus:ring-2 focus:ring-blue-400 leading-7"
                    />
                  </div>

                  <button
                    onClick={handleSave}
                    className="w-full rounded-2xl bg-emerald-600 text-white px-5 py-4 font-bold hover:bg-emerald-700 flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    {isEditing ? "حفظ التعديل" : "حفظ النموذج"}
                  </button>

                  <button
                    onClick={resetForm}
                    className="w-full rounded-2xl bg-slate-100 text-slate-700 px-5 py-3 font-bold hover:bg-slate-200"
                  >
                    إلغاء
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export { MessageTemplates };
export default MessageTemplates;
 
