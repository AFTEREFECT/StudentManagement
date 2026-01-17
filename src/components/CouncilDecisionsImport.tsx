import React, { useState, useRef } from 'react';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, Users, Calculator, X, FolderOpen, Clock, Info } from 'lucide-react';
import * as XLSX from 'xlsx';
import { dbManager } from '../utils/database';
import { Student, GuidanceStatistic } from '../types';
import ProgressBar from './ProgressBar';

interface CouncilDecision {
  nationalId: string;
  studentName: string;
  overallAverage: number | null;
  firstChoice: string;
  age: number | null;
  decision: string;
  status: 'pass' | 'repeat' | 'dismiss';
  rowNumber: number;
}

interface ImportResult {
  success: number;
  errors: string[];
  warnings: string[];
  data: CouncilDecision[];
  duplicates: number;
  processed: number;
}

interface ValidationError {
  row: number;
  column: string;
  message: string;
  value: any;
}

// أنواع المحاضر المتاحة
const COUNCIL_TYPES = [
  { id: 'council_decision', name: 'قرار مجلس القسم', description: 'محضر قرارات مجلس القسم للتوجيه' },
  { id: 'promotion_decision', name: 'قرار الانتقال', description: 'محضر قرارات الانتقال للمستوى التالي' },
  { id: 'dismissal_decision', name: 'قرار الفصل', description: 'محضر قرارات فصل التلاميذ' }
];

// لائحة التوجيهات المقبولة
const GUIDANCE_OPTIONS = [
  'جذع مشترك الآداب و العلوم الإنسانية',
  'الجذع المشترك للآداب والعلوم الإنسانية – خيار فرنسية',
  'الجذع المشترك للآداب والعلوم الإنسانية – خيار إنجليزية',
  'الجذع المشترك للآداب والعلوم الإنسانية – خيار إسبانية',
  'جذع مشترك علمي',
  'الجذع المشترك العلمي – خيار فرنسية',
  'الجذع المشترك العلمي – خيار إنجليزية',
  'الجذع المشترك العلمي – خيار إسبانية',
  'جذع مشترك التعليم الأصيل',
  'جذع مشترك تكنولوجي',
  'جدع مشترك مهني صناعي',
  'جدع مشترك مهني فلاحي',
  'جدع مشترك مهني خدماتي',
  'جذع مشترك الآداب والعلوم الإنسانية - رياضة وتربية بدنية',
  'جذع مشترك علوم - رياضة وتربية بدنية'
];

