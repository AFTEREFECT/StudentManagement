import React, { useState, useEffect } from 'react';
import { Users, ArrowRightLeft, UserMinus, UserPlus, UserX, RotateCcw, Upload, Download, FileSpreadsheet, Calendar, Building, MapPin, AlertCircle, CheckCircle, Info, X, FolderOpen } from 'lucide-react';
import { dbManager } from '../utils/database';
import * as XLSX from 'xlsx';
import ProgressBar from './ProgressBar';

interface MobilityCategory {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  color: string;
  description: string;
  excelColumns: string[];
  metadataFields: string[]; 
}

interface ImportResult {
  success: number;
  errors: number;
  duplicates: number;
  details: string[];
}

// مكون إحصائيات الفئة النشطة
const MobilityCategoryStats: React.FC<{ category: string; academicYear: string }> = ({ category, academicYear }) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategoryStats();
  }, [category, academicYear]);

  const loadCategoryStats = async () => {
    try {
      setLoading(true);
      
      // Initialize all variables before use
      let transfers: any[] = [];
      let dropouts: any[] = [];
      let reintegrations: any[] = [];
      let dismissedStudents: any[] = [];
      let unenrolledStudents: any[] = [];
      let absentees: any[] = [];
      
      // جلب بيانات الحركية مع معالجة آمنة للأخطاء
      try {
        transfers = await dbManager.getTransfers();
        console.log('✅ تم جلب بيانات النقل:', transfers.length);
      } catch (error) {
        console.warn('⚠️ خطأ في جلب بيانات النقل:', error);
      }
      
      try {
        dropouts = await dbManager.getDropouts();
        console.log('✅ تم جلب بيانات المنقطعين:', dropouts.length);
      } catch (error) {
        console.warn('⚠️ خطأ في جلب بيانات المنقطعين:', error);
      }
      
      try {
        reintegrations = await dbManager.getReintegrations();
        console.log('✅ تم جلب بيانات المدمجين:', reintegrations.length);
      } catch (error) {
        console.warn('⚠️ خطأ في جلب بيانات المدمجين:', error);
      }
      
      try {
        dismissedStudents = await dbManager.getDismissedStudents();
        console.log('✅ تم جلب بيانات المفصولين:', dismissedStudents.length);
      } catch (error) {
        console.warn('⚠️ خطأ في جلب بيانات المفصولين:', error);
      }
      
      try {
        unenrolledStudents = await dbManager.getUnenrolledStudents();
        console.log('✅ تم جلب بيانات غير الملتحقين:', unenrolledStudents.length);
      } catch (error) {
        console.warn('⚠️ خطأ في جلب بيانات غير الملتحقين:', error);
      }
      
      try {
        absentees = await dbManager.getAbsentees();
        console.log('✅ تم جلب بيانات الغائبين:', absentees.length);
      } catch (error) {
        console.warn('⚠️ خطأ في جلب بيانات الغائبين:', error);
      }
      
      // جلب الإحصائيات حسب الفئة
      let data = null;
      
      switch (category) {
        case 'transfers-in':
          const incomingTransfers = transfers.filter(t => 
            t.transfer_type === 'وافد' && 
            t.metadata && 
            JSON.parse(t.metadata).academicYear === academicYear
          );
          data = {
            total: incomingTransfers.length,
            male: incomingTransfers.filter(t => JSON.parse(t.metadata).gender === 'ذكر').length,
            female: incomingTransfers.filter(t => JSON.parse(t.metadata).gender === 'أنثى').length,
            filesRequested: incomingTransfers.filter(t => t.file_requested).length,
            filesReceived: incomingTransfers.filter(t => t.file_received).length
          };
          break;
        case 'transfers-out':
          const outgoingTransfers = transfers.filter(t => 
            t.transfer_type === 'مغادر' && 
            t.metadata && 
            JSON.parse(t.metadata).academicYear === academicYear
          );
          data = {
            total: outgoingTransfers.length,
            male: outgoingTransfers.filter(t => JSON.parse(t.metadata).gender === 'ذكر').length,
            female: outgoingTransfers.filter(t => JSON.parse(t.metadata).gender === 'أنثى').length
          };
          break;
        default:
          data = { total: 0, male: 0, female: 0 };
      }
      
      setStats(data);
    } catch (error) {
      console.error('خطأ في تحميل إحصائيات الفئة:', error);
      setStats({ total: 0, male: 0, female: 0 });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-4 mb-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white p-3 rounded-lg animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white p-4 rounded-lg text-center border border-gray-200">
        <div className="text-2xl font-bold text-blue-600">{stats?.total || 0}</div>
        <div className="text-sm text-gray-600">الإجمالي</div>
      </div>
      
      <div className="bg-white p-4 rounded-lg text-center border border-gray-200">
        <div className="text-2xl font-bold text-indigo-600">{stats?.male || 0}</div>
        <div className="text-sm text-gray-600">ذكور</div>
      </div>
      
      <div className="bg-white p-4 rounded-lg text-center border border-gray-200">
        <div className="text-2xl font-bold text-pink-600">{stats?.female || 0}</div>
        <div className="text-sm text-gray-600">إناث</div>
      </div>
      
      {category === 'transfers-in' && stats?.filesRequested !== undefined && (
        <div className="bg-white p-4 rounded-lg text-center border border-gray-200">
          <div className="text-2xl font-bold text-green-600">{stats.filesReceived || 0}</div>
          <div className="text-sm text-gray-600">ملفات متوصل بها</div>
        </div>
      )}
    </div>
  );
};

