import React, { useState } from 'react';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, X, FolderOpen, Users, Link2, UserX } from 'lucide-react';
import * as XLSX from 'xlsx';
import { outgoingStudentsDB } from '../utils/outgoingStudentsDatabase';
import ProgressBar from './ProgressBar';

interface ImportResult {
  success: number;
  errors: string[];
  warnings: string[];
  duplicates: number;
  linked: number;
  unlinked: number;
}

interface OutgoingStudentImportProps {
  onImportComplete: () => void;
}

const OutgoingStudentImport: React.FC<OutgoingStudentImportProps> = ({ onImportComplete }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progressData, setProgressData] = useState({
    progress: 0,
    status: 'idle' as 'loading' | 'success' | 'error' | 'idle',
    message: '',
    estimatedTime: 0,
    details: null as any
  });

  // معالجة اختيار الملفات
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles]);
      setResult(null);
    }
  };

  // معالجة drag and drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => 
      file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    );
    
    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
      setResult(null);
    }
  };

  // إزالة ملف من القائمة
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // مسح جميع الملفات
  const clearFiles = () => {
    setFiles([]);
    setResult(null);
  };

  // معالجة الاستيراد
  const handleImport = async () => {
    if (files.length === 0) return;

    setImporting(true);
    const startTime = Date.now();
    setProgressData({
      progress: 0,
      status: 'loading',
      message: 'جاري قراءة ملفات التلاميذ المغادرين...',
      estimatedTime: 0,
      details: null
    });

    try {
      let totalSuccess = 0;
      let totalDuplicates = 0;
      let totalLinked = 0;
      let totalUnlinked = 0;
      const allErrors: string[] = [];
      const allWarnings: string[] = [];
      let processedFiles = 0;

      for (const file of files) {
        try {
          setProgressData(prev => ({
            ...prev,
            progress: Math.round((processedFiles / files.length) * 100),
            message: `جاري معالجة الملف: ${file.name}...`,
            estimatedTime: files.length > 0 ? 
              ((Date.now() - startTime) / (processedFiles + 1)) * (files.length - processedFiles - 1) / 1000 : 0
          }));

          const importResult = await outgoingStudentsDB.importStudentsFromExcel(file);
          
          totalSuccess += importResult.success;
          totalDuplicates += importResult.duplicates;
          totalLinked += importResult.linked || 0;
          totalUnlinked += importResult.unlinked || 0;
          allErrors.push(...importResult.errors);
          allWarnings.push(...importResult.warnings);
          
          processedFiles++;
          
        } catch (error) {
          allErrors.push(`خطأ في معالجة الملف ${file.name}: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
        }
      }

      setProgressData({
        progress: 100,
        status: 'success',
        message: `تم استيراد ${totalSuccess} تلميذ وافد بنجاح! `,
        estimatedTime: 0,
        details: {
          total: totalSuccess + totalDuplicates,
          processed: totalSuccess + totalDuplicates,
          success: totalSuccess,
          duplicates: totalDuplicates,
          errors: allErrors.length,
          linked: totalLinked || 0,
          unlinked: totalUnlinked || 0
        }
      });

      setResult({
        success: totalSuccess,
        errors: allErrors,
        warnings: allWarnings,
        duplicates: totalDuplicates,
        linked: totalLinked || 0,
        unlinked: totalUnlinked || 0
      });

      // تحديث البيانات في المكون الأب
      onImportComplete();

    } catch (error) {
      console.error('خطأ في استيراد التلاميذ المغادرين:', error);
      
      setProgressData({
        progress: 0,
        status: 'error',
        message: 'حدث خطأ أثناء استيراد التلاميذ المغادرين',
        estimatedTime: 0,
        details: null
      });

      setResult({
        success: 0,
        errors: [`خطأ عام: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`],
        warnings: [],
        duplicates: 0,
        linked: 0,
        unlinked: 0
      });
    } finally {
      setImporting(false);
    }
  };

  // تنزيل نموذج Excel
  const downloadTemplate = () => {
    const templateData = [
      // البيانات الوصفية في الخلايا المحددة
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', 'الأكاديمية الجهوية للتربية والتكوين', '', '', '', 'الجماعة', ''],
      ['', '', 'المديرية الإقليمية', '', '', '', 'المؤسسة', ''],
      ['', '', 'الثانية باكالوريا', '', '', '', '2025/2026', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      // الصف 11 - العناوين حسب الهيكل الجديد
      ['رقم التلميذ', 'النسب', 'الاسم', 'تاريخ التحويل', 'نوع التحويل', 'مؤسسة الاستقبال', 'المديرية الأصلية', 'الأكاديمية الأصلية'],
      // بيانات تجريبية
      ['D131250967', 'أحمد', 'محمد', '2025-01-15', 'تحويل عادي', 'ثانوية الحسن الثاني', 'مديرية الرباط', 'أكاديمية الرباط'],
      ['G159046925', 'فاطمة', 'علي', '2025-01-20', 'تحويل استثنائي', 'ثانوية محمد الخامس', 'مديرية سلا', 'أكاديمية الرباط'],
      ['R188026128', 'يوسف', 'حسن', '2025-01-25', 'تحويل عادي', 'إعدادية الأندلس', 'مديرية القنيطرة', 'أكاديمية الرباط']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'التلاميذ المغادرين');
    XLSX.writeFile(workbook, 'نموذج_التلاميذ_المغادرين.xlsx');
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
          <Upload className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">استيراد التلاميذ المغادرين</h2>
          <p className="text-gray-600">استيراد قوائم التلاميذ المغادرين من ملفات Excel</p>
        </div>
      </div>

      {/* معلومات مهمة  
      <div className="bg-green-50 p-6 rounded-xl border border-green-200 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-green-600" />
          <h3 className="text-lg font-semibold text-green-900">نظام مستقل للتلاميذ المغادرين</h3>
        </div>
        <div className="space-y-2 text-green-800">
          <p>• <strong>قاعدة بيانات منفصلة:</strong> التلاميذ المغادرون يُحفظون في قاعدة بيانات مستقلة</p>
          <p>• <strong>لا تداخل:</strong> لا يؤثر على قاعدة بيانات التلاميذ الأصليين</p>
          <p>• <strong>تدبير خاص:</strong> نظام إدارة مخصص للوافدين فقط</p>
          <p>• <strong>تتبع الملفات:</strong> متابعة طلبات الملفات والمراسلات</p>
        </div>
      </div>  */}

      {/* شريط التقدم */}
      {progressData.status !== 'idle' && (
        <div className="mb-6">
          <ProgressBar
            progress={progressData.progress}
            status={progressData.status}
            message={progressData.message}
            estimatedTime={progressData.estimatedTime}
            details={progressData.details}
          />
        </div>
      )}

      {/* منطقة رفع الملفات */}
      <div className="bg-white rounded-xl p-8 shadow-sm mb-6 border border-gray-100">
        <div className="text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">رفع ملفات التلاميذ المغادرين</h3>
            <p className="text-gray-600">اختر ملفات Excel تحتوي على قوائم التلاميذ المغادرين</p>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-green-400 transition-colors duration-200">
            <div
              className={`cursor-pointer flex flex-col items-center transition-all duration-200 ${
                dragActive ? 'scale-105 border-green-500' : ''
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="outgoing-file-upload"
                multiple
              />
              <label
                htmlFor="outgoing-file-upload"
                className="cursor-pointer flex flex-col items-center w-full"
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-all duration-200 ${
                  dragActive ? 'bg-green-200' : 'bg-green-100'
                }`}>
                  <FolderOpen className={`w-8 h-8 transition-all duration-200 ${
                    dragActive ? 'text-green-700' : 'text-green-600'
                  }`} />
                </div>
                <span className="text-lg font-medium text-gray-700 mb-2">
                  انقر لاختيار ملفات Excel أو اسحبها وأفلتها هنا
                </span>
                <span className="text-sm text-gray-500">
                  يمكنك اختيار عدة ملفات دفعة واحدة
                </span>
              </label>
            </div>
          </div>

          {files.length > 0 && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-gray-900">
                  الملفات المحددة ({files.length})
                </h4>
                <button
                  onClick={clearFiles}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  مسح الكل
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} ميجابايت
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700 p-1 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-4 justify-center">
            <button
              onClick={handleImport}
              disabled={files.length === 0 || importing}
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2"
            >
              {importing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  جاري الاستيراد...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  بدء استيراد المغادرين ({files.length} ملف)
                </>
              )}
            </button>
            
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors duration-200 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              تحميل النموذج
            </button>
          </div>
        </div>
      </div>

      {/* نتائج الاستيراد */}
      {result && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">نتائج استيراد التلاميذ المغادرين</h3>
          </div>
          
          {/* ملخص النتائج */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-900">نجح</span>
              </div>
              <p className="text-3xl font-bold text-green-600">{result.success}</p>
              <p className="text-xs text-green-600">تلميذ وافد</p>
            </div>
            
            <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-4 rounded-xl border border-yellow-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="font-semibold text-yellow-900">مكرر</span>
              </div>
              <p className="text-3xl font-bold text-yellow-600">{result.duplicates}</p>
              <p className="text-xs text-yellow-600">تلميذ</p>
            </div>
                 {/* ملخص النتائج  
            <div className="bg-gradient-to-r from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <X className="w-5 h-5 text-red-600" />
                <span className="font-semibold text-red-900">أخطاء</span>
              </div>
              <p className="text-3xl font-bold text-red-600">{result.errors.length}</p>
              <p className="text-xs text-red-600">خطأ</p>
            </div>
             */}
          </div>

          {/* رسالة النجاح */}
          {result.success > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-xl border border-green-200 mb-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-green-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">
                  تم استيراد التلاميذ المغادرين بنجاح! 🎉
                </h4>
                <p className="text-gray-700 text-lg">
                  تم إضافة {result.success} تلميذ مغادر إلى النظام
                </p>
                {result.duplicates > 0 && (
                  <p className="text-yellow-600 mt-2">
                    مع تجاهل {result.duplicates} تلميذ مكرر
                  </p>
                )}
              </div>
            </div>
          )}

          {/* تفاصيل العملية */}
          <div className="bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto">
            <h4 className="font-medium text-gray-900 mb-3">تفاصيل العملية:</h4>
            <div className="space-y-1">
              {result.errors.map((error, index) => (
                <p key={index} className="text-sm text-gray-700">
                  {error}
                </p>
              ))}
              {result.warnings.map((warning, index) => (
                <p key={index} className="text-sm text-yellow-700">
                  {warning}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* معلومات إضافية 
      <div className="mt-8 bg-green-50 p-6 rounded-xl border border-green-200">
        <h3 className="text-lg font-semibold text-green-900 mb-4">تنسيق ملف Excel للتلاميذ المغادرين</h3>
        <div className="space-y-2 text-green-800">
          <p>• <strong>البيانات الوصفية:</strong> الأكاديمية (C5)، المديرية (C6)، المستوى (C7)، الجماعة (G5)، المؤسسة (G6)، السنة الدراسية (G7)</p>
          <p>• <strong>البداية:</strong> الصف 11 (العناوين) والصف 12 (البيانات)</p>
          <p>• <strong>العمود A:</strong> رقم التلميذ (مطلوب)</p>
          <p>• <strong>العمود B:</strong> النسب (مطلوب)</p>
          <p>• <strong>العمود C:</strong> الاسم (مطلوب)</p>
          <p>• <strong>العمود D:</strong> تاريخ التحويل</p>
          <p>• <strong>العمود E:</strong> نوع التحويل</p>
          <p>• <strong>العمود F:</strong> مؤسسة الاستقبال (مهم لطلب الملفات)</p>
          <p>• <strong>العمود G:</strong> المديرية الأصلية</p>
          <p>• <strong>العمود H:</strong> الأكاديمية الأصلية</p>
          <p>• <strong>الربط التلقائي:</strong> سيتم البحث عن القسم والجنس في قاعدة البيانات الرئيسية</p>
        </div>
      </div>
      */}
    </div>
  );
};

export default OutgoingStudentImport;