const CouncilDecisionsImport: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedCouncilType, setSelectedCouncilType] = useState('council_decision');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dismissalAge, setDismissalAge] = useState(18);
  const [dragActive, setDragActive] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [progressData, setProgressData] = useState({
    progress: 0,
    status: 'idle' as 'loading' | 'success' | 'error' | 'idle',
    message: '',
    estimatedTime: 0,
    details: null as any
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // معالجة اختيار الملفات
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles]);
      setResult(null);
      setValidationErrors([]);
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
      setValidationErrors([]);
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
    setValidationErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // حساب العمر من تاريخ الميلاد
  const calculateAge = (birthDate: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // تحديد حالة التلميذ
  const determineStatus = (average: number | null, age: number | null): 'pass' | 'repeat' | 'dismiss' => {
    if (age !== null && age >= dismissalAge) {
      return 'dismiss';
    }
    if (average === null || average < 10) {
      return 'repeat';
    }
    return 'pass';
  };

  // معالجة قيمة المعدل العام
  const processAverageValue = (value: any): number | null => {
    if (!value) return null;
    
    const stringValue = String(value).trim();
    
    // إذا كانت القيمة "ن.م.ر" تحويلها إلى 0
    if (stringValue === 'ن.م.ر' || stringValue === 'ن م ر' || stringValue.toLowerCase() === 'n.m.r') {
      return 0;
    }
    
    const numericValue = parseFloat(stringValue);
    return isNaN(numericValue) ? null : numericValue;
  };

  // التحقق من صحة البيانات
  const validateData = (data: any[], fileName: string): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    data.forEach((row, index) => {
      const rowNumber = index + 12; // البيانات تبدأ من الصف 12
      
      // التحقق من الرقم الوطني في العمود B
      if (!row.nationalId || String(row.nationalId).trim() === '') {
        errors.push({
          row: rowNumber,
          column: 'B',
          message: 'الرقم الوطني مطلوب في العمود B',
          value: row.nationalId
        });
      }
      
      // التحقق من المعدل العام في العمود L
      if (row.overallAverage !== null && row.overallAverage !== 0 && (isNaN(row.overallAverage) || row.overallAverage < 0 || row.overallAverage > 20)) {
        errors.push({
          row: rowNumber,
          column: 'L',
          message: 'المعدل العام يجب أن يكون بين 0 و 20 في العمود L',
          value: row.overallAverage
        });
      }
      
      // التحقق من الرغبة الأولى في العمود M
      if (row.firstChoice && !GUIDANCE_OPTIONS.includes(row.firstChoice.trim())) {
        errors.push({
          row: rowNumber,
          column: 'M',
          message: 'الرغبة في التوجيه غير صحيحة في العمود M',
          value: row.firstChoice
        });
      }
    });
    
    return errors;
  };

  // قراءة ملف Excel
  const readExcelFile = (file: File): Promise<XLSX.WorkBook> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          resolve(workbook);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // معالجة ملفات Excel
  const processExcelFiles = async () => {
    if (files.length === 0) return;

    setLoading(true);
    const startTime = Date.now();
    setProgressData({
      progress: 0,
      status: 'loading',
      message: 'جاري قراءة ملفات محاضر الأقسام...',
      estimatedTime: 0,
      details: null
    });

    try {
      const allData: CouncilDecision[] = [];
      const allErrors: string[] = [];
      const allWarnings: string[] = [];
      const allValidationErrors: ValidationError[] = [];
      let totalProcessed = 0;
      let duplicatesCount = 0;
      let processedFiles = 0;

      // الحصول على بيانات التلاميذ
      const students = await dbManager.getStudents();
      const studentsMap = new Map<string, Student>();
      students.forEach(student => {
        studentsMap.set(student.nationalId, student);
      });

      setProgressData(prev => ({
        ...prev,
        message: `جاري معالجة ${files.length} ملف...`,
        details: {
          total: files.length,
          processed: 0,
          success: 0,
          errors: 0,
          warnings: 0
        }
      }));

      // معالجة كل ملف
      for (const file of files) {
        try {
          allErrors.push(`📁 معالجة الملف: ${file.name}`);
          
          const workbook = await readExcelFile(file);
          
          // قراءة الورقة الأولى فقط
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          if (!worksheet) {
            allErrors.push(`❌ لم يتم العثور على ورقة العمل في الملف: ${file.name}`);
            continue;
          }

          const fileData: CouncilDecision[] = [];
          let rowIndex = 12; // البداية من الصف 12

          // قراءة البيانات من الملف
          while (true) {
            const nationalIdCell = worksheet[`B${rowIndex}`]; // الرقم الوطني في العمود B
            if (!nationalIdCell || !nationalIdCell.v) break;

            const nationalId = String(nationalIdCell.v).trim();
            const averageCell = worksheet[`L${rowIndex}`]; // المعدل العام في العمود L
            const choiceCell = worksheet[`M${rowIndex}`]; // الرغبة الأولى في العمود M

            const student = studentsMap.get(nationalId);
            if (!student) {
              allWarnings.push(`⚠️ التلميذ برقم وطني ${nationalId} غير موجود في قاعدة البيانات (${file.name} - صف ${rowIndex})`);
              rowIndex++;
              continue;
            }

            // معالجة المعدل العام مع تحويل "ن.م.ر" إلى 0
            const overallAverage = processAverageValue(averageCell?.v);
            
            const firstChoice = choiceCell && choiceCell.v ? 
              String(choiceCell.v).trim() : '';

            // حساب العمر
            let age: number | null = null;
            if (student.dateOfBirth) {
              const birthDate = new Date(student.dateOfBirth);
              age = calculateAge(birthDate);
            }

            const status = determineStatus(overallAverage, age);
            const decision = status === 'pass' ? 'ينتقل' : 
                            status === 'repeat' ? 'يكرر' : 'يفصل';

            // التحقق من التكرار
            const existingRecord = allData.find(record => record.nationalId === nationalId);
            if (existingRecord) {
              duplicatesCount++;
              allWarnings.push(`⚠️ تكرار للتلميذ ${nationalId} في الملف ${file.name} (صف ${rowIndex})`);
            } else {
              fileData.push({
                nationalId,
                studentName: `${student.firstName} ${student.lastName}`,
                overallAverage,
                firstChoice,
                age,
                decision,
                status,
                rowNumber: rowIndex
              });
            }

            totalProcessed++;
            rowIndex++;
          }

          // التحقق من صحة البيانات
          const fileValidationErrors = validateData(fileData, file.name);
          allValidationErrors.push(...fileValidationErrors);

          allData.push(...fileData);
          processedFiles++;

          const progress = Math.round((processedFiles / files.length) * 100);
          const estimatedTime = files.length > 0 ? 
            ((Date.now() - startTime) / processedFiles) * (files.length - processedFiles) / 1000 : 0;

          setProgressData({
            progress,
            status: 'loading',
            message: `جاري معالجة ${processedFiles}/${files.length} ملف...`,
            estimatedTime,
            details: {
              total: files.length,
              processed: processedFiles,
              success: allData.length,
              errors: allErrors.length,
              warnings: allWarnings.length
            }
          });

          allErrors.push(`✅ تم معالجة ${fileData.length} سجل من الملف: ${file.name}`);

        } catch (error) {
          allErrors.push(`❌ خطأ في معالجة الملف ${file.name}: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
        }
      }

      // حفظ البيانات في قاعدة البيانات
      if (allData.length > 0) {
        setProgressData(prev => ({
          ...prev,
          message: 'جاري حفظ البيانات في قاعدة البيانات...',
          progress: 90
        }));

        // تهيئة جدول guidance_statistics قبل الحفظ (حذف وإعادة إنشاء)
        dbManager.initGuidanceDatabase();

        // مسح البيانات الموجودة
        try {
          await dbManager.clearGuidanceStatistics();
        } catch (error) {
          if (error instanceof Error && error.message.includes('no such table')) {
            console.warn('جدول guidance_statistics غير موجود، سيتم إنشاؤه تلقائياً');
          } else {
            throw error;
          }
        }

        // إدراج البيانات الجديدة
        for (const record of allData) {
          const guidanceStatistic: GuidanceStatistic = {
            student_id: record.nationalId,
            assigned_stream: record.firstChoice || '',
            gender: studentsMap.get(record.nationalId)?.gender || 'ذكر',
            decision: record.decision,
            academic_year: new Date().getFullYear().toString(),
            level: studentsMap.get(record.nationalId)?.level || '',
            section: studentsMap.get(record.nationalId)?.section || '',
            age: record.age,
            ageGroup: record.age ? (record.age < 16 ? 'أقل من 16' : record.age >= 18 ? '18 فأكثر' : '16-17') : 'غير محدد',
            createdAt: new Date().toISOString()
          };
          
          await dbManager.addGuidanceStatistic(guidanceStatistic);
        }
      }

      setProgressData({
        progress: 100,
        status: 'success',
        message: 'تم استيراد محاضر الأقسام بنجاح!',
        estimatedTime: 0,
        details: {
          total: files.length,
          processed: processedFiles,
          success: allData.length,
          errors: allErrors.length,
          warnings: allWarnings.length
        }
      });

      setResult({
        success: allData.length,
        errors: allErrors,
        warnings: allWarnings,
        data: allData,
        duplicates: duplicatesCount,
        processed: totalProcessed
      });

      setValidationErrors(allValidationErrors);

      setTimeout(() => {
        setProgressData(prev => ({ ...prev, status: 'idle' }));
      }, 3000);

    } catch (error) {
      console.error('خطأ في معالجة الملفات:', error);
      
      setProgressData({
        progress: 0,
        status: 'error',
        message: 'حدث خطأ أثناء معالجة الملفات',
        estimatedTime: 0,
        details: null
      });

      setResult({
        success: 0,
        errors: [`❌ خطأ عام: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`],
        warnings: [],
        data: [],
        duplicates: 0,
        processed: 0
      });
    } finally {
      setLoading(false);
    }
  };

  // تنزيل نموذج Excel
  const downloadTemplate = () => {
    const templateData = [
      // إنشاء نموذج محضر مجلس القسم
      ['', '', '', '', '', '', '', '', '', '', '', 'المعدل العام', 'الرغبة الأولى'],
      ['', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', ''],
      // الصف 12 - بيانات تجريبية
      ['', 'D141086163', '', '', '', '', '', '', '', '', '', '15.5', 'جذع مشترك علمي'],
      ['', 'R198001729', '', '', '', '', '', '', '', '', '', '12.0', 'جذع مشترك الآداب و العلوم الإنسانية'],
      ['', 'G159046925', '', '', '', '', '', '', '', '', '', 'ن.م.ر', 'جذع مشترك تكنولوجي']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'قرار مجلس القسم');
    XLSX.writeFile(workbook, `نموذج_${COUNCIL_TYPES.find(t => t.id === selectedCouncilType)?.name || 'محضر_مجلس_القسم'}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* عنوان الصفحة */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
            استيراد محاضر الأقسام
          </h1>
          <p className="text-gray-600 text-lg">استيراد جماعي لمحاضر الأقسام مع التحقق من صحة البيانات</p>
          <div className="mt-4 w-24 h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mx-auto"></div>
        </div>

        {/* إعدادات الاستيراد */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            إعدادات الاستيراد
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* نوع المحضر */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                نوع المحضر *
              </label>
              <select
                value={selectedCouncilType}
                onChange={(e) => setSelectedCouncilType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {COUNCIL_TYPES.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {COUNCIL_TYPES.find(t => t.id === selectedCouncilType)?.description}
              </p>
            </div>

            {/* سن الطرد */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                سن الطرد (سنة) *
              </label>
              <input
                type="number"
                value={dismissalAge}
                onChange={(e) => setDismissalAge(parseInt(e.target.value) || 18)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="16"
                max="25"
              />
              <p className="text-xs text-gray-500 mt-1">
                التلاميذ الذين يبلغون هذا العمر أو أكثر سيتم فصلهم تلقائياً
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              <Download className="w-4 h-4" />
              تحميل النموذج
            </button>
          </div>
        </div>

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
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">رفع ملفات محاضر الأقسام</h3>
              <p className="text-gray-600">اختر ملفات Excel تحتوي على محاضر الأقسام</p>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-blue-400 transition-colors duration-200">
              <div
                className={`cursor-pointer flex flex-col items-center transition-all duration-200 ${
                  dragActive ? 'scale-105 border-blue-500' : ''
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="council-file-upload"
                  multiple
                />
                <label
                  htmlFor="council-file-upload"
                  className="cursor-pointer flex flex-col items-center w-full"
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-all duration-200 ${
                    dragActive ? 'bg-blue-200' : 'bg-blue-100'
                  }`}>
                    <FolderOpen className={`w-8 h-8 transition-all duration-200 ${
                      dragActive ? 'text-blue-700' : 'text-blue-600'
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

            <div className="mt-6">
              <button
                onClick={processExcelFiles}
                disabled={files.length === 0 || loading}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2 mx-auto"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    جاري المعالجة...
                  </>
                ) : (
                  <>
                    <Calculator className="w-5 h-5" />
                    بدء معالجة المحاضر ({files.length} ملف)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* نتائج الاستيراد */}
        {result && (
          <div className="space-y-6">
            {/* ملخص النتائج */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">ملخص نتائج الاستيراد</h3>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-900">نجح</span>
                  </div>
                  <p className="text-3xl font-bold text-green-600">{result.success}</p>
                  <p className="text-xs text-green-600">سجل</p>
                </div>
                
                <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-4 rounded-xl border border-yellow-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <span className="font-semibold text-yellow-900">تحذيرات</span>
                  </div>
                  <p className="text-3xl font-bold text-yellow-600">{result.warnings.length}</p>
                  <p className="text-xs text-yellow-600">تحذير</p>
                </div>
                
                <div className="bg-gradient-to-r from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <X className="w-5 h-5 text-red-600" />
                    <span className="font-semibold text-red-900">أخطاء</span>
                  </div>
                  <p className="text-3xl font-bold text-red-600">{result.errors.length}</p>
                  <p className="text-xs text-red-600">خطأ</p>
                </div>
                
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold text-purple-900">تكرارات</span>
                  </div>
                  <p className="text-3xl font-bold text-purple-600">{result.duplicates}</p>
                  <p className="text-xs text-purple-600">مكرر</p>
                </div>
              </div>

              {/* إحصائيات القرارات */}
              {result.data.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-100 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-800">
                      {result.data.filter(d => d.status === 'pass').length}
                    </div>
                    <div className="text-sm text-green-600">ينتقل</div>
                  </div>
                  <div className="bg-yellow-100 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-800">
                      {result.data.filter(d => d.status === 'repeat').length}
                    </div>
                    <div className="text-sm text-yellow-600">يكرر</div>
                  </div>
                  <div className="bg-red-100 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-800">
                      {result.data.filter(d => d.status === 'dismiss').length}
                    </div>
                    <div className="text-sm text-red-600">يفصل</div>
                  </div>
                </div>
              )}
            </div>

            {/* أخطاء التحقق */}
            {validationErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <h3 className="font-semibold text-red-800">أخطاء في التحقق من البيانات</h3>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {validationErrors.map((error, index) => (
                    <div key={index} className="text-sm text-red-700 bg-white p-2 rounded">
                      <span className="font-medium">صف {error.row}, عمود {error.column}:</span> {error.message}
                      {error.value && <span className="text-gray-600"> (القيمة: {error.value})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* تفاصيل العملية */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h4 className="font-medium text-gray-900 mb-3">تفاصيل العملية:</h4>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {result.errors.map((detail, index) => (
                  <p key={index} className="text-sm text-gray-700">
                    {detail}
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

        {/* معلومات إضافية */}
        <div className="mt-8 bg-blue-50 p-6 rounded-xl border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">متطلبات ملف Excel</h3>
          <div className="space-y-2 text-blue-800">
            <p>• <strong>الورقة الأولى فقط:</strong> سيتم قراءة الورقة الأولى في الملف فقط</p>
            <p>• <strong>الرقم الوطني:</strong> يجب أن يكون في العمود B (بدءاً من الصف 12)</p>
            <p>• <strong>المعدل العام:</strong> يجب أن يكون في العمود L (بدءاً من الصف 12) - "ن.م.ر" يتم تحويلها إلى 0</p>
            <p>• <strong>الرغبة الأولى:</strong> يجب أن تكون في العمود M (بدءاً من الصف 12)</p>
            <p>• <strong>التحقق من التكرار:</strong> سيتم تجاهل السجلات المكررة</p>
            <p>• <strong>التحقق من صحة البيانات:</strong> سيتم فحص جميع البيانات قبل الحفظ</p>
            <p>• <strong>الربط بالتلاميذ:</strong> يتم الربط باستخدام الرقم الوطني فقط</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CouncilDecisionsImport;