// مكون إدارة الملفات للوافدين
const FileManagementSection: React.FC = () => {
  const [files, setFiles] = useState<any[]>([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  // توليد نموذج طلب ملف مدرسي
  const generateFileRequest = async (student: any) => {
    try {
      const content = `
        <div style="font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 20mm; line-height: 1.6;">
          <div style="text-align: center; margin-bottom: 20mm;">
            <h1 style="font-size: 18px; font-weight: bold; color: #1e40af;">طلب ملف مدرسي</h1>
            <p style="font-size: 12px; color: #374151;">المملكة المغربية - وزارة التربية الوطنية والتعليم الأولي والرياضة</p>
          </div>
          
          <div style="margin-bottom: 15mm;">
            <p><strong>إلى السيد(ة) مدير(ة) المؤسسة:</strong> ${student.fromInstitution || '........................'}</p>
            <p style="margin-top-right: 10mm;"><strong>الموضوع:</strong> طلب ملف مدرسي</p>
          </div>
          
          <div style="margin-bottom: 15mm;">
            <p >تحية طيبة وبعد،</p>
            <p style="margin-top: 5mm;">نرجو منكم التكرم بإرسال الملف المدرسي للتلميذ(ة):</p>
          </div>
          
          <div style="border: 2px solid #374151; padding: 10mm; margin-bottom: 15mm; background: #f9fafb;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10mm;">
              <div>
                <p><strong>الاسم الكامل:</strong> ${student.firstName} ${student.lastName}</p>
                <p><strong>الرقم الوطني:</strong> ${student.nationalId}</p>
              </div>
              <div>
                <p><strong>المستوى:</strong> ${student.level}</p>
                <p><strong>القسم:</strong> ${student.section}</p>
              </div>
            </div>
          </div>
          
          <div style="margin-bottom: 15mm;">
            <p>وذلك لاستكمال إجراءات تسجيله(ها) بمؤسستنا للموسم الدراسي الحالي.</p>
            <p style="margin-top: 5mm;">نشكركم مسبقاً على تعاونكم، وتقبلوا فائق الاحترام والتقدير.</p>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20mm; margin-top: 20mm;">
            <div style="text-align: center;">
              <p><strong>تاريخ الطلب:</strong> ${new Date().toLocaleDateString('fr-EG')}</p>
            </div>
            <div style="text-align: center;">
              <p><strong>مدير(ة) المؤسسة</strong></p>
              <div style="margin-top: 15mm; border-bottom: 1px solid #000; width: 60mm; margin: 15mm auto 0;"></div>
            </div>
          </div>
        </div>
      `;

      // تحويل إلى PDF وتحميل
      const printElement = document.createElement('div');
      printElement.innerHTML = content;
      printElement.style.position = 'absolute';
      printElement.style.left = '-9999px';
      printElement.style.top = '0';
      printElement.style.width = '210mm';
      printElement.style.background = 'white';
      document.body.appendChild(printElement);

      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const canvas = await html2canvas(printElement, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff'
        });

        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`طلب_ملف_مدرسي_${student.firstName}_${student.lastName}.pdf`);
        
      } finally {
        document.body.removeChild(printElement);
      }
      
    } catch (error) {
      console.error('خطأ في توليد نموذج الطلب:', error);
      alert('خطأ في توليد نموذج الطلب');
    }
  };

  return (
    <div>
      <h4 className="font-medium text-gray-900 mb-3">تدبير ملفات الوافدين</h4>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white p-3 rounded-lg text-center border">
          <div className="text-lg font-bold text-blue-600">{files.length}</div>
          <div className="text-xs text-gray-600">ملفات مطلوبة</div>
        </div>
        
        <div className="bg-white p-3 rounded-lg text-center border">
          <div className="text-lg font-bold text-green-600">{files.filter(f => f.received).length}</div>
          <div className="text-xs text-gray-600">ملفات متوصل بها</div>
        </div>
      </div>
      
      <button
        onClick={() => setShowRequestForm(true)}
        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm"
      >
        إدارة طلبات الملفات
      </button>
    </div>
  );
};

