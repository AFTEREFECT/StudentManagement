import React, { useEffect, useState } from "react";
import { FileText, RefreshCw, Wand2, XCircle } from "lucide-react";
import { loadMessageTemplates, MessageTemplate } from "../utils/messageTemplatesStorage";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onMessage?: (type: "success" | "error" | "info", text: string) => void;
};

const MessageTemplatePicker: React.FC<Props> = ({ value, onChange, onMessage }) => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const loadTemplates = () => {
    const loaded = loadMessageTemplates();
    setTemplates(loaded);
  };

  useEffect(() => {
    loadTemplates();

    const onStorage = (event: StorageEvent) => {
      if (event.key === "messageTemplates") {
        loadTemplates();
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);

    if (!templateId) return;

    const template = templates.find((item) => item.id === templateId);

    if (!template) {
      onMessage?.("error", "تعذر العثور على النموذج");
      return;
    }

    onChange(template.content || "");
    onMessage?.("success", `تم إدراج النموذج: ${template.title}`);
  };

  const handleNewMessage = () => {
    setSelectedTemplateId("");
    onChange("");
    onMessage?.("info", "تم تفريغ الرسالة لكتابة رسالة جديدة");
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-800">
              استعمال نموذج رسالة محفوظ
            </label>
            <p className="text-xs text-slate-500">
              اختر عنوان النموذج، وسيتم إدراج النص في خانة الرسالة.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadTemplates}
          className="rounded-xl bg-white border border-slate-200 text-slate-700 px-3 py-2 text-xs font-semibold hover:bg-slate-100 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          تحديث النماذج
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
        <select
          value={selectedTemplateId}
          onChange={(e) => handleSelectTemplate(e.target.value)}
          className="w-full border border-slate-200 rounded-2xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">بدون نموذج - كتابة رسالة جديدة</option>

          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.category ? `${template.category} - ${template.title}` : template.title}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleNewMessage}
          className="rounded-2xl bg-slate-700 text-white px-4 py-3 font-semibold hover:bg-slate-800 flex items-center justify-center gap-2"
        >
          <Wand2 className="w-4 h-4" />
          استعمال جديد
        </button>
      </div>

      {templates.length === 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 text-xs flex items-center gap-2">
          <XCircle className="w-4 h-4" />
          لا توجد نماذج محفوظة حالياً. أنشئ نموذجاً من صفحة نماذج الرسائل.
        </div>
      )}

      {selectedTemplateId && (
        <p className="text-xs text-slate-500 mt-2">
          يمكنك تعديل نص النموذج قبل الإرسال، ولن يتغير النموذج الأصلي إلا من صفحة نماذج الرسائل.
        </p>
      )}

      {value?.trim() && (
        <div className="mt-3 rounded-xl bg-white border border-slate-200 p-3">
          <div className="text-xs text-slate-500 mb-1">معاينة مختصرة:</div>
          <div className="text-sm text-slate-700 line-clamp-3 whitespace-pre-wrap">
            {value}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageTemplatePicker;
