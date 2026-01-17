import React, { useState, useEffect } from 'react';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, Layers, BookOpen, Eye, RefreshCw, X, FolderOpen } from 'lucide-react';
import * as XLSX from 'xlsx';
import { dbManager } from '../utils/database';
import ProgressBar from './ProgressBar';

interface LevelSectionData { 
  level: string;
  levelCode: string;
  section: string;
  metadata: any;
  sheetName: string;
}

interface SetupResult {
  levelsCreated: number;
  sectionsCreated: number;
  errors: string[];
  details: string[];
}

const LevelsAndSectionsSetup: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SetupResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [discoveredData, setDiscoveredData] = useState<LevelSectionData[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [progressData, setProgressData] = useState({
    progress: 0,
    status: 'idle' as 'loading' | 'success' | 'error' | 'idle',
    message: '',
    estimatedTime: 0,
    details: null as any
  });

  // خريطة تحويل الأكواد إلى أسماء وصفية
  const levelNameMap: Record<string, string> = {
    '1APIC': 'الأولى إعدادي مسار دولي',
    '2APIC': 'الثانية إعدادي مسار دولي',
    '3APIC': 'الثالثة إعدادي مسار دولي',
    'TC': 'الجذع المشترك',
    'TCS': 'الجذع المشترك العلمي',
    'TCL': 'الجذع المشترك الأدبي',
    'TCSE': 'الجذع المشترك علوم وتكنولوجيا',
    'TCLH': 'الجذع المشترك آداب وعلوم إنسانية',
    '1B': 'الأولى باكالوريا',
    '1BS': 'الأولى باكالوريا علوم',
    '1BL': 'الأولى باكالوريا آداب',
    '1BSE': 'الأولى باكالوريا علوم وتكنولوجيا',
    '1BLH': 'الأولى باكالوريا آداب وعلوم إنسانية',
    '2B': 'الثانية باكالوريا',
    '2BS': 'الثانية باكالوريا علوم',
    '2BL': 'الثانية باكالوريا آداب',
    '2BSE': 'الثانية باكالوريا علوم وتكنولوجيا',
    '2BLH': 'الثانية باكالوريا آداب وعلوم إنسانية',
    'CP': 'التحضيري',
    'CE1': 'السنة الأولى ابتدائي',
    'CE2': 'السنة الثانية ابتدائي',
    'CM1': 'السنة الثالثة ابتدائي',
    'CM2': 'السنة الرابعة ابتدائي',
    'CI': 'السنة الخامسة ابتدائي',
    'CS': 'السنة السادسة ابتدائي',
    '6AEP': 'السادسة ابتدائي',
    '1AC': 'الأولى إعدادي',
    '2AC': 'الثانية إعدادي',
    '3AC': 'الثالثة إعدادي'
  };

  // معالجة اختيار الملفات
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles]);
      setResult(null);
      setDiscoveredData([]);
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
      setDiscoveredData([]);
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
    setDiscoveredData([]);
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

  // الحصول على قيمة الخلية
  const getCellValue = (worksheet: XLSX.WorkSheet, cellAddress: string): string => {
    const cell = worksheet[cellAddress];
    if (!cell || cell.v === undefined || cell.v === null) {
      return '';
    }
    return String(cell.v).trim();
  };

  // استخراج البيانات الوصفية من ورقة العمل
  const extractMetadataFromSheet = (worksheet: XLSX.WorkSheet) => {
    const rawLevelCode = getCellValue(worksheet, 'C7').toUpperCase();
    const sectionName = getCellValue(worksheet, 'C8');
    const levelName = levelNameMap[rawLevelCode] || rawLevelCode;

    return {
      region: getCellValue(worksheet, 'C5'),
      province: getCellValue(worksheet, 'C6'),
      level: levelName,
      levelCode: rawLevelCode,
      section: sectionName,
      municipality: getCellValue(worksheet, 'G5'),
      institution: getCellValue(worksheet, 'G6'),
      academicYear: getCellValue(worksheet, 'G7')
    };
  };

//////////////////////////////////////
  
