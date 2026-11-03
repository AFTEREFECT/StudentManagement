 import React, { useEffect, useMemo, useState } from "react";
import { dbManager } from "../utils/database";
import { syncPhoneUpdates } from "../utils/phoneSync";
import { generateActivationCodes } from "../utils/activationCodes";
import { QRCodeSVG } from "qrcode.react";
 
import VoucherPrintSheet from "./VoucherPrintSheet";
const PhoneManagement = ({ setActiveTab }: { setActiveTab?: (tab: string) => void }) => {
  const [students, setStudents] = useState<any[]>([]);
  const [editedPhones, setEditedPhones] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("جاري المعالجة...");

  const [selectedSection, setSelectedSection] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [search, setSearch] = useState("");

  const loadStudents = async () => {
    await dbManager.initialize();
    const data = await dbManager.getStudents();
    const normalized = Array.isArray(data) ? data : [];
    setStudents(normalized);

    const phonesMap: Record<string, string> = {};
    normalized.forEach((s: any) => {
      phonesMap[String(s.id)] = s.phone || "";
    });
    setEditedPhones(phonesMap);
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const handleSync = async () => {
    try {
      setLoadingText("جاري مزامنة أرقام الهواتف...");
      setLoading(true);
      await syncPhoneUpdates();
      await loadStudents();
    } catch (error) {
      console.error("خطأ في مزامنة أرقام الهواتف:", error);
      alert("حدث خطأ أثناء مزامنة أرقام الهواتف");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setLoadingText("جاري إعداد الأكواد...");
      setLoading(true);
      await generateActivationCodes();
      await loadStudents();
    } catch (error) {
      console.error("خطأ في توليد الأكواد:", error);
      alert("حدث خطأ أثناء توليد أكواد التفعيل");
    } finally {
      setLoading(false);
    }
  };

  const normalizeGender = (value: any) => {
    const g = String(value || "").trim().toLowerCase();

    if (g === "ذكر" || g === "male" || g === "m") return "male";
    if (g === "أنثى" || g === "انثى" || g === "female" || g === "f") return "female";

    return "";
  };

  const sortSectionNames = (sections: string[]) => {
    const parseSection = (value: string) => {
      const text = String(value || "").trim().toUpperCase().replace(/\s+/g, "");

      // أمثلة مدعومة:
      // 1APIC-1
      // 1APIC 1
      // 1APIC1
      // 2APIC-3
      const match = text.match(/^(\d+)\s*APIC[\- ]?(\d+)$/i) || text.match(/^(\d+)APIC(\d+)$/i);

      if (match) {
        return {
          original: value,
          levelNum: Number(match[1]),
          sectionNum: Number(match[2]),
          isParsed: true,
        };
      }

      return {
        original: value,
        levelNum: Number.MAX_SAFE_INTEGER,
        sectionNum: Number.MAX_SAFE_INTEGER,
        isParsed: false,
      };
    };

    return [...sections].sort((a, b) => {
      const pa = parseSection(a);
      const pb = parseSection(b);

      if (pa.isParsed && pb.isParsed) {
        if (pa.levelNum !== pb.levelNum) {
          return pa.levelNum - pb.levelNum;
        }
        return pa.sectionNum - pb.sectionNum;
      }

      if (pa.isParsed && !pb.isParsed) return -1;
      if (!pa.isParsed && pb.isParsed) return 1;

      return String(a).localeCompare(String(b), "ar");
    });
  };

  const sortLevelNames = (levels: string[]) => {
    const parseLevel = (value: string) => {
      const text = String(value || "").trim().toUpperCase().replace(/\s+/g, "");

      // أمثلة:
      // 1APIC
      // 2APIC
      // 3APIC
      const match = text.match(/^(\d+)APIC$/i);

      if (match) {
        return {
          original: value,
          levelNum: Number(match[1]),
          isParsed: true,
        };
      }

      return {
        original: value,
        levelNum: Number.MAX_SAFE_INTEGER,
        isParsed: false,
      };
    };

    return [...levels].sort((a, b) => {
      const pa = parseLevel(a);
      const pb = parseLevel(b);

      if (pa.isParsed && pb.isParsed) {
        return pa.levelNum - pb.levelNum;
      }

      if (pa.isParsed && !pb.isParsed) return -1;
      if (!pa.isParsed && pb.isParsed) return 1;

      return String(a).localeCompare(String(b), "ar");
    });
  };

  const sectionOptions = useMemo(() => {
    const uniqueSections = Array.from(
      new Set(
        students
          .map((s) => s.sectionName || s.section || "")
          .filter((v) => String(v).trim() !== "")
      )
    );

    return sortSectionNames(uniqueSections);
  }, [students]);

  const levelOptions = useMemo(() => {
    const uniqueLevels = Array.from(
      new Set(
        students
          .map((s) => s.levelName || s.level || "")
          .filter((v) => String(v).trim() !== "")
      )
    );

    return sortLevelNames(uniqueLevels);
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const section = s.sectionName || s.section || "";
      const level = s.levelName || s.level || "";
      const name = `${s.firstName || ""} ${s.lastName || ""}`.trim();
      const massar = String(s.nationalId || "").trim();

      const matchesSection = selectedSection ? section === selectedSection : true;
      const matchesLevel = selectedLevel ? level === selectedLevel : true;

      const searchValue = search.trim().toLowerCase();
      const matchesSearch = searchValue
        ? name.toLowerCase().includes(searchValue) || massar.toLowerCase().includes(searchValue)
        : true;

      return matchesSection && matchesLevel && matchesSearch;
    });
  }, [students, selectedSection, selectedLevel, search]);

  const stats = useMemo(() => {
    let male = 0;
    let female = 0;

    filteredStudents.forEach((s) => {
      const gender = normalizeGender(s.gender);
      if (gender === "male") male++;
      if (gender === "female") female++;
    });

    return {
      male,
      female,
      total: filteredStudents.length,
    };
  }, [filteredStudents]);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      for (const s of students) {
        const id = String(s.id);
        const newPhone = (editedPhones[id] || "").trim();

        if (newPhone !== (s.phone || "")) {
          await dbManager.updateStudent(s.id, { phone: newPhone });
        }
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [editedPhones, students]);

  return (
  <>
    <div className="p-6 no-print" dir="rtl">
      {loading && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl flex flex-col items-center gap-4 shadow-xl">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p>{loadingText}</p>
          </div>
        </div>
      )}

      <h1 className="text-3xl font-bold mb-6">إدارة أرقام الهواتف</h1>

      <div className="mb-6">
        <input
          type="text"
          placeholder="🔍 ابحث باسم التلميذ أو رمز مسار..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border rounded-xl px-4 py-3 text-lg shadow-sm"
        />
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={handleSync} className="bg-green-600 text-white px-4 py-2 rounded-lg">
          مزامنة أرقام الهواتف
        </button>

        <button onClick={handleGenerate} className="bg-blue-600 text-white px-4 py-2 rounded-lg">
          توليد أكواد التفعيل
        </button>

        <button
          onClick={() => setActiveTab?.("phone-import")}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg"
        >
          استيراد من Excel
        </button>

        <button
          onClick={() => window.print()}
          className="bg-orange-600 text-white px-4 py-2 rounded-lg"
        >
          طباعة الفوتشرات
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border p-5">
          <div className="text-sm text-gray-500 mb-1">عدد الذكور</div>
          <div className="text-3xl font-bold text-blue-600">{stats.male}</div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-5">
          <div className="text-sm text-gray-500 mb-1">عدد الإناث</div>
          <div className="text-3xl font-bold text-pink-600">{stats.female}</div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-5">
          <div className="text-sm text-gray-500 mb-1">المجموع</div>
          <div className="text-3xl font-bold text-gray-800">{stats.total}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">فلترة حسب القسم</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full border rounded-lg p-2"
            >
              <option value="">جميع الأقسام</option>
              {sectionOptions.map((section) => (
                <option key={section} value={section}>
                  {section}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">فلترة حسب المستوى</label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full border rounded-lg p-2"
            >
              <option value="">جميع المستويات</option>
              {levelOptions.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow overflow-x-auto border">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3 text-right">اسم التلميذ</th>
              <th className="p-3 text-right">القسم</th>
              <th className="p-3 text-right">رمز مسار</th>
              <th className="p-3 text-right">الهاتف</th>
              <th className="p-3 text-right">QR</th>
              <th className="p-3 text-right">الرابط</th>
            </tr>
          </thead>

          <tbody>
            {filteredStudents.map((s, index) => {
              const voucher = s.voucher || "";
              const activationUrl = voucher
                ? `https://activationphone.progtalamid.com/?v=${voucher}&id=${s.nationalId || ""}`
                : "";

              const rowId = String(s.id);

              return (
                <tr key={s.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-bold text-gray-600">{index + 1}</td>

                  <td className="p-3">
                    {s.firstName} {s.lastName}
                  </td>

                  <td className="p-3">{s.sectionName || s.section || "-"}</td>

                  <td className="p-3">{s.nationalId}</td>

                  <td className="p-3 min-w-[250px]">
                    <input
                      type="text"
                      value={editedPhones[rowId] ?? ""}
                      onChange={(e) =>
                        setEditedPhones((prev) => ({
                          ...prev,
                          [rowId]: e.target.value,
                        }))
                      }
                      className="border rounded-lg px-3 py-2 w-full"
                    />
                  </td>

                  <td className="p-3">
                    {voucher && <QRCodeSVG value={activationUrl} size={70} />}
                  </td>

                  <td className="p-3">
                    {voucher && (
                      <a href={activationUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                        فتح الرابط
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

 <div id="print-area" className="print-only" dir="rtl">
  <VoucherPrintSheet students={filteredStudents} />
</div>


  </>
);
};

export default PhoneManagement;