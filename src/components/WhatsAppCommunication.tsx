import React, { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import {
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Users,
  Radio,
  Layers3,
  Trash2,
  ShieldCheck,
  Building2,
  GraduationCap,
  Wifi,
  WifiOff,
} from "lucide-react";
import { dbManager } from "../utils/database";
import {
  waakuService,
  Institution,
  WaTarget,
  WaTargetType,
  WaScopeType,
  WaMediaPayload,
} from "../utils/waakuService";

type DbLevel = {
  id: string;
  code: string;
  name: string;
  createdAt?: string;
};

type DbSection = {
  class_id: string;
  class_name: string;
  level_id: string;
};

type DbStudent = {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  fatherPhone?: string;
  motherPhone?: string;
  guardianPhone?: string;
  emergencyPhone?: string;
  sectionName?: string;
  levelName?: string;
  section?: string;
  level?: string;
  sectionId?: string;
  levelId?: string;
  status?: string;
};

type SelectionMode = "section" | "level" | "institution" | "custom";
type UiMessage = { type: "success" | "error" | "info"; text: string } | null;

const ACTIVE_SESSION_ID = "";

const WhatsAppCommunication: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [institution, setInstitution] = useState<Institution | null>(null);

  const [levelsData, setLevelsData] = useState<DbLevel[]>([]);
  const [sectionsData, setSectionsData] = useState<DbSection[]>([]);
  const [studentsData, setStudentsData] = useState<DbStudent[]>([]);

  const [sessionId, setSessionId] = useState("");
  const [sessionStatus, setSessionStatus] = useState<"CONNECTED" | "SCANNING" | "DISCONNECTED">(
    "DISCONNECTED"
  );

  const [channelsLayerReady, setChannelsLayerReady] = useState(false);
  const [channelsLayerAuthenticated, setChannelsLayerAuthenticated] = useState(false);
  const [channelsLayerState, setChannelsLayerState] = useState<string>("");
  const [channelsLayerError, setChannelsLayerError] = useState<string>("");

  const [sendMode, setSendMode] = useState<"individual" | "collective">("collective");
  const [targetType, setTargetType] = useState<WaTargetType>("channel");
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("section");

  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [customValuesText, setCustomValuesText] = useState("");
  const [messageText, setMessageText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isOfficialAnnouncement, setIsOfficialAnnouncement] = useState(true);
  const [baseChannelName, setBaseChannelName] = useState("قناة التواصل");
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));

  const [targetsRegistry, setTargetsRegistry] = useState<WaTarget[]>([]);
  const [uiMessage, setUiMessage] = useState<UiMessage>(null);

  const [isPreparing, setIsPreparing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [isRefreshingChannelsLayer, setIsRefreshingChannelsLayer] = useState(false);
  const [results, setResults] = useState<
    Array<{
      title: string;
      targetId: string;
      success: boolean;
      message: string;
    }>
  >([]);

  const showMessage = (type: "success" | "error" | "info", text: string) => {
    setUiMessage({ type, text });
  };

  const askDoubleConfirmation = async (title: string, details: string) => {
    const first = window.confirm(`${title}\n\n${details}\n\nهل تريد المتابعة؟`);
    if (!first) return false;

    const second = window.confirm(`${title}\n\nتأكيد نهائي: هل أنت متأكد 100%؟`);
    return second;
  };

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showMessage("success", "تم نسخ الرابط");
    } catch (error) {
      console.error("❌ copyToClipboard error:", error);
      showMessage("error", "تعذر نسخ الرابط");
    }
  };

  const openInviteLink = (value: string) => {
    try {
      window.open(value, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("❌ openInviteLink error:", error);
      showMessage("error", "تعذر فتح الرابط");
    }
  };

  const downloadQrSvg = (targetId: string) => {
    try {
      const svg = document.getElementById(`qr-svg-${targetId}`)?.querySelector("svg");
      if (!svg) {
        showMessage("error", "تعذر العثور على QR");
        return;
      }

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svg);
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-${targetId}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showMessage("success", "تم تحميل QR");
    } catch (error) {
      console.error("❌ downloadQrSvg error:", error);
      showMessage("error", "تعذر تحميل QR");
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
  };

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("تعذر قراءة الملف"));
      reader.readAsDataURL(file);
    });

  const buildMediaPayload = async (): Promise<WaMediaPayload | null> => {
    if (!selectedFile) return null;

    const dataUrl = await fileToDataUrl(selectedFile);

    return {
      fileName: selectedFile.name,
      mimeType: selectedFile.type || "application/octet-stream",
      dataUrl,
      caption: messageText.trim() || undefined,
    };
  };

  const printableTargets = useMemo(() => {
    return targetsRegistry.filter((item) => {
      const inviteLink = String(item.invite_link || "").trim();
      return Boolean(inviteLink) && item.is_active !== false;
    });
  }, [targetsRegistry]);

 
const printAllQRCodes = () => {
  if (printableTargets.length === 0) {
    showMessage("info", "لا توجد روابط دعوة جاهزة للطباعة");
    return;
  }

  const copiesPerPage = 12;

  const pagesHtml = printableTargets
    .map((item) => {
      const inviteLink = String(item.invite_link || "").trim();
      const safeTitle = String(item.title || "").trim();
      const safeScopeValue = String(item.scope_value || "").trim();

      const studentCount =
        item.scope_type === "section"
          ? Number(sectionStudentCounts[safeScopeValue] || 0)
          : copiesPerPage;

      const totalCopies = Math.max(studentCount, 1);
      const totalPages = Math.ceil(totalCopies / copiesPerPage);

      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(inviteLink)}`;

      return Array.from({ length: totalPages })
        .map((_, pageIndex) => {
          const start = pageIndex * copiesPerPage;
          const remaining = totalCopies - start;
          const copiesThisPage = Math.min(copiesPerPage, remaining);

          const qrCards = Array.from({ length: copiesThisPage })
            .map(
              (_, index) => `
                <div class="qr-card">
                  <div class="qr-inner">
                    <div class="qr-title">${safeTitle}</div>
                    <div class="qr-subtitle">${safeScopeValue}</div>
                    <div class="qr-image-wrap">
                      <img src="${qrUrl}" alt="QR ${index + 1}" />
                    </div>
                    <div class="qr-note">امسح الرمز للانضمام إلى قناة القسم</div>
                  </div>
                </div>
              `
            )
            .join("");

          const emptyCards = Array.from({ length: copiesPerPage - copiesThisPage })
            .map(() => `<div class="qr-card empty-card"></div>`)
            .join("");

          return `
            <section class="print-page" dir="rtl">
              <div class="page-header">
                <div class="page-title">${safeTitle}</div>
                <div class="page-subtitle">
                  القسم: ${safeScopeValue} | عدد التلاميذ: ${studentCount} | الصفحة ${pageIndex + 1} / ${totalPages}
                </div>
              </div>

              <div class="qr-grid">
                ${qrCards}
                ${emptyCards}
              </div>
            </section>
          `;
        })
        .join("");
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <title>طباعة QR للتلاميذ</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          * {
            box-sizing: border-box;
          }

          html, body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            background: white;
            color: #0f172a;
          }

          .print-page {
            width: 100%;
            min-height: 277mm;
            page-break-after: always;
            break-after: page;
            display: flex;
            flex-direction: column;
          }

          .print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }

          .page-header {
            text-align: center;
            margin-bottom: 8mm;
          }

          .page-title {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 4px;
          }

          .page-subtitle {
            font-size: 13px;
            color: #475569;
          }

          .qr-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(4, 1fr);
            gap: 0;
            width: 100%;
            flex: 1;
          }

          .qr-card {
            border: 1px dashed #64748b;
            min-height: 63mm;
            padding: 4mm;
            display: flex;
          }

          .empty-card {
            border: 1px dashed #cbd5e1;
            background: white;
          }

          .qr-inner {
            width: 100%;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 3mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
          }

          .qr-title {
            font-size: 11px;
            font-weight: 700;
            line-height: 1.4;
            margin-bottom: 2mm;
          }

          .qr-subtitle {
            font-size: 10px;
            color: #475569;
            margin-bottom: 2mm;
          }

          .qr-image-wrap {
            width: 32mm;
            height: 32mm;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 2mm;
          }

          .qr-image-wrap img {
            width: 32mm;
            height: 32mm;
            display: block;
          }

          .qr-note {
            font-size: 9px;
            color: #334155;
            line-height: 1.3;
          }

          @media print {
            html, body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
    </html>
  `;

  const existingFrame = document.getElementById("qr-print-frame");
  if (existingFrame) existingFrame.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "qr-print-frame";
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";

  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    showMessage("error", "تعذر تجهيز الطباعة");
    iframe.remove();
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  const doPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (error) {
      console.error("❌ printAllQRCodes error:", error);
      showMessage("error", "تعذر فتح الطباعة");
    } finally {
      setTimeout(() => {
        iframe.remove();
      }, 1000);
    }
  };

  iframe.onload = () => {
    setTimeout(doPrint, 400);
  };
};



  const refreshChannelsLayerOnly = async (silent = true) => {
    if (!silent) setIsRefreshingChannelsLayer(true);

    try {
      const layer = await waakuService.getChannelsLayerStatus();

      setChannelsLayerReady(!!layer.ready);
      setChannelsLayerAuthenticated(!!layer.authenticated);
      setChannelsLayerState(String(layer.waState || layer.clientState || ""));
      setChannelsLayerError(String(layer.lastError || ""));

      if (!silent && layer.ready) {
        showMessage("success", "طبقة الشانلات والجروبات جاهزة");
      }
    } catch (error: any) {
      console.error("❌ refreshChannelsLayerOnly error:", error);
      setChannelsLayerReady(false);
      setChannelsLayerAuthenticated(false);
      setChannelsLayerState("");
      setChannelsLayerError(error?.message || "فشل فحص طبقة الشانلات");
    } finally {
      if (!silent) setIsRefreshingChannelsLayer(false);
    }
  };

  const refreshSessionOnly = async (silent = true) => {
    try {
      const inst = await waakuService.getDefaultInstitution();

      if (!inst) {
        setInstitution(null);
        setSessionId(ACTIVE_SESSION_ID);
        setSessionStatus("DISCONNECTED");
        setTargetsRegistry([]);
        return;
      }

      setInstitution(inst);

      const status = await waakuService.checkStatus(inst.id);
      const resolvedSessionId = status.instanceName || inst.id || "";

      setSessionId(resolvedSessionId);
      setSessionStatus(status.status);

      const storedTargets = await waakuService.fetchTargetsRegistry(inst.id);
      setTargetsRegistry(storedTargets);

      if (!silent && status.status === "CONNECTED") {
        showMessage("success", "تم تحديث حالة واتساب الأساسي: متصل");
      }
    } catch (error) {
      console.error("❌ refreshSessionOnly error:", error);
    }
  };

 const bootstrap = async () => {
  setLoading(true);

  try {
    await dbManager.initialize();

    await Promise.all([
      refreshSessionOnly(true),
      refreshChannelsLayerOnly(true),
    ]);

  const [levels, sections, students] = await Promise.all([
  dbManager.getLevels(),
  dbManager.getSections(),
  dbManager.getStudents(),
]);

setLevelsData((levels || []) as DbLevel[]);
setSectionsData((sections || []) as DbSection[]);
setStudentsData((students || []) as DbStudent[]);

 
  } catch (error) {
    console.error(error);
    showMessage("error", "فشل تحميل البيانات");
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    const onFocus = () => {
      void refreshSessionOnly(true);
      void refreshChannelsLayerOnly(true);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshSessionOnly(true);
        void refreshChannelsLayerOnly(true);
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (
        e.key === "institutionId" ||
        e.key === "institution_settings_backup" ||
        e.key === "institutionSettings"
      ) {
        void refreshSessionOnly(true);
        void refreshChannelsLayerOnly(true);
      }
    };

    const interval = window.setInterval(() => {
      void refreshSessionOnly(true);
      void refreshChannelsLayerOnly(true);
    }, 370000);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

 

  const sections = useMemo(() => {
    const fromSectionsTable = (sectionsData || [])
      .map((item) => String(item.class_name || "").trim())
      .filter(Boolean);

    if (fromSectionsTable.length > 0) {
      return [...new Set(fromSectionsTable)].sort((a, b) => a.localeCompare(b, "ar"));
    }

    const fromStudents = (studentsData || [])
      .map((student) => String(student.sectionName || student.section || "").trim())
      .filter(Boolean);

    return [...new Set(fromStudents)].sort((a, b) => a.localeCompare(b, "ar"));
  }, [sectionsData, studentsData]);

  const levels = useMemo(() => {
    const fromLevelsTable = (levelsData || [])
      .map((item) => String(item.name || "").trim())
      .filter(Boolean);

    if (fromLevelsTable.length > 0) {
      return [...new Set(fromLevelsTable)].sort((a, b) => a.localeCompare(b, "ar"));
    }

    const fromStudents = (studentsData || [])
      .map((student) => String(student.levelName || student.level || "").trim())
      .filter(Boolean);

    return [...new Set(fromStudents)].sort((a, b) => a.localeCompare(b, "ar"));
  }, [levelsData, studentsData]);

  const customValues = useMemo(() => {
    return customValuesText
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
  }, [customValuesText]);

  const selectedScopeValues = useMemo(() => {
    if (selectionMode === "section") return selectedSections;
    if (selectionMode === "level") return selectedLevels;
    if (selectionMode === "institution") return institution?.id ? [institution.id] : ["institution"];
    return customValues;
  }, [selectionMode, selectedSections, selectedLevels, institution?.id, customValues]);

  const selectedCount = selectedScopeValues.length;

  const matchingTargets = useMemo(() => {
    const scopeType: WaScopeType =
      selectionMode === "section"
        ? "section"
        : selectionMode === "level"
        ? "level"
        : selectionMode === "institution"
        ? "institution"
        : "custom";

    return targetsRegistry.filter(
      (item) =>
        item.target_type === targetType &&
        item.scope_type === scopeType &&
        selectedScopeValues.includes(item.scope_value) &&
        item.is_active !== false
    );
  }, [targetsRegistry, selectionMode, targetType, selectedScopeValues]);

  const normalizePhoneValue = (value: unknown): string => {
    return String(value || "").trim().replace(/\s+/g, "");
  };

  const collectStudentPhones = (student: DbStudent): string[] => {
    return [
      normalizePhoneValue(student.phone),
      normalizePhoneValue(student.fatherPhone),
      normalizePhoneValue(student.motherPhone),
      normalizePhoneValue(student.guardianPhone),
      normalizePhoneValue(student.emergencyPhone),
    ].filter(Boolean);
  };

  const participantsMap = useMemo<Record<string, string[]>>(() => {

    
    const map: Record<string, string[]> = {};

    sections.forEach((sectionName) => {
      const phones = studentsData
        .filter((student) => {
          const studentSection = String(student.sectionName || student.section || "").trim();
          const status = String(student.status || "").trim();
          return studentSection === sectionName && (!status || status === "متمدرس" || status === "نشط");
        })
        .flatMap((student) => collectStudentPhones(student));

      map[sectionName] = [...new Set(phones)];
    });

    levels.forEach((levelName) => {
      const phones = studentsData
        .filter((student) => {
          const studentLevel = String(student.levelName || student.level || "").trim();
          const status = String(student.status || "").trim();
          return studentLevel === levelName && (!status || status === "متمدرس" || status === "نشط");
        })
        .flatMap((student) => collectStudentPhones(student));

      map[levelName] = [...new Set(phones)];
    });

    const institutionKey = institution?.id || "institution";
    map[institutionKey] = [...new Set(studentsData.flatMap((student) => collectStudentPhones(student)))];

    customValues.forEach((value) => {
      if (!map[value]) map[value] = [];
    });

    return map;
  }, [sections, levels, studentsData, institution?.id, customValues]);


const sectionStudentCounts = useMemo<Record<string, number>>(() => {
  const counts: Record<string, number> = {};

  sections.forEach((sectionName) => {
    const count = studentsData.filter((student) => {
      const studentSection = String(student.sectionName || student.section || "").trim();
      const status = String(student.status || "").trim();
      return studentSection === sectionName && (!status || status === "متمدرس" || status === "نشط");
    }).length;

    counts[sectionName] = count;
  });

  return counts;
}, [sections, studentsData]);



  const toggleItem = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
  };

  const getScopeType = (mode: SelectionMode): WaScopeType => {
    if (mode === "section") return "section";
    if (mode === "level") return "level";
    if (mode === "institution") return "institution";
    return "custom";
  };

  const sanitizeSectionCode = (value: string) => {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\p{L}\p{N}\-_]/gu, "");
  };

  const formatTitleParts = (parts: Array<string | null | undefined>) => {
    return parts
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" - ");
  };

  const buildTitle = (scopeValue: string, scopeType: WaScopeType, type: WaTargetType) => {
    const cleanScope = sanitizeSectionCode(scopeValue);
    const cleanBaseName =
      String(baseChannelName || "").trim() || (type === "group" ? "مجموعة التواصل" : "قناة التواصل");
    const cleanYear = String(academicYear || "").trim();

    if (scopeType === "section") {
      return formatTitleParts([cleanBaseName, cleanScope, cleanYear]);
    }

    if (scopeType === "level") {
      return formatTitleParts([cleanBaseName, cleanScope, cleanYear]);
    }

    if (scopeType === "institution") {
      const instName = sanitizeSectionCode(institution?.name || "المؤسسة");
      return formatTitleParts([cleanBaseName, instName, cleanYear]);
    }

    return formatTitleParts([cleanBaseName, cleanScope, cleanYear]);
  };

  const syncRegistry = (targets: WaTarget[]) => {
    setTargetsRegistry((prev) => {
      const merged = [...prev];
      for (const item of targets) {
        const index = merged.findIndex(
          (x) =>
            x.target_type === item.target_type &&
            x.scope_type === item.scope_type &&
            x.scope_value === item.scope_value
        );

        const previous = index >= 0 ? merged[index] : null;

        const normalizedItem: WaTarget = {
          ...(previous || {}),
          ...item,
          institution_id: institution?.id || item.institution_id || previous?.institution_id,
          invite_link:
            String(item.invite_link || "").trim() ||
            String(previous?.invite_link || "").trim() ||
            null,
        };

        if (index >= 0) merged[index] = normalizedItem;
        else merged.push(normalizedItem);
      }
      return merged;
    });
  };

  const removeFromRegistryByExactValues = (
    targetTypeArg: WaTargetType,
    scopeTypeArg: WaScopeType,
    scopeValues: string[]
  ) => {
    setTargetsRegistry((prev) =>
      prev.filter(
        (x) =>
          !(
            x.target_type === targetTypeArg &&
            x.scope_type === scopeTypeArg &&
            scopeValues.includes(x.scope_value)
          )
      )
    );
  };

  const createTargetsBatch = async (
    scopeType: WaScopeType,
    scopeValues: string[],
    type: WaTargetType
  ) => {
    if (!String(baseChannelName || "").trim()) {
      showMessage("error", "اسم القناة أو الجروب مطلوب");
      return;
    }

    if (!String(academicYear || "").trim()) {
      showMessage("error", "السنة الدراسية مطلوبة");
      return;
    }

    await refreshSessionOnly(false);
    await refreshChannelsLayerOnly(false);

    const inst = await waakuService.getDefaultInstitution();
    if (!inst) {
      showMessage("error", "لم يتم العثور على المؤسسة");
      return;
    }

    const latestStatus = await waakuService.checkStatus(inst.id);
    const latestSessionStatus = latestStatus.status;
    const latestSessionId = latestStatus.instanceName || inst.id || "";

    setSessionStatus(latestSessionStatus);
    setSessionId(latestSessionId);

    const latestChannelsLayer = await waakuService.getChannelsLayerStatus();
    setChannelsLayerReady(!!latestChannelsLayer.ready);
    setChannelsLayerAuthenticated(!!latestChannelsLayer.authenticated);
    setChannelsLayerState(
      String(latestChannelsLayer.waState || latestChannelsLayer.clientState || "")
    );
    setChannelsLayerError(String(latestChannelsLayer.lastError || ""));

    if (type === "group" && latestSessionStatus !== "CONNECTED") {
      showMessage("error", "يجب ربط واتساب الرسائل الأساسية أولًا");
      return;
    }

    if (type === "channel" && !latestChannelsLayer.ready) {
      showMessage("error", "يجب ربط واتساب طبقة الشانلات والجروبات أولًا ثم مسح QR الخاص بها");
      return;
    }

    if (!latestSessionId) {
      showMessage("error", "لا توجد session صالحة");
      return;
    }

    if (scopeValues.length === 0) {
      showMessage("info", "اختر الأقسام أو المستويات أولًا");
      return;
    }

    const confirmed = await askDoubleConfirmation(
      `تأكيد إنشاء ${type === "group" ? "الجروبات" : "الشانلات"}`,
      `سيتم إنشاء ${scopeValues.length} ${type === "group" ? "جروب" : "شانل"} حسب الاختيار الحالي.`
    );
    if (!confirmed) {
      showMessage("info", "تم إلغاء الإنشاء");
      return;
    }

    setIsManaging(true);
    try {
      const ensured = await waakuService.ensureTargets({
        sessionId: latestSessionId,
        targetType: type,
        scopeType,
        scopeValues,
        titleBuilder: (scopeValue) => buildTitle(scopeValue, scopeType, type),
        registry: targetsRegistry,
        participantsMap: type === "group" ? participantsMap : undefined,
      });

      if (!ensured.success) {
        showMessage("error", ensured.message || "فشل الإنشاء");
        return;
      }

      syncRegistry(ensured.targets);

      showMessage(
        "success",
        `تم تجهيز ${ensured.targets.length} ${type === "group" ? "جروب" : "شانل"} بنجاح`
      );
    } catch (error: any) {
      console.error(error);
      showMessage("error", error?.message || "فشل الإنشاء");
    } finally {
      setIsManaging(false);
    }
  };

  const deleteTargetsBatch = async (
    scopeType: WaScopeType,
    scopeValues: string[],
    type: WaTargetType
  ) => {
    await refreshSessionOnly(false);
    await refreshChannelsLayerOnly(false);

    const inst = await waakuService.getDefaultInstitution();
    if (!inst) {
      showMessage("error", "لم يتم العثور على المؤسسة");
      return;
    }

    const latestStatus = await waakuService.checkStatus(inst.id);
    const latestSessionStatus = latestStatus.status;
    const latestSessionId = latestStatus.instanceName || inst.id || "";

    setSessionStatus(latestSessionStatus);
    setSessionId(latestSessionId);

    const latestChannelsLayer = await waakuService.getChannelsLayerStatus();
    setChannelsLayerReady(!!latestChannelsLayer.ready);
    setChannelsLayerAuthenticated(!!latestChannelsLayer.authenticated);
    setChannelsLayerState(
      String(latestChannelsLayer.waState || latestChannelsLayer.clientState || "")
    );
    setChannelsLayerError(String(latestChannelsLayer.lastError || ""));

    if (type === "group" && latestSessionStatus !== "CONNECTED") {
      showMessage("error", "يجب ربط واتساب الرسائل الأساسية أولًا");
      return;
    }

    if (type === "channel" && !latestChannelsLayer.ready) {
      showMessage("error", "طبقة الشانلات والجروبات غير جاهزة");
      return;
    }

    if (!latestSessionId) {
      showMessage("error", "لا توجد session صالحة");
      return;
    }

    if (scopeValues.length === 0) {
      showMessage("info", "اختر الأقسام أو المستويات أولًا");
      return;
    }

    const targetsToDelete = targetsRegistry.filter(
      (x) =>
        x.target_type === type &&
        x.scope_type === scopeType &&
        scopeValues.includes(x.scope_value)
    );

    if (targetsToDelete.length === 0) {
      showMessage("info", "لا توجد targets مطابقة للحذف");
      return;
    }

    setIsManaging(true);
    try {
      let failed = 0;

      for (const target of targetsToDelete) {
        const res =
          type === "group"
            ? await waakuService.deleteGroup(latestSessionId, target.target_id)
            : await waakuService.deleteChannel(latestSessionId, target.target_id);

        if (!res.success) failed += 1;
      }

      if (failed > 0) {
        showMessage("error", `فشل حذف ${failed} عنصر`);
      } else {
        removeFromRegistryByExactValues(type, scopeType, scopeValues);
        showMessage("success", "تم الحذف بنجاح");
      }
    } catch (error: any) {
      console.error(error);
      showMessage("error", error?.message || "فشل الحذف");
    } finally {
      setIsManaging(false);
    }
  };

  const validateSend = async () => {
    await refreshSessionOnly(false);
    await refreshChannelsLayerOnly(false);

    const inst = await waakuService.getDefaultInstitution();
    if (!inst) {
      showMessage("error", "لم يتم العثور على المؤسسة");
      return false;
    }

    const latestStatus = await waakuService.checkStatus(inst.id);
    const latestSessionStatus = latestStatus.status;
    const latestSessionId = latestStatus.instanceName || inst.id || "";

    setSessionStatus(latestSessionStatus);
    setSessionId(latestSessionId);

    const latestChannelsLayer = await waakuService.getChannelsLayerStatus();
    setChannelsLayerReady(!!latestChannelsLayer.ready);
    setChannelsLayerAuthenticated(!!latestChannelsLayer.authenticated);
    setChannelsLayerState(
      String(latestChannelsLayer.waState || latestChannelsLayer.clientState || "")
    );
    setChannelsLayerError(String(latestChannelsLayer.lastError || ""));

    if (targetType === "group" && latestSessionStatus !== "CONNECTED") {
      showMessage("error", "يجب ربط واتساب الرسائل الأساسية أولًا");
      return false;
    }

    if (targetType === "channel" && !latestChannelsLayer.ready) {
      showMessage("error", "يجب ربط واتساب طبقة الشانلات والجروبات أولًا");
      return false;
    }

    if (!latestSessionId) {
      showMessage("error", "لا توجد session صالحة");
      return false;
    }

    if (!messageText.trim() && !selectedFile) {
      showMessage("error", "اكتب الرسالة أو اختر ملفًا للإرسال");
      return false;
    }

    if (!String(baseChannelName || "").trim()) {
      showMessage("error", "اسم القناة أو الجروب مطلوب");
      return false;
    }

    if (!String(academicYear || "").trim()) {
      showMessage("error", "السنة الدراسية مطلوبة");
      return false;
    }

    if (sendMode === "collective" && selectedCount === 0) {
      showMessage("error", "اختر قسمًا أو مستوى أو قيمة مخصصة");
      return false;
    }

    return true;
  };

  const handleSend = async () => {
    if (!(await validateSend())) return;

    setUiMessage(null);
    setResults([]);

    if (sendMode === "individual") {
      showMessage("info", "أبقِ الإرسال الفردي في المسار القديم الحالي");
      return;
    }

    const existingTargets = matchingTargets.filter((item) => item.is_active !== false);

    if (existingTargets.length === 0) {
      showMessage("info", "لا توجد شانلات أو جروبات مربوطة مسبقًا بهذا الاختيار");
      return;
    }

    const confirmedSend = await askDoubleConfirmation(
      `تأكيد إرسال الرسالة إلى ${targetType === "group" ? "الجروبات" : "الشانلات"}`,
      `سيتم إرسال الرسالة إلى ${existingTargets.length} ${targetType === "group" ? "هدف جماعي" : "شانل"} موجودة مسبقًا حسب الاختيار الحالي.`
    );
    if (!confirmedSend) {
      showMessage("info", "تم إلغاء الإرسال");
      return;
    }

    try {
      setIsSending(true);

      const inst = await waakuService.getDefaultInstitution();
      if (!inst) {
        showMessage("error", "لم يتم العثور على المؤسسة");
        return;
      }

      const latestStatus = await waakuService.checkStatus(inst.id);
      const latestSessionId = latestStatus.instanceName || inst.id || "";

      setSessionId(latestSessionId);

      const mediaPayload = await buildMediaPayload();

      const sendRes = await waakuService.sendToResolvedTargets(
        latestSessionId,
        existingTargets,
        {
          message: messageText.trim(),
          media: mediaPayload,
        }
      );

      setResults(
        sendRes.results.map((item) => ({
          title: item.target.title,
          targetId: item.target.target_id,
          success: item.success,
          message: item.message,
        }))
      );

      if (sendRes.failedCount > 0) {
        showMessage("info", `تم الإرسال إلى ${sendRes.sentCount} وفشل ${sendRes.failedCount}`);
      } else {
        showMessage("success", `تم الإرسال بنجاح إلى ${sendRes.sentCount}`);
        if (selectedFile) clearSelectedFile();
      }
    } catch (error: any) {
      console.error(error);
      showMessage("error", error?.message || "فشل التنفيذ");
    } finally {
      setIsPreparing(false);
      setIsSending(false);
    }
  };

  const statCard = (title: string, value: number, color: string) => (
    <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-4">
      <div className="text-xs text-slate-500 mb-1">{title}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );

  const actionButtonClass =
    "rounded-xl px-4 py-3 text-sm font-semibold transition border shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="rounded-3xl bg-gradient-to-l from-emerald-500 via-cyan-500 to-indigo-600 text-white shadow-xl">
          <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium mb-3">
                <ShieldCheck className="w-4 h-4" />
                إدارة الجروبات والشانلات
              </div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">التواصل عبر الواتساب</h1>
              <p className="text-white/90 text-sm md:text-base">
                إنشاء الجروبات والشانلات حسب الأقسام والمستويات الموجودة فعليًا في بيانات المؤسسة
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 min-w-[280px]">
              <div className="rounded-xl bg-white/15 p-3 border border-white/20">
                <div className="text-white/80 text-xs mb-1">واتساب الرسائل</div>
                <div className="font-semibold text-sm">
                  {sessionStatus === "CONNECTED"
                    ? "متصل"
                    : sessionStatus === "SCANNING"
                    ? "بانتظار QR"
                    : "غير متصل"}
                </div>
              </div>

              <div className="rounded-xl bg-white/15 p-3 border border-white/20">
                <div className="text-white/80 text-xs mb-1">طبقة الشانلات/الجروبات</div>
                <div className="font-semibold text-sm flex items-center gap-2">
                  {channelsLayerReady ? (
                    <>
                      <Wifi className="w-4 h-4" />
                      جاهزة
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-4 h-4" />
                      غير جاهزة
                    </>
                  )}
                </div>
                <div className="text-[11px] text-white/80 mt-1">
                  {channelsLayerState || (channelsLayerAuthenticated ? "authenticated" : "booting")}
                </div>
              </div>

              <div className="rounded-xl bg-white/15 p-3 border border-white/20">
                <div className="text-white/80 text-xs mb-1">Session</div>
                <div className="font-semibold text-xs break-all">{sessionId}</div>
              </div>
            </div>
          </div>
        </div>

        {uiMessage && (
          <div
            className={`rounded-xl p-4 flex items-center gap-3 border ${
              uiMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : uiMessage.type === "error"
                ? "bg-red-50 text-red-800 border-red-200"
                : "bg-blue-50 text-blue-800 border-blue-200"
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{uiMessage.text}</span>
          </div>
        )}

        {channelsLayerError && (
          <div className="rounded-xl p-4 flex items-center gap-3 border bg-amber-50 text-amber-800 border-amber-200">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">
              تنبيه طبقة الشانلات والجروبات: {channelsLayerError}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          {statCard("عدد targets", targetsRegistry.length, "text-blue-600")}
          {statCard("المختار", selectedCount, "text-emerald-600")}
          {statCard("الموجود", matchingTargets.length, "text-violet-600")}
          {statCard("الطلاب", studentsData.length, "text-amber-600")}
          {statCard("الأقسام", sections.length, "text-cyan-600")}
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => void refreshSessionOnly(false)}
            className={`${actionButtonClass} bg-emerald-600 text-white border-emerald-600`}
          >
            تحديث واتساب الرسائل
          </button>

          <button
            onClick={() => void refreshChannelsLayerOnly(false)}
            disabled={isRefreshingChannelsLayer}
            className={`${actionButtonClass} bg-indigo-600 text-white border-indigo-600`}
          >
            {isRefreshingChannelsLayer ? "جارٍ التحقق..." : "تحديث طبقة الشانلات والجروبات"}
          </button>

          {!channelsLayerReady && (
            <div className="text-sm text-slate-600">
              يجب مسح QR الخاص بطبقة الشانلات والجروبات قبل إنشاء الشانلات.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 space-y-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-800">إدارة الجروبات والشانلات</h2>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                <div className="text-sm font-semibold text-slate-700 mb-3">إعداد تسمية القنوات والجروبات</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">اسم القناة أو الجروب</label>
                    <input
                      value={baseChannelName}
                      onChange={(e) => setBaseChannelName(e.target.value)}
                      className="w-full border border-slate-200 rounded-2xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="مثال: قناة التواصل"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">السنة الدراسية</label>
                    <input
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      className="w-full border border-slate-200 rounded-2xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="مثال: 2026"
                    />
                  </div>
                </div>
                <div className="text-xs text-slate-500 mt-3">
                  مثال الاسم النهائي: <strong>{buildTitle("2APIC-1", "section", "channel")}</strong>
                </div>
                <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                  الشانلات والجروبات أصبحت مرتبطة بالمؤسسة نفسها، وليس بالجلسة الحالية. تغيير الجلسة أو الحاسوب لا يجب أن يفرض إعادة إنشاء الأقسام.
                </div>
                <div className="mt-3 rounded-xl bg-indigo-50 border border-indigo-200 p-3 text-xs text-indigo-800">
                  QR الخاص بكل قسم ثابت ما دام رابط الدعوة invite_link محفوظًا ولم يتم حذف الشانل نفسها.
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-700 mb-3">اختر وضع الإدارة</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button className={`rounded-xl py-3 text-sm font-semibold ${selectionMode === "section" ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-700"}`} onClick={() => setSelectionMode("section")}>حسب القسم</button>
                  <button className={`rounded-xl py-3 text-sm font-semibold ${selectionMode === "level" ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-700"}`} onClick={() => setSelectionMode("level")}>حسب المستوى</button>
                  <button className={`rounded-xl py-3 text-sm font-semibold ${selectionMode === "institution" ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-700"}`} onClick={() => setSelectionMode("institution")}>المؤسسة كلها</button>
                  <button className={`rounded-xl py-3 text-sm font-semibold ${selectionMode === "custom" ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-700"}`} onClick={() => setSelectionMode("custom")}>مخصص</button>
                </div>
              </div>

              {selectionMode === "section" && (
                <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <h3 className="text-base font-bold text-slate-800">اختر الأقسام الموجودة فعليًا</h3>
                  </div>

                  <div className="max-h-[260px] overflow-y-auto rounded-2xl border border-slate-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 bg-white">
                    {sections.map((section) => (
                      <button
                        key={section}
                        className={`rounded-xl py-2.5 px-2 text-sm font-semibold transition ${
                          selectedSections.includes(section)
                            ? "bg-blue-600 text-white shadow"
                            : "bg-slate-50 text-slate-700 border border-slate-200"
                        }`}
                        onClick={() => toggleItem(section, setSelectedSections)}
                      >
                        {section}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                  
                    <button disabled={isManaging} onClick={() => void createTargetsBatch("section", selectedSections, "channel")} className={`${actionButtonClass} bg-violet-600 text-white border-violet-600`}>إنشاء channels الأقسام المختارة</button>
                  
                    <button disabled={isManaging} onClick={() => void deleteTargetsBatch("section", selectedSections, "channel")} className={`${actionButtonClass} bg-rose-600 text-white border-rose-600`}>حذف channels الأقسام المختارة</button>
                  </div>
                </div>
              )}

              {selectionMode === "level" && (
                <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                  <div className="flex items-center gap-2 mb-4">
                    <GraduationCap className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-base font-bold text-slate-800">اختر المستويات</h3>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {levels.map((level) => (
                      <button
                        key={level}
                        className={`rounded-xl py-2.5 px-2 text-sm font-semibold transition ${
                          selectedLevels.includes(level)
                            ? "bg-emerald-600 text-white shadow"
                            : "bg-white text-slate-700 border border-slate-200"
                        }`}
                        onClick={() => toggleItem(level, setSelectedLevels)}
                      >
                        {level}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                     <button disabled={isManaging} onClick={() => void createTargetsBatch("level", selectedLevels, "channel")} className={`${actionButtonClass} bg-cyan-600 text-white border-cyan-600`}>إنشاء شانلات المستويات المختارة</button>
                     <button disabled={isManaging} onClick={() => void deleteTargetsBatch("level", selectedLevels, "channel")} className={`${actionButtonClass} bg-rose-600 text-white border-rose-600`}>حذف شانلات المستويات المختارة</button>
                  </div>
                </div>
              )}

              {selectionMode === "institution" && (
                <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                  <div className="text-base font-bold text-slate-800 mb-4">المؤسسة كلها</div>

                  <div className="grid grid-cols-2 gap-3">
                    <button disabled={isManaging} onClick={() => void createTargetsBatch("institution", institution?.id ? [institution.id] : [], "channel")} className={`${actionButtonClass} bg-violet-600 text-white border-violet-600`}>إنشاء شانل المؤسسة</button>
                     <button disabled={isManaging} onClick={() => void deleteTargetsBatch("institution", institution?.id ? [institution.id] : [], "channel")} className={`${actionButtonClass} bg-rose-600 text-white border-rose-600`}>حذف شانل المؤسسة</button>
                  </div>
                </div>
              )}

              {selectionMode === "custom" && (
                <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                  <div className="text-sm font-semibold text-slate-700 mb-3">القيم المخصصة - كل قيمة في سطر</div>
                  <textarea
                    value={customValuesText}
                    onChange={(e) => setCustomValuesText(e.target.value)}
                    className="w-full border border-slate-200 rounded-2xl p-4 min-h-[120px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder={`2APIC-1\n1ASC-2`}
                  />

                  <div className="grid grid-cols-2 gap-3 mt-4">
                     <button disabled={isManaging} onClick={() => void createTargetsBatch("custom", customValues, "channel")} className={`${actionButtonClass} bg-violet-600 text-white border-violet-600`}>إنشاء شانلات مخصصة</button>
                     <button disabled={isManaging} onClick={() => void deleteTargetsBatch("custom", customValues, "channel")} className={`${actionButtonClass} bg-rose-600 text-white border-rose-600`}>حذف شانلات مخصصة</button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 space-y-5">
              <div className="flex items-center gap-3">
                <Send className="w-5 h-5 text-cyan-600" />
                <h2 className="text-lg font-bold text-slate-800">إرسال الرسائل</h2>
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-700 mb-3">نوع الإرسال</div>
                <div className="grid grid-cols-2 gap-3">
                   <button className={`rounded-xl py-3 text-base font-semibold transition ${sendMode === "collective" ? "bg-gradient-to-l from-violet-600 to-fuchsia-600 text-white shadow" : "bg-slate-100 text-slate-700"}`} onClick={() => setSendMode("collective")}>جروب / شانل</button>
                </div>
              </div>

              {sendMode === "collective" && (
                <>
                  <div>
                    <div className="text-sm font-semibold text-slate-700 mb-3">نوع الهدف</div>
                    <div className="text-xs text-slate-500 mb-3">الافتراضي الآن هو الشانل.</div>
                    <div className="grid grid-cols-2 gap-3">
                      </div>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-slate-700 mb-3">طريقة الاختيار</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <button className={`rounded-xl py-3 text-sm font-semibold ${selectionMode === "section" ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-700"}`} onClick={() => setSelectionMode("section")}>حسب القسم</button>
                      <button className={`rounded-xl py-3 text-sm font-semibold ${selectionMode === "level" ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-700"}`} onClick={() => setSelectionMode("level")}>حسب المستوى</button>
                      <button className={`rounded-xl py-3 text-sm font-semibold ${selectionMode === "institution" ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-700"}`} onClick={() => setSelectionMode("institution")}>الكل</button>
                      <button className={`rounded-xl py-3 text-sm font-semibold ${selectionMode === "custom" ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-700"}`} onClick={() => setSelectionMode("custom")}>مخصص</button>
                    </div>
                  </div>
                </>
              )}

              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">نص الرسالة</h3>
                    <div className="text-slate-500 text-sm mt-1">نص الإعلان</div>
                  </div>

                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={isOfficialAnnouncement} onChange={(e) => setIsOfficialAnnouncement(e.target.checked)} />
                    وضع إعلان رسمي
                  </label>
                </div>

                {sendMode === "collective" && (
                  <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
                    الإرسال هنا يتم فقط إلى الشانلات أو الجروبات الموجودة مسبقًا، ولن يتم إنشاء أي هدف جديد تلقائيًا.
                  </div>
                )}

                <div className="mb-4 rounded-xl bg-white border border-slate-200 p-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    إرفاق صورة أو ملف تمرين
                  </label>
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-700"
                  />
                  {selectedFile && (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                      <div className="text-xs text-slate-700 break-all">
                        الملف المختار: <strong>{selectedFile.name}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={clearSelectedFile}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-red-600 text-white"
                      >
                        حذف الملف
                      </button>
                    </div>
                  )}
                  <div className="mt-2 text-xs text-slate-500">
                    يمكن إرسال نص فقط، أو ملف فقط، أو ملف مع تعليق.
                  </div>
                </div>

                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="w-full border border-amber-300 rounded-2xl p-4 min-h-[160px] text-base bg-white focus:outline-none focus:ring-4 focus:ring-amber-100"
                  placeholder="اكتب الرسالة هنا أو أرفق ملفًا مع تعليق"
                />

                <button
                  onClick={() => void handleSend()}
                  disabled={isPreparing || isSending || (sendMode === "collective" && matchingTargets.length === 0)}
                  className="mt-5 w-full rounded-2xl bg-gradient-to-l from-emerald-400 to-cyan-400 text-white py-4 text-lg font-bold disabled:opacity-60 flex items-center justify-center gap-3 shadow"
                >
                  {isPreparing || isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  {isPreparing
                    ? "جاري إنشاء الجروبات / الشانلات..."
                    : isSending
                    ? "جاري الإرسال..."
                    : `إرسال الرسالة (${matchingTargets.length})`}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Layers3 className="w-4 h-4 text-violet-600" />
                <h3 className="text-base font-bold text-slate-800">ملخص</h3>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                  <span className="text-slate-500 text-sm">نوع الهدف</span>
                  <span className="font-bold text-slate-800 text-sm">{targetType === "group" ? "جروب" : "شانل"}</span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                  <span className="text-slate-500 text-sm">وضع الاختيار</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {selectionMode === "section"
                      ? "حسب القسم"
                      : selectionMode === "level"
                      ? "حسب المستوى"
                      : selectionMode === "institution"
                      ? "الكل"
                      : "مخصص"}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                  <span className="text-slate-500 text-sm">المختار</span>
                  <span className="font-bold text-blue-600 text-xl">{selectedCount}</span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                  <span className="text-slate-500 text-sm">مطابق حاليًا</span>
                  <span className="font-bold text-emerald-600 text-xl">{matchingTargets.length}</span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                  <span className="text-slate-500 text-sm">سيُنشأ الآن</span>
                  <span className="font-bold text-amber-600 text-xl">{Math.max(selectedCount - matchingTargets.length, 0)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <h3 className="text-base font-bold text-slate-800">Targets الحالية</h3>
                </div>

                <button
  onClick={printAllQRCodes}
  disabled={printableTargets.length === 0}
  className={`${actionButtonClass} bg-slate-900 text-white border-slate-900`}
>
  طباعة QR حسب عدد التلاميذ
</button>
              </div>

              {targetsRegistry.length === 0 ? (
                <div className="text-slate-500 text-sm">لا توجد targets بعد</div>
              ) : (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {targetsRegistry.map((item, index) => {
                    const inviteLink = String(item.invite_link || "").trim();
                    const hasInviteLink = Boolean(inviteLink);

                    return (
                      <div key={`${item.target_type}-${item.scope_type}-${item.scope_value}-${index}`} className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                        <div className="font-bold text-slate-800 text-sm">{item.title}</div>
                        <div className="text-xs text-slate-500 mt-1">{item.target_type} / {item.scope_type}</div>
                        <div className="text-xs text-slate-500">{item.scope_value}</div>
                        <div className="text-[11px] text-slate-400 break-all mt-2">{item.target_id}</div>

                        {hasInviteLink ? (
                          <div className="mt-4 space-y-3">
                            <div className="rounded-xl bg-white border border-slate-200 p-3">
                              <div className="text-xs font-semibold text-slate-700 mb-2">رابط الولوج</div>
                              <div className="text-[11px] text-blue-700 break-all leading-6">{inviteLink}</div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <button onClick={() => void copyToClipboard(inviteLink)} className="rounded-xl px-3 py-2 text-xs font-semibold bg-blue-600 text-white">نسخ الرابط</button>
                              <button onClick={() => openInviteLink(inviteLink)} className="rounded-xl px-3 py-2 text-xs font-semibold bg-emerald-600 text-white">فتح الرابط</button>
                              <button onClick={() => downloadQrSvg(item.target_id)} className="rounded-xl px-3 py-2 text-xs font-semibold bg-violet-600 text-white">تحميل QR</button>
                            </div>

                            <div className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col items-center">
                              <div className="text-xs font-semibold text-slate-700 mb-3">QR الثابت للقسم</div>
                              <div id={`qr-svg-${item.target_id}`} className="bg-white p-2 rounded-xl">
                                <QRCode value={inviteLink} size={148} level="M" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                            لا يوجد رابط دعوة محفوظ لهذا الهدف حاليًا.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-800">نتائج الإرسال</h3>
              </div>

              {results.length === 0 ? (
                <div className="text-slate-500 text-sm">لا توجد نتائج بعد</div>
              ) : (
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {results.map((item, index) => (
                    <div key={`${item.targetId}-${index}`} className={`rounded-xl p-3 border ${item.success ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                      <div className="font-bold text-sm">{item.title}</div>
                      <div className="text-[11px] break-all mt-1">{item.targetId}</div>
                      <div className="text-xs mt-2">{item.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppCommunication;