/////////////////////////////////////////

  
  // اكتشاف المستويات والأقسام من الملفات
  const discoverLevelsAndSections = async () => {
    if (files.length === 0) return;

    setLoading(true);
    setProgressData({
      progress: 0,
      status: 'loading',
      message: 'جاري اكتشاف المستويات والأقسام من الملفات...',
      estimatedTime: 0,
      details: null
    });

    try {
      const discoveredItems: LevelSectionData[] = [];
      let processedFiles = 0;

      for (const file of files) {
        try {
          const workbook = await readExcelFile(file);
          
          for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) continue;
            
            const metadata = extractMetadataFromSheet(worksheet);
            
            if (metadata.level) {
              discoveredItems.push({
                level: metadata.level,
                levelCode: metadata.levelCode,
                section: metadata.section || '',
                metadata,
                sheetName: `${file.name} - ${sheetName}`
              });
            }
          }
          
          processedFiles++;
          const progress = Math.round((processedFiles / files.length) * 100);
          
          setProgressData({
            progress,
            status: 'loading',
            message: `جاري تحليل ${processedFiles}/${files.length} ملف...`,
            estimatedTime: 0,
            details: {
              total: files.length,
              processed: processedFiles,
              success: discoveredItems.length,
              errors: 0
            }
          });
          
        } catch (error) {
          console.error(`خطأ في تحليل الملف ${file.name}:`, error);
        }
      }

      setDiscoveredData(discoveredItems);
      setShowPreview(true);
      
      setProgressData({
        progress: 100,
        status: 'success',
        message: `تم اكتشاف ${discoveredItems.length} مستوى/قسم من ${files.length} ملف`,
        estimatedTime: 0,
        details: {
          total: files.length,
          processed: processedFiles,
          success: discoveredItems.length,
          errors: 0
        }
      });

    } catch (error) {
      console.error('خطأ في اكتشاف المستويات والأقسام:', error);
      setProgressData({
        progress: 0,
        status: 'error',
        message: 'حدث خطأ أثناء اكتشاف المستويات والأقسام',
        estimatedTime: 0,
        details: null
      });
    } finally {
      setLoading(false);
    }
  };

  // إنشاء المستويات والأقسام
  const createLevelsAndSections = async () => {
    if (discoveredData.length === 0) return;

    setLoading(true);
    const startTime = Date.now();
    setProgressData({
      progress: 0,
      status: 'loading',
      message: 'جاري إنشاء المستويات والأقسام...',
      estimatedTime: 0,
      details: null
    });
 
    try {
      let levelsCreated = 0;
      let sectionsCreated = 0;
      const errors: string[] = [];
      const details: string[] = [];

 // جمع المستويات و الأقسام الفريدة من البيانات
const uniqueLevels = new Map<string, { name: string; code: string }>();
const uniqueSections = new Map<string, { name: string; levelName: string }>();

// التحقق من صحة البيانات المستوردة
if (!Array.isArray(discoveredData) || discoveredData.length === 0) {
  alert("⚠️ المرجو تحميل ملف اللوائح أولاً.");
  return;
}

console.log("discoveredData:", discoveredData); // معاينة البيانات في الكونسول

// استخراج المستويات و الأقسام الفريدة
discoveredData.forEach(item => {
  if (item.level && item.levelCode) {
    uniqueLevels.set(item.level, {
      name: item.level.trim(),
      code: item.levelCode.trim().toUpperCase(),
    });
  }

  if (item.section && item.level) {
    uniqueSections.set(item.section + '_' + item.level, {
      name: item.section.trim(),
      levelName: item.level.trim(),
    });
  }
});

// إنشاء المستويات في قاعدة البيانات وتخزينها في الخريطة
const createdLevelsMap = new Map<string, { id: string; name: string; code: string }>();

for (const [levelName, levelData] of uniqueLevels.entries()) {
  try {
    const level = await dbManager.getOrCreateLevel(levelData.name, levelData.code);
    createdLevelsMap.set(levelName, level);
    levelsCreated++;
    details.push(`✅ مستوى: ${level.name} (${level.code}) → ID: ${level.id}`);
  } catch (err) {
    errors.push(`❌ فشل إنشاء المستوى ${levelData.name}: ${err instanceof Error ? err.message : err}`);
  }
}

    
// التجميع بعد التأكد
discoveredData.forEach(item => {
  if (typeof item.level !== 'string' || typeof item.levelCode !== 'string') {
    console.warn("بيانات غير مكتملة في عنصر:", item);
    return;
  }
  uniqueLevels.set(item.level, { name: item.level, code: item.levelCode });
  if (item.section) {
    uniqueSections.set(item.section + '_' + item.level, { 
      name: item.section, 
      levelName: item.level 
    });
  }
});

      const totalItems = uniqueLevels.size + uniqueSections.size;
      let processedItems = 0;

      details.push(`📊 تم اكتشاف ${uniqueLevels.size} مستوى و ${uniqueSections.size} قسم`);

      ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
if (!uniqueLevels || !(uniqueLevels instanceof Map) || uniqueLevels.size === 0) {
  console.warn('uniqueLevels غير موجود أو فارغ');
  return; // أو تخطي تنفيذ التكرار
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// إنشاء المستويات والأقسام
// const createLevelsAndSections = async () => {
//   if (!Array.isArray(discoveredData) || discoveredData.length === 0) {
//     alert("⚠️ المرجو تحميل ملف اللوائح أولاً.");
//     return;
//   }

//   setLoading(true);
//   const startTime = Date.now();
//   setProgressData({
//     progress: 0,
//     status: 'loading',
//     message: 'جاري إنشاء المستويات والأقسام...',
//     estimatedTime: 0,
//     details: null
//   });

//   try {
//     let levelsCreated = 0;
//     let sectionsCreated = 0;
//     const errors: string[] = [];
//     const details: string[] = [];

//     // جمع المستويات و الأقسام الفريدة من البيانات
//     const uniqueLevels = new Map<string, { name: string; code: string }>();
//     const uniqueSections = new Map<string, { name: string; levelName: string }>();

//     discoveredData.forEach(item => {
//       if (item.level && item.levelCode) {
//         uniqueLevels.set(item.level.trim(), {
//           name: item.level.trim(),
//           code: item.levelCode.trim().toUpperCase(),
//         });
//       }

//       if (item.section && item.level) {
//         uniqueSections.set(item.section + '_' + item.level, {
//           name: item.section.trim(),
//           levelName: item.level.trim(),
//         });
//       }
// });

//     // إنشاء المستويات
//     const createdLevelsMap = new Map<string, { id: string, name: string, code: string }>();

//     for (const [levelName, levelData] of uniqueLevels.entries()) {
//       const level = await dbManager.getOrCreateLevel(levelData.name, levelData.code);
//       createdLevelsMap.set(levelName, level);
//       levelsCreated++;
//       details.push( ` ✅ مستوى: level.name (${level.code}) → ID: ${level.id}  `  );
    

    // إنشاء الأقسام وربطها بالمستويات
    const existingSections = await dbManager.getSections();

  
for (const [sectionKey, sectionData] of uniqueSections.entries()) {
  const level = createdLevelsMap.get(sectionData.levelName);

  if (!level) {
    errors.push(`❌ لم يتم العثور على المستوى ${sectionData.levelName} للقسم ${sectionData.name}`);
    continue;
  }

  const alreadyExists = existingSections.some(
    s => s.name === sectionData.name && s.levelId === level.id
  );

  if (alreadyExists) {
    details.push(`ℹ️ قسم موجود مسبقًا: ${sectionData.name} في ${sectionData.levelName}`);
    continue;
  }

  try {
    const sectionId = await dbManager.getOrCreateSection(
      sectionData.name,
      level.id,
      sectionData.name.substring(0, 3)
    );
    sectionsCreated++;
    details.push(`✅ قسم مضاف: ${sectionData.name} في ${sectionData.levelName}`);
  } catch (err) {
    errors.push(`❌ فشل إنشاء القسم ${sectionData.name}: ${err instanceof Error ? err.message : err}`);
  }
}


    // تحديث التقدم بعد الانتهاء
    setProgressData({
      progress: 100,
      status: 'success',
      message: '✅ تم إنشاء المستويات والأقسام.',
      estimatedTime: (Date.now() - startTime) / 1000,
      details: [
        `المستويات: ${levelsCreated}`,
        `الأقسام: ${sectionsCreated}`,
        ...details,
        ...(errors.length > 0 ? ['❌ الأخطاء:', ...errors] : [])
      ]
    });

    setResult({
      levelsCreated,
      sectionsCreated,
      errors,
      details
    });

  } catch (err) {
    console.error("خطأ أثناء إنشاء المستويات أو الأقسام:", err);
    setProgressData({
      progress: 100,
      status: 'error',
      message: 'حدث خطأ أثناء العملية.',
      estimatedTime: (Date.now() - startTime) / 1000,
      details: [err instanceof Error ? err.message : 'خطأ غير معروف']
    });
  } finally {
    setLoading(false);
  }
};

  // تنزيل نموذج Excel
  const downloadTemplate = () => {
    const templateData = [
      ['', '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['', '', 'الأكاديمية الجهوية للتربية والتكوين', '', '', '', 'الجماعة'],
      ['', '', 'المديرية الإقليمية', '', '', '', 'المؤسسة'],
      ['', '', '1APIC', '', '', '', '2025/2026'],
      ['', '', 'علوم تجريبية', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['رت', 'الرقم الوطني', 'النسب', 'الاسم', 'النوع', 'تاريخ الازدياد', 'مكان الازدياد'],
      ['1', 'D131250967', 'أحمد', 'محمد', 'ذكر', '2005-03-15', 'الرباط'],
      ['2', 'G159046925', 'فاطمة', 'علي', 'أنثى', '2004-07-22', 'سلا']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'نموذج المستويات والأقسام');
    XLSX.writeFile(workbook, 'نموذج_إعداد_المستويات_والأقسام.xlsx');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* عنوان الصفحة */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
            إعداد المستويات والأقسام
          </h1>
          <p className="text-gray-600 text-lg">استخراج وإنشاء المستويات والأقسام من ملفات اللوائح قبل استيراد التلاميذ</p>
          <div className="mt-4 w-24 h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mx-auto"></div>
        </div>

        {/* معلومات مهمة */}
        <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-blue-900">خطوات مهمة</h3>
          </div>
          <div className="space-y-2 text-blue-800">
            <p>• <strong>الخطوة 1:</strong> رفع ملفات اللوائح هنا لاستخراج المستويات والأقسام</p>
            <p>• <strong>الخطوة 2:</strong> مراجعة المستويات والأقسام المكتشفة</p>
            <p>• <strong>الخطوة 3:</strong> إنشاء المستويات والأقسام في قاعدة البيانات</p>
            <p>• <strong>الخطوة 4:</strong> الانتقال لصفحة "استيراد الدخول المدرسي" لاستيراد التلاميذ</p>
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
              <h3 className="text-xl font-semibold text-gray-900 mb-2">رفع ملفات اللوائح</h3>
              <p className="text-gray-600">اختر ملفات Excel لاستخراج المستويات والأقسام و  </p>
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
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="levels-file-upload"
                  multiple
                />
                <label
                  htmlFor="levels-file-upload"
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
                    سيتم استخراج المستويات من والأقسام     
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
                onClick={discoverLevelsAndSections}
                disabled={files.length === 0 || loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Eye className="w-5 h-5" />
                )}
                اكتشاف المستويات والأقسام
              </button>
              
              <button
                onClick={downloadTemplate}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                تحميل النموذج
              </button>
            </div>
          </div>
        </div>

        {/* معاينة المستويات والأقسام المكتشفة */}
        {showPreview && discoveredData.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Eye className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">المستويات والأقسام المكتشفة</h3>
              </div>
              
           
              <button
                disabled={!discoveredData || discoveredData.length === 0 || loading}
                onClick={createLevelsAndSections}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors duration-200 flex items-center gap-2"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                إنشاء المستويات والأقسام
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      المصدر
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      كود المستوى
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      اسم المستوى
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      القسم
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      المؤسسة
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {discoveredData.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.sheetName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-mono bg-blue-100 text-blue-800 rounded">
                          {item.levelCode}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-purple-600" />
                          <span className="text-sm font-medium text-gray-900">{item.level}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-gray-900">{item.section || 'غير محدد'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.metadata.institution || 'غير محدد'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* نتائج الإنشاء */}
        {result && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">نتائج إنشاء المستويات والأقسام</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold text-purple-900">المستويات</span>
                </div>
                <p className="text-3xl font-bold text-purple-600">{result.levelsCreated}</p>
                <p className="text-xs text-purple-600">مستوى تم إنشاؤه</p>
              </div>
              
              <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-900">الأقسام</span>
                </div>
                <p className="text-3xl font-bold text-green-600">{result.sectionsCreated}</p>
                <p className="text-xs text-green-600">قسم تم إنشاؤه</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-50 p-4 rounded-lg mb-4">
                <h4 className="font-medium text-red-900 mb-2">الأخطاء:</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {result.errors.map((error, index) => (
                    <p key={index} className="text-sm text-red-700">{error}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">تفاصيل العملية:</h4>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {result.details.map((detail, index) => (
                  <p key={index} className="text-sm text-gray-700">{detail}</p>
                ))}
              </div>
            </div>

            {(result.levelsCreated > 0 || result.sectionsCreated > 0) && (
              <div className="mt-6 bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                  <h4 className="text-lg font-bold text-green-900 mb-2">
                    تم إنشاء المستويات والأقسام بنجاح! 🎉
                  </h4>
                  <p className="text-green-700">
                    يمكنك الآن الانتقال إلى صفحة "استيراد الدخول المدرسي" لاستيراد التلاميذ
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* معلومات إضافية */}
        <div className="mt-8 bg-purple-50 p-6 rounded-xl border border-purple-200">
          <h3 className="text-lg font-semibold text-purple-900 mb-4">كيفية عمل النظام</h3>
          <div className="space-y-2 text-purple-800">
 
 
            <p>• <strong>منع التكرار:</strong> فحص وجود المستوى/القسم قبل الإنشاء</p>
            <p>• <strong>ربط العلاقات:</strong> ربط كل قسم بمستواه الصحيح</p>
            <p>• <strong>معالجة جميع الملفات:</strong> استخراج من جميع أوراق العمل في جميع الملفات</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LevelsAndSectionsSetup;