const StudentMobilityManagement: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('transfers-out');
  const [files, setFiles] = useState<File[]>([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('2025/2026');
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progressData, setProgressData] = useState({
    progress: 0,
    status: 'idle' as 'loading' | 'success' | 'error' | 'idle',
    message: '',
    estimatedTime: 0,
    details: null as any
  });

  // فئات حركية التلاميذ
  const mobilityCategories: MobilityCategory[] = [
    {
      id: 'transfers-out',
      name: 'المغادرون',
      icon: ArrowRightLeft,
      color: 'blue',
      description: '',
      excelColumns: ['رقم التلميذ', 'النسب', 'الاسم', 'تاريخ المغادرة', 'المؤسسة المستقبلة', 'الإقليم المستقبل', 'الأكاديمية المستقبلة'],
      metadataFields: ['الأكاديمية (C5)', 'المديرية (C6)', 'المستوى (C7)', 'الجماعة (G5)', 'المؤسسة (G6)', 'السنة الدراسية (G7)']
    },
    {
      id: 'transfers-in',
      name: 'الوافدون',
      icon: UserPlus,
      color: 'green',
      description: '',
      excelColumns: ['رقم التلميذ', 'النسب', 'الاسم', 'تاريخ التحويل', 'نوع التحويل', 'المؤسسة الأصلية', 'المديرية الأصلية', 'الأكاديمية الأصلية'],
      metadataFields: ['الأكاديمية (C5)', 'المديرية (C6)', 'المستوى (C7)', 'الجماعة (G5)', 'المؤسسة (G6)', 'السنة الدراسية (G7)']
    },
    {
      id: 'dropouts',
      name: 'المنقطعون',
      icon: UserMinus,
      color: 'orange',
      description: '',
      excelColumns: ['رقم التلميذ', 'النسب', 'الاسم', 'النوع', 'تاريخ الازدياد', 'مكان الازدياد', 'تاريخ الانقطاع'],
      metadataFields: ['الأكاديمية (C5)', 'المديرية (C6)', 'المستوى (C7)', 'الجماعة (G5)', 'المؤسسة (G6)', 'السنة الدراسية (G7)']
    },
    {
      id: 'dismissed',
      name: 'المفصولون',
      icon: UserX,
      color: 'red',
      description: '',
      excelColumns: ['رقم التلميذ', 'النسب', 'الاسم', 'النوع', 'تاريخ الازدياد', 'مكان الازدياد', 'تاريخ الفصل'],
      metadataFields: ['الأكاديمية (C5)', 'المديرية (C6)', 'المستوى (C7)', 'الجماعة (G5)', 'المؤسسة (G6)', 'السنة الدراسية (G7)']
    },
    {
      id: 'reintegration',
      name: 'المدمجون',
      icon: RotateCcw,
      color: 'purple',
      description: '',
      excelColumns: ['رقم التلميذ', 'النسب', 'الاسم', 'تاريخ الإدماج', 'الحالة السابقة'],
      metadataFields: ['الأكاديمية (C5)', 'المديرية (C6)', 'المستوى (C7)', 'الجماعة (G5)', 'المؤسسة (G6)', 'السنة الدراسية (G7)']
    },
    {
      id: 'unenrolled',
      name: 'غير الملتحقين',
      icon: UserX,
      color: 'gray',
      description: '',
      excelColumns: ['رقم التلميذ', 'النسب', 'الاسم', 'النوع', 'تاريخ الازدياد', 'مكان الازدياد'],
      metadataFields: ['الأكاديمية (C5)', 'المديرية (C6)', 'المستوى (C7)', 'القسم (C8)', 'الجماعة (G5)', 'المؤسسة (G6)', 'السنة الدراسية (G7)']
    }
  ];

  useEffect(() => {
    loadAcademicYears();
  }, []);

  // تحميل السنوات الدراسية
  const loadAcademicYears = async () => {
    try {
      const years = await dbManager.getAcademicYears();
      setAcademicYears(years);
      
      // تعيين السنة الحالية كافتراضية
      const currentYear = await dbManager.getCurrentAcademicYear();
      setSelectedAcademicYear(currentYear);
    } catch (error) {
      console.error('خطأ في تحميل السنوات الدراسية:', error);
    }
  };

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

  // قراءة البيانات الوصفية من الملف
  const readMetadata = (worksheet: XLSX.WorkSheet) => {
    return {
      academy: getCellValue(worksheet, 'C5'),
      directorate: getCellValue(worksheet, 'C6'),
      level: getCellValue(worksheet, 'C7'),
      municipality: getCellValue(worksheet, 'G5'),
      institution: getCellValue(worksheet, 'G6'),
      academicYear: getCellValue(worksheet, 'G7')
    };
  };

  // معالجة استيراد البيانات
  const handleImport = async () => {
    if (files.length === 0) return;

    setLoading(true);
    const startTime = Date.now();
    setProgressData({
      progress: 0,
      status: 'loading',
      message: 'جاري قراءة ملفات حركية التلاميذ...',
      estimatedTime: 0,
      details: null
    });

    try {
      let totalSuccess = 0;
      let totalErrors = 0;
      let totalDuplicates = 0;
      const allDetails: string[] = [];
      let totalRecords = 0;
      let processedFiles = 0;

      // حساب إجمالي السجلات
      for (const file of files) {
        try {
          const workbook = await readExcelFile(file);
          for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z1000');
            
            // عد الصفوف من 11 إلى نهاية البيانات
            for (let rowIndex = 10; rowIndex <= range.e.r; rowIndex++) {
              const studentId = getCellValue(worksheet, `A${rowIndex + 1}`);
              if (studentId) {
                totalRecords++;
              }
            }
          }
        } catch (error) {
          console.warn(`خطأ في قراءة الملف ${file.name}:`, error);
        }
      }

      setProgressData(prev => ({
        ...prev,
        message: `جاري معالجة ${totalRecords} سجل من ${files.length} ملف...`,
        details: {
          total: totalRecords,
          processed: 0,
          success: 0,
          errors: 0,
          duplicates: 0
        }
      }));

      let processedCount = 0;

      // معالجة جميع الملفات
      for (const file of files) {
        try {
          allDetails.push(`📁 معالجة الملف: ${file.name}`);
          const workbook = await readExcelFile(file);
          
          for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            const metadata = readMetadata(worksheet);
            
            allDetails.push(`📋 معالجة ورقة العمل: ${sheetName} من ${file.name}`);
            
            const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z1000');
            
            // معالجة كل صف من الصف 11
            for (let rowIndex = 10; rowIndex <= range.e.r; rowIndex++) {
              try {
                const studentId = getCellValue(worksheet, `A${rowIndex + 1}`);
                const lastName = getCellValue(worksheet, `B${rowIndex + 1}`);
                const firstName = getCellValue(worksheet, `C${rowIndex + 1}`);
                
                if (!studentId) continue;

                processedCount++;
                const progress = Math.round((processedCount / totalRecords) * 100);
                const estimatedTime = totalRecords > 0 ? 
                  ((Date.now() - startTime) / processedCount) * (totalRecords - processedCount) / 1000 : 0;

                // معالجة حسب نوع الفئة
                await processMobilityRecord(activeCategory, {
                  studentId,
                  lastName,
                  firstName,
                  worksheet,
                  rowIndex: rowIndex + 1,
                  metadata,
                  academicYear: selectedAcademicYear
                });

                totalSuccess++;
                allDetails.push(`✅ تم معالجة: ${firstName} ${lastName} - ${studentId} (${file.name} - ${sheetName})`);

                setProgressData({
                  progress,
                  status: 'loading',
                  message: `جاري معالجة ${processedCount}/${totalRecords} سجل...`,
                  estimatedTime,
                  details: {
                    total: totalRecords,
                    processed: processedCount,
                    success: totalSuccess,
                    errors: totalErrors,
                    duplicates: totalDuplicates
                  }
                });

                if (processedCount % 10 === 0) {
                  await new Promise(resolve => setTimeout(resolve, 50));
                }

              } catch (error) {
                totalErrors++;
                const studentId = getCellValue(worksheet, `A${rowIndex + 1}`);
                allDetails.push(`❌ خطأ في معالجة السجل ${studentId} (${file.name} - ${sheetName}): ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
              }
            }
          }
          
          processedFiles++;
          allDetails.push(`✅ تم الانتهاء من معالجة الملف: ${file.name}`);
          
        } catch (error) {
          totalErrors++;
          allDetails.push(`❌ خطأ في معالجة الملف ${file.name}: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
        }
      }

      setProgressData({
        progress: 100,
        status: 'success',
        message: 'تم استيراد بيانات حركية التلاميذ بنجاح!',
        estimatedTime: 0,
        details: {
          total: totalRecords,
          processed: totalRecords,
          success: totalSuccess,
          errors: totalErrors,
          duplicates: totalDuplicates
        }
      });

      setResult({
        success: totalSuccess,
        errors: totalErrors,
        duplicates: totalDuplicates,
        details: allDetails
      });

    } catch (error) {
      console.error('خطأ في استيراد بيانات الحركية:', error);
      
      setProgressData({
        progress: 0,
        status: 'error',
        message: 'حدث خطأ أثناء استيراد بيانات الحركية',
        estimatedTime: 0,
        details: null
      });

      setResult({
        success: 0,
        errors: 1,
        duplicates: 0,
        details: [`❌ خطأ في قراءة الملفات: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`]
      });
    } finally {
      setLoading(false);
    }
  };

  // معالجة سجل حركية حسب النوع
  const processMobilityRecord = async (category: string, data: any) => {
    const { studentId, lastName, firstName, worksheet, rowIndex, metadata, academicYear } = data;

    // تطبيع قيمة النوع
    const normalizeGender = (genderValue: string): 'ذكر' | 'أنثى' => {
      if (!genderValue) return 'ذكر';
      
      const normalized = genderValue.trim().toLowerCase();
      
      // التحقق من القيم المختلفة للذكر
      if (normalized === 'ذكر' || normalized === 'male' || normalized === 'm' || normalized === 'ذ') {
        return 'ذكر';
      }
      
      // التحقق من القيم المختلفة للأنثى
      if (normalized === 'أنثى' || normalized === 'female' || normalized === 'f' || normalized === 'أ') {
        return 'أنثى';
      }
      
      // القيمة الافتراضية
      return 'ذكر';
    };

    // التحقق من وجود التلميذ في قاعدة البيانات أولاً (بالرقم الوطني - رمز مسار)
    let existingStudent = await dbManager.getStudentByNationalId(studentId);
    
    if (!existingStudent) {
      // إذا لم يوجد التلميذ، قم بإنشائه أولاً بالبيانات الأساسية والوصفية
      const rawGender = getCellValue(worksheet, `D${rowIndex}`) || 'ذكر';
      const normalizedGender = normalizeGender(rawGender);
      
      const newStudentData = {
        firstName: firstName || '',
        lastName: lastName || '',
        nationalId: studentId,
        gender: normalizedGender,
        birthPlace: getCellValue(worksheet, `F${rowIndex}`) || '',
        dateOfBirth: formatDate(getCellValue(worksheet, `E${rowIndex}`)),
        email: '',
        phone: '',
        studentId: studentId,
        grade: metadata.level || '',
        section: metadata.section || '',
        level: metadata.level || '',
        enrollmentDate: new Date().toISOString().split('T')[0],
        address: '',
        emergencyContact: '',
        emergencyPhone: '',
        guardianName: '',
        guardianPhone: '',
        guardianRelation: '',
        socialSupport: false,
        transportService: false,
        medicalInfo: '',
        notes: `مستورد من حركية ${category} - ${metadata.institution || ''}`,
        status: 'متمدرس' as any,
        ageGroup: calculateAgeGroup(formatDate(getCellValue(worksheet, `E${rowIndex}`))),
        schoolType: metadata.schoolType || '',
        academicYear: academicYear,
        region: metadata.region || '',
        province: metadata.province || '',
        municipality: metadata.municipality || '',
        institution: metadata.institution || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await dbManager.addStudent(newStudentData);
      existingStudent = await dbManager.getStudentByNationalId(studentId);
      
      if (!existingStudent) {
        throw new Error(`فشل في إنشاء التلميذ برقم وطني ${studentId}`);
      }
    }
    
    // تحديث بيانات التلميذ بالمعلومات الوصفية الجديدة
    const updatedStudentData = {
      level: metadata.level || existingStudent.level,
      section: metadata.section || existingStudent.section,
      grade: metadata.level || existingStudent.grade,
      region: metadata.region || existingStudent.region,
      province: metadata.province || existingStudent.province,
      municipality: metadata.municipality || existingStudent.municipality,
      institution: metadata.institution || existingStudent.institution,
      academicYear: academicYear,
      updatedAt: new Date().toISOString()
    };
    
    await dbManager.updateStudent(existingStudent.id, updatedStudentData);
    
    switch (category) {
      case 'transfers-out':
      case 'transfers-in':
        // التحقق من وجود نقل سابق لنفس التلميذ في نفس السنة (منع التراكم)
        const existingTransfers = await dbManager.getTransfers();
        const duplicateTransfer = existingTransfers.find(t => 
          t.student_id === studentId && 
          t.transfer_type === (category === 'transfers-out' ? 'مغادر' : 'وافد') &&
          t.metadata && 
          JSON.parse(t.metadata).academicYear === academicYear
        );
        
        if (duplicateTransfer) {
          // تحديث السجل الموجود بدلاً من إضافة جديد
          await dbManager.updateTransfer(duplicateTransfer.transfer_id, {
            from_school: category === 'transfers-out' ? metadata.institution : getCellValue(worksheet, `F${rowIndex}`),
            to_school: category === 'transfers-out' ? getCellValue(worksheet, `E${rowIndex}`) : metadata.institution,
            transfer_date: getCellValue(worksheet, `D${rowIndex}`),
            to_province: getCellValue(worksheet, `F${rowIndex}`),
            to_academy: getCellValue(worksheet, `G${rowIndex}`),
            metadata: {
              ...metadata,
              academicYear,
              lastName,
              firstName,
              gender: existingStudent.gender,
              level: metadata.level || existingStudent.level,
              section: metadata.section || existingStudent.section,
              updated: true
            }
          });
          return; // الخروج من الدالة بعد التحديث
        }
        
        const transferDate = getCellValue(worksheet, `D${rowIndex}`);
        const fromSchool = category === 'transfers-out' ? metadata.institution : getCellValue(worksheet, `F${rowIndex}`);
        const toSchool = category === 'transfers-out' ? getCellValue(worksheet, `E${rowIndex}`) : metadata.institution;
        const toProvince = getCellValue(worksheet, `F${rowIndex}`);
        const toAcademy = getCellValue(worksheet, `G${rowIndex}`);
        
        await dbManager.addTransfer({
          student_id: studentId,
          transfer_type: category === 'transfers-out' ? 'مغادر' : 'وافد',
          from_school: fromSchool,
          to_school: toSchool,
          transfer_date: transferDate,
          to_province: toProvince,
          to_academy: toAcademy,
          metadata: {
            ...metadata,
            academicYear,
            lastName,
            firstName,
            gender:existingStudent.gender,
            level: existingStudent.level,
            section: existingStudent.section
          }
        });
        
        // تحديث حالة التلميذ في الجدول الرئيسي
        if (category === 'transfers-out') {
          await dbManager.updateStudent(existingStudent.id, { status: 'منقول' });
        } else {
          await dbManager.updateStudent(existingStudent.id, { status: 'متمدرس' });
        }
        break;

      case 'dropouts':
        // التحقق من وجود سجل انقطاع سابق (منع التراكم)
        const existingDropouts = await dbManager.getDropouts();
        const duplicateDropout = existingDropouts.find(d => 
          d.student_id === studentId &&
          d.metadata && 
          JSON.parse(d.metadata).academicYear === academicYear
        );
        
        if (duplicateDropout) {
          // تحديث السجل الموجود بدلاً من إضافة جديد
          await dbManager.updateDropout(duplicateDropout.dropout_id, {
            dropout_date: getCellValue(worksheet, `G${rowIndex}`),
            reason: 'انقطاع عن الدراسة - محدث',
            metadata: {
              ...metadata,
              academicYear,
              lastName,
              firstName,
              gender: getCellValue(worksheet, `D${rowIndex}`) || existingStudent.gender,
              dateOfBirth: getCellValue(worksheet, `E${rowIndex}`),
              birthPlace: getCellValue(worksheet, `F${rowIndex}`),
              level: metadata.level || existingStudent.level,
              section: metadata.section || existingStudent.section,
              updated: true
            }
          });
          return; // الخروج من الدالة بعد التحديث
        }
        
        const dropoutDate = getCellValue(worksheet, `G${rowIndex}`);
        await dbManager.addDropout({
          student_id: studentId,
          dropout_date: dropoutDate,
          reason: 'انقطاع عن الدراسة',
          metadata: {
            ...metadata,
            academicYear,
            lastName,
            firstName,
            gender: normalizeGender(getCellValue(worksheet, `D${rowIndex}`) || 'ذكر'),
            dateOfBirth: getCellValue(worksheet, `E${rowIndex}`),
            birthPlace: getCellValue(worksheet, `F${rowIndex}`),
            level: existingStudent.level,
            section: existingStudent.section
          }
        });
        
        // تحديث حالة التلميذ
        await dbManager.updateStudent(existingStudent.id, { status: 'منقطع' });
        break;

      case 'dismissed':
        // التحقق من وجود سجل فصل سابق (منع التراكم)
        const existingDismissed = await dbManager.getDismissedStudents();
        const duplicateDismissed = existingDismissed.find(d => 
          d.student_id === studentId &&
          d.metadata && 
          JSON.parse(d.metadata).academicYear === academicYear
        );
        
        if (duplicateDismissed) {
          // تحديث السجل الموجود بدلاً من إضافة جديد
          await dbManager.updateDismissedStudent(duplicateDismissed.dismissal_id, {
            dismissal_date: getCellValue(worksheet, `G${rowIndex}`),
            reason: 'فصل إداري - محدث',
            metadata: {
              ...metadata,
              academicYear,
              lastName,
              firstName,
              gender: getCellValue(worksheet, `D${rowIndex}`) || existingStudent.gender,
              dateOfBirth: getCellValue(worksheet, `E${rowIndex}`),
              birthPlace: getCellValue(worksheet, `F${rowIndex}`),
              level: metadata.level || existingStudent.level,
              section: metadata.section || existingStudent.section,
              updated: true
            }
          });
          return; // الخروج من الدالة بعد التحديث
        }
        
        const dismissalDate = getCellValue(worksheet, `G${rowIndex}`);
        await dbManager.addDismissedStudent({
          student_id: studentId,
          dismissal_date: dismissalDate,
          reason: 'فصل إداري',
          metadata: {
            ...metadata,
            academicYear,
            lastName,
            firstName,
            gender: normalizeGender(getCellValue(worksheet, `D${rowIndex}`) || 'ذكر'),
            dateOfBirth: getCellValue(worksheet, `E${rowIndex}`),
            birthPlace: getCellValue(worksheet, `F${rowIndex}`),
            level: existingStudent.level,
            section: existingStudent.section
          }
        });
        
        // تحديث حالة التلميذ
        await dbManager.updateStudent(existingStudent.id, { status: 'مفصول' });
        break;

      case 'reintegration':
        // التحقق من وجود سجل إدماج سابق (منع التراكم)
        const existingReintegrations = await dbManager.getReintegrations();
        const duplicateReintegration = existingReintegrations.find(r => 
          r.student_id === studentId &&
          r.metadata && 
          JSON.parse(r.metadata).academicYear === academicYear
        );
        
        if (duplicateReintegration) {
          // تحديث السجل الموجود بدلاً من إضافة جديد
          await dbManager.updateReintegration(duplicateReintegration.reintegration_id, {
            reintegration_date: getCellValue(worksheet, `D${rowIndex}`),
            previous_status: getCellValue(worksheet, `E${rowIndex}`),
            metadata: {
              ...metadata,
              academicYear,
              lastName,
              firstName,
              gender: existingStudent.gender,
              level: metadata.level || existingStudent.level,
              section: metadata.section || existingStudent.section,
              updated: true
            }
          });
          return; // الخروج من الدالة بعد التحديث
        }
        
        const reintegrationDate = getCellValue(worksheet, `D${rowIndex}`);
        const previousStatus = getCellValue(worksheet, `E${rowIndex}`);
        await dbManager.addReintegration({
          student_id: studentId,
          reintegration_date: reintegrationDate,
          previous_status: previousStatus,
          metadata: {
            ...metadata,
            academicYear,
            lastName,
            firstName,
            gender: existingStudent.gender,
            level: metadata.level || existingStudent.level,
            section: metadata.section || existingStudent.section
          }
        });
        
        // تحديث حالة التلميذ إلى متمدرس
        await dbManager.updateStudent(existingStudent.id, { status: 'متمدرس' });
        break;

      case 'unenrolled':
        // التحقق من وجود سجل عدم التحاق سابق (منع التراكم)
        const existingUnenrolled = await dbManager.getUnenrolledStudents();
        const duplicateUnenrolled = existingUnenrolled.find(u => 
          u.student_id === studentId &&
          u.metadata && 
          JSON.parse(u.metadata).academicYear === academicYear
        );
        
        if (duplicateUnenrolled) {
          // تحديث السجل الموجود بدلاً من إضافة جديد
          await dbManager.updateUnenrolledStudent(duplicateUnenrolled.unenrolled_id, {
            lastName,
            firstName,
            gender: getCellValue(worksheet, `D${rowIndex}`) || existingStudent.gender,
            dateOfBirth: getCellValue(worksheet, `E${rowIndex}`),
            birthPlace: getCellValue(worksheet, `F${rowIndex}`),
            metadata: {
              ...metadata,
              academicYear,
              section: metadata.section || getCellValue(worksheet, 'C8') || existingStudent.section,
              level: metadata.level || existingStudent.level,
              updated: true
            }
          });
          return; // الخروج من الدالة بعد التحديث
        }
        
        await dbManager.addUnenrolledStudent({
          student_id: studentId,
          lastName,
          firstName,
          gender: normalizeGender(getCellValue(worksheet, `D${rowIndex}`) || 'ذكر'),
          dateOfBirth: getCellValue(worksheet, `E${rowIndex}`),
          birthPlace: getCellValue(worksheet, `F${rowIndex}`),
          metadata: {
            ...metadata,
            academicYear,
            section: metadata.section || getCellValue(worksheet, 'C8'),
            level: existingStudent.level
          }
        });
        
        // تحديث حالة التلميذ
        await dbManager.updateStudent(existingStudent.id, { status: 'غير ملتحق' });
        break;
    }
  };

  // تنزيل نموذج Excel
  const downloadTemplate = async () => {
    const category = mobilityCategories.find(c => c.id === activeCategory);

    let templateData: any[][] = [];

    // إنشاء البيانات الوصفية في الأعلى
    templateData = [
      ['', '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['', '', 'الأكاديمية الجهوية للتربية والتكوين', '', '', '', 'الجماعة'],
      ['', '', 'المديرية الإقليمية', '', '', '', 'المؤسسة'],
      ['', '', 'المستوى', '', '', '', 'السنة الدراسية'],
      ['', '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      category.excelColumns
    ];

    // إضافة بيانات تجريبية
    switch (activeCategory) {
      case 'transfers-out':
        templateData.push(['M175038264', 'زينب', 'أحمد', '2025-01-18', 'ثانوية الحسن الثاني', 'سلا', 'الرباط سلا القنيطرة']);
        break;
      case 'transfers-in':
        templateData.push(['K162047183', 'عمر', 'محمد', '2025-01-25', 'ثانوية الأطلس', 'الرباط', 'الرباط سلا القنيطرة']);
        break;
      case 'dropouts':
        templateData.push(['L184029375', 'فاطمة', 'علي', 'أنثى', '2007-03-15', 'الرباط', '2025-01-20']);
        break;
      case 'dismissed':
        templateData.push(['M175038264', 'زينب', 'أحمد', 'أنثى', '2006-08-22', 'سلا', '2025-01-18']);
        break;
      case 'reintegration':
        templateData.push(['K162047183', 'عمر', 'محمد', '2025-01-25', 'منقطع']);
        break;
      case 'unenrolled':
        templateData.push(['N196051482', 'يوسف', 'حسن', 'ذكر', '2008-11-10', 'القنيطرة']);
        break;
    }

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, category.name);
    XLSX.writeFile(workbook, `نموذج_${category.name}.xlsx`);
  };
  
  // دالة تنسيق التاريخ
  const formatDate = (dateValue: any): string => {
    if (!dateValue) return '';
    
    try {
      // إذا كان التاريخ من Excel (رقم)
      if (typeof dateValue === 'number') {
        const excelDate = new Date((dateValue - 25569) * 86400 * 1000);
        return excelDate.toISOString().split('T')[0];
      }
      
      // إذا كان التاريخ نص
      if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
      
      // إذا كان كائن تاريخ
      if (dateValue instanceof Date) {
        return dateValue.toISOString().split('T')[0];
      }
      
      return '';
    } catch (error) {
      console.warn('خطأ في تنسيق التاريخ:', dateValue, error);
      return '';
    }
  };
  
  // حساب الفئة العمرية من تاريخ الميلاد
  const calculateAgeGroup = (birthDate: string): string => {
    if (!birthDate) return '';
    
    const birth = new Date(birthDate);
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear();
    
    if (age < 6) return 'أقل من 6 سنوات';
    if (age <= 11) return '6-11 سنة';
    if (age <= 14) return '12-14 سنة';
    if (age <= 17) return '15-17 سنة';
    if (age <= 22) return '18-22 سنة';
    return 'أكثر من 22 سنة';
  };

  const currentCategory = mobilityCategories.find(c => c.id === activeCategory);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* عنوان الصفحة */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
            إدارة حركية التلاميذ
          </h1>
          <p className="text-gray-600 text-lg">استيراد وتتبع المغادرين، الوافدين، المنقطعين، المفصولين، والمدمجين</p>
          <div className="mt-4 w-24 h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mx-auto"></div>
        </div>

        {/* قائمة الفئات */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {mobilityCategories.map((category) => {
            const IconComponent = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`p-4 rounded-xl text-center transition-all duration-200 ${
                  activeCategory === category.id
                    ? `bg-${category.color}-600 text-white shadow-lg transform scale-105`
                    : `bg-white text-gray-700 hover:bg-${category.color}-50 shadow-sm hover:shadow-md border border-gray-100`
                }`}
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3 ${
                  activeCategory === category.id 
                    ? 'bg-white bg-opacity-20' 
                    : `bg-${category.color}-100`
                }`}>
                  <IconComponent className={`w-6 h-6 ${
                    activeCategory === category.id 
                      ? 'text-white' 
                      : `text-${category.color}-600`
                  }`} />
                </div>
                <h3 className="font-semibold text-sm">{category.name}</h3>
              </button>
            );
          })}
        </div>

        {/* إعدادات الاستيراد */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            إعدادات الاستيراد
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                السنة الدراسية *
              </label>
              <select
                value={selectedAcademicYear}
                onChange={(e) => setSelectedAcademicYear(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {academicYears.map(year => (
                  <option key={year.id} value={year.year}>
                    {year.year} {year.isActive ? '(نشطة)' : ''}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الفئة النشطة
              </label>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <currentCategory.icon className={`w-5 h-5 text-${currentCategory.color}-600`} />
                <span className="font-medium">{currentCategory?.name}</span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              <Download className="w-4 h-4" />
              تحميل نموذج {currentCategory?.name}
            </button>
          </div>
        </div>

        {/* معلومات الفئة النشطة */}
        {currentCategory && (
          <div className={`bg-${currentCategory.color}-50 p-6 rounded-xl border border-${currentCategory.color}-200 mb-6`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 bg-${currentCategory.color}-100 rounded-lg flex items-center justify-center`}>
                <currentCategory.icon className={`w-5 h-5 text-${currentCategory.color}-600`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{currentCategory.name}</h3>
              </div>
            </div>

            {/* إحصائيات الفئة النشطة */}
            <MobilityCategoryStats 
              category={activeCategory} 
              academicYear={selectedAcademicYear} 
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">أعمدة Excel المطلوبة:</h4> 
                <div className="space-y-1">
                  {currentCategory.excelColumns.map((column, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <span className="font-mono bg-white px-2 py-1 rounded border">
                        {String.fromCharCode(65 + index)}{11}
                      </span>
                      <span className="text-gray-700">{column}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* إدارة الملفات للوافدين */}
              {activeCategory === 'transfers-in' && (
                <FileManagementSection />
              )}
            </div>
          </div>
        )}

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
              <div className={`w-16 h-16 bg-${currentCategory?.color}-100 rounded-full flex items-center justify-center mx-auto mb-4`}>
                <Upload className={`w-8 h-8 text-${currentCategory?.color}-600`} />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                رفع ملفات {currentCategory?.name}
              </h3>
              <p className="text-gray-600">اختر ملفات Excel تحتوي على بيانات {currentCategory?.name}</p>
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
                  id="mobility-file-upload"
                  multiple
                />
                <label
                  htmlFor="mobility-file-upload"
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
                onClick={handleImport}
                disabled={files.length === 0 || loading}
                className={`px-8 py-3 bg-${currentCategory?.color}-600 text-white rounded-lg hover:bg-${currentCategory?.color}-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2 mx-auto`}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    جاري الاستيراد...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    بدء استيراد {currentCategory?.name} ({files.length} ملف)
                  </>
                )}
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
              <h3 className="text-xl font-semibold text-gray-900">نتائج استيراد {currentCategory?.name}</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {result.success > 0 && (
                <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-900">نجح</span>
                  </div>
                  <p className="text-3xl font-bold text-green-600">{result.success}</p>
                  <p className="text-xs text-green-600">سجل</p>
                </div>
              )}
              
              {result.duplicates > 0 && (
                <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-4 rounded-xl border border-yellow-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <span className="font-semibold text-yellow-900">تكرار</span>
                  </div>
                  <p className="text-3xl font-bold text-yellow-600">{result.duplicates}</p>
                  <p className="text-xs text-yellow-600">مكرر</p>
                </div>
              )}
              
              {result.errors > 0 && (
                <div className="bg-gradient-to-r from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <X className="w-5 h-5 text-red-600" />
                    <span className="font-semibold text-red-900">فشل</span>
                  </div>
                  <p className="text-3xl font-bold text-red-600">{result.errors}</p>
                  <p className="text-xs text-red-600">خطأ</p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto">
              <h4 className="font-medium text-gray-900 mb-3">تفاصيل العملية:</h4>
              <div className="space-y-1">
                {result.details.map((detail, index) => (
                  <p key={index} className="text-sm text-gray-700">
                    {detail}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* معلومات إضافية */}
        <div className={`mt-8 bg-${currentCategory?.color}-50 p-6 rounded-xl border border-${currentCategory?.color}-200`}>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">متطلبات ملف Excel - {currentCategory?.name}</h3>
          <div className="space-y-2 text-gray-800">
            <p>• <strong>البداية من الصف 11:</strong> البيانات تبدأ من الصف 11 في ملف Excel</p>
            <p>• <strong>البيانات الوصفية:</strong> يتم قراءة البيانات الوصفية من الخلايا المحددة (C5-C7, G5-G7)</p>
            <p>• <strong>جميع الأوراق:</strong> سيتم معالجة جميع أوراق العمل في الملف</p>
            <p>• <strong>التحقق من التكرار:</strong> سيتم تجاهل السجلات المكررة</p>
            <p>• <strong>الربط بالتلاميذ:</strong> يتم الربط باستخدام رقم التلميذ</p>
            <p>• <strong>السنة الدراسية:</strong> سيتم حفظ البيانات للسنة المحددة</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentMobilityManagement;