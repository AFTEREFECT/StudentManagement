import React, { useMemo, useRef, useState } from "react";
import {
  importParentsFromMultipleExcels,
  MultiFileImportResult
} from "../utils/importParents";

const StatCard = ({
  title,
  value,
  color = "text-gray-800",
}: {
  title: string;
  value: number;
  color?: string;
}) => (
  <div className="bg-white border rounded-2xl p-4 shadow-sm">
    <div className="text-sm text-gray-500 mb-1">{title}</div>
    <div className={`text-3xl font-bold ${color}`}>{value}</div>
  </div>
);

const PhoneImportPage = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MultiFileImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const topRows = useMemo(() => {
    if (!result?.results?.length) return [];

    const combined: any[] = [];
    for (const fileResult of result.results) {
      for (const row of fileResult.result.details.slice(0, 30)) {
        combined.push({
          ...row,
          fileName: fileResult.fileName
        });
      }
    }

    return combined.slice(0, 150);
  }, [result]);

  const handleImport = async (selectedFiles?: File[]) => {
    const targetFiles = selectedFiles || files;

    if (!targetFiles || targetFiles.length === 0) {
      alert("يرجى اختيار ملف أو أكثر");
      return;
    }

    try {
      setLoading(true);
      setResult(null);

      const importResult = await importParentsFromMultipleExcels(targetFiles);
      setResult(importResult);
    } catch (error: any) {
      console.error("خطأ أثناء الاستيراد:", error);
      alert(error?.message || "حدث خطأ أثناء استيراد أرقام الهواتف");
    } finally {
      setLoading(false);
    }
  };

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files || []).filter((f) =>
      /\.xlsx$|\.xls$/i.test(f.name)
    );

    if (!droppedFiles.length) return;

    setFiles(droppedFiles);
    await handleImport(droppedFiles);
  };

  return (
    <div className="p-6" dir="rtl">
      {loading && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl flex flex-col items-center gap-4 shadow-xl min-w-[320px]">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-lg font-semibold">
              جاري استيراد أرقام الهواتف من ملفات Excel...
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 mb-6">
        <h1 className="text-3xl font-bold">استيراد أرقام الهواتف</h1>
        <p className="text-gray-600">
          يدعم الآن استيراد <span className="font-bold">عدة ملفات Excel دفعة واحدة</span> من
          الورقة <span className="font-bold">Tuteur</span> بالاعتماد على رقم مسار كمفتاح للتحديث.
        </p>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-5 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(false);
            }}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition ${
              dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50"
            }`}
          >
            <div className="text-lg font-semibold mb-2">اسحب ملفات Excel هنا</div>
            <div className="text-sm text-gray-500 mb-4">أو اختر ملفًا واحدًا أو عدة ملفات</div>

            <button
              onClick={() => inputRef.current?.click()}
              className="bg-blue-600 text-white px-5 py-3 rounded-xl"
            >
              اختيار ملفات Excel
            </button>

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              multiple
              className="hidden"
              onChange={(e) => {
                const selected = Array.from(e.target.files || []);
                setFiles(selected);
              }}
            />

            {files.length > 0 && (
              <div className="mt-4 text-sm text-gray-700 text-right">
                <div className="font-semibold mb-2">الملفات المختارة: {files.length}</div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {files.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="truncate">
                      • {file.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50 rounded-2xl p-5 border">
            <div className="font-bold text-lg mb-4">إعدادات الاستيراد المعتمدة</div>

            <div className="space-y-2 text-sm">
              <div><span className="font-semibold">الورقة:</span> Tuteur</div>
              <div><span className="font-semibold">أول سطر للبيانات:</span> 10</div>
              <div><span className="font-semibold">رقم مسار:</span> العمود C</div>
              <div><span className="font-semibold">هاتف الأب:</span> العمود U</div>
              <div><span className="font-semibold">هاتف الأم:</span> العمود AC</div>
              <div><span className="font-semibold">الهاتف المعتمد للإرسال:</span> حقل students.phone</div>
              <div><span className="font-semibold">جدول أولياء الأمور:</span> parents</div>
            </div>

            <button
              onClick={() => handleImport()}
              disabled={!files.length || loading}
              className="mt-5 bg-green-600 text-white px-5 py-3 rounded-xl disabled:opacity-60"
            >
              بدء استيراد الملفات
            </button>
          </div>
        </div>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <StatCard title="عدد الملفات" value={result.filesCount} />
            <StatCard title="تم التحديث" value={result.updated} color="text-green-600" />
            <StatCard title="تم التجاوز" value={result.skipped} color="text-yellow-600" />
            <StatCard title="غير موجودين" value={result.notFound} color="text-red-600" />
            <StatCard title="بدون رقم صالح" value={result.noPhone} color="text-orange-600" />
            <StatCard title="احتُفظ بالرقم الحالي" value={result.preserved} color="text-blue-600" />
          </div>

          <div className="bg-white border rounded-2xl shadow-sm p-4 mb-6">
            <div className="font-bold mb-3">ملخص الملفات</div>
            <div className="space-y-2 text-sm">
              {result.results.map((item, index) => (
                <div key={index} className="border rounded-lg p-3 bg-gray-50">
                  <div className="font-semibold">{item.fileName}</div>
                  <div className="mt-1 text-gray-700">
                    تحديث: {item.result.updated} | تجاوز: {item.result.skipped} | غير موجود: {item.result.notFound} | بدون رقم: {item.result.noPhone}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow overflow-x-auto border">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-right">الملف</th>
                  <th className="p-3 text-right">السطر</th>
                  <th className="p-3 text-right">رقم مسار</th>
                  <th className="p-3 text-right">هاتف الأب (خام)</th>
                  <th className="p-3 text-right">هاتف الأم (خام)</th>
                  <th className="p-3 text-right">هاتف الأب (موحد)</th>
                  <th className="p-3 text-right">هاتف الأم (موحد)</th>
                  <th className="p-3 text-right">الهاتف المعتمد</th>
                  <th className="p-3 text-right">المصدر</th>
                  <th className="p-3 text-right">الحالة</th>
                  <th className="p-3 text-right">الملاحظة</th>
                </tr>
              </thead>

              <tbody>
                {topRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-6 text-center text-gray-500">
                      لا توجد نتائج
                    </td>
                  </tr>
                ) : (
                  topRows.map((row, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-3">{row.fileName || "-"}</td>
                      <td className="p-3">{row.rowNumber}</td>
                      <td className="p-3">{row.massarCode || "-"}</td>
                      <td className="p-3">{row.fatherPhoneRaw || "-"}</td>
                      <td className="p-3">{row.motherPhoneRaw || "-"}</td>
                      <td className="p-3">{row.fatherPhoneNormalized || "-"}</td>
                      <td className="p-3">{row.motherPhoneNormalized || "-"}</td>
                      <td className="p-3">{row.selectedPhone || "-"}</td>
                      <td className="p-3">{row.selectedSource || "-"}</td>
                      <td className="p-3">{row.status}</td>
                      <td className="p-3">{row.note}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default PhoneImportPage;