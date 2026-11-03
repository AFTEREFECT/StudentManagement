export type MessageTemplate = {
  id: string;
  title: string;
  content: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
};

export const MESSAGE_TEMPLATES_STORAGE_KEY = "messageTemplates";

export const loadMessageTemplates = (): MessageTemplate[] => {
  try {
    const raw = localStorage.getItem(MESSAGE_TEMPLATES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: String(item.id || crypto.randomUUID()),
        title: String(item.title || "").trim(),
        content: String(item.content || "").trim(),
        category: String(item.category || "").trim(),
        createdAt: String(item.createdAt || new Date().toISOString()),
        updatedAt: String(item.updatedAt || new Date().toISOString()),
      }))
      .filter((item) => item.title && item.content);
  } catch (error) {
    console.error("خطأ في تحميل نماذج الرسائل:", error);
    return [];
  }
};

export const saveMessageTemplates = (templates: MessageTemplate[]) => {
  try {
    localStorage.setItem(MESSAGE_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error("خطأ في حفظ نماذج الرسائل:", error);
    throw error;
  }
};

export const upsertMessageTemplate = (
  template: Omit<MessageTemplate, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
    createdAt?: string;
  }
): MessageTemplate[] => {
  const now = new Date().toISOString();
  const templates = loadMessageTemplates();

  const normalized: MessageTemplate = {
    id: template.id || crypto.randomUUID(),
    title: String(template.title || "").trim(),
    content: String(template.content || "").trim(),
    category: String(template.category || "").trim(),
    createdAt: template.createdAt || now,
    updatedAt: now,
  };

  if (!normalized.title || !normalized.content) {
    throw new Error("عنوان النموذج ونص الرسالة مطلوبان");
  }

  const exists = templates.some((item) => item.id === normalized.id);
  const next = exists
    ? templates.map((item) => (item.id === normalized.id ? normalized : item))
    : [normalized, ...templates];

  saveMessageTemplates(next);
  return next;
};

export const deleteMessageTemplate = (id: string): MessageTemplate[] => {
  const next = loadMessageTemplates().filter((item) => item.id !== id);
  saveMessageTemplates(next);
  return next;
};
