import React, { useState, useEffect } from 'react';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, Users, Calendar, X, FolderOpen, BarChart3, TrendingUp, ArrowRight, ArrowLeft, Shuffle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { dbManager } from '../utils/database';
import { Student } from '../types';
import ProgressBar from './ProgressBar';

interface ImportResult {
  success: number;
  updated: number;
  errors: string[];
  warnings: string[];
  data: Student[];
  duplicates: number;
  processed: number;
}

interface ComparisonResult {
  newStudents: any[];
  leftStudents: any[];
  continuingStudents: any[];
  stats: {
    continuityRate: number;
    growthRate: number;
    totalCurrent: number;
    totalPrevious: number;
  };
}

const SchoolEnrollmentImport: React.FC = () => {
  // حالة الموسم الحالي
  const [currentFiles, setCurrentFiles] = useState<File[]>([]);
  const [currentImporting, setCurrentImporting] = useState(false);
  const [currentResult, setCurrentResult] = useState<ImportResult | null>(null);
  
  // حالة الموسم الماضي
  const [previousFiles, setPreviousFiles] = useState<File[]>([]);
  const [previousImporting, setPreviousImporting] = useState(false);
  const [previousResult, setPreviousResult] = useState<ImportResult | null>(null);
  const [selectedPreviousYear, setSelectedPreviousYear] = useState('2023/2024');
  
  // حالة المقارنة
  const [comparing, setComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  
  // حالات عامة
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [currentAcademicYear, setCurrentAcademicYear] = useState('2025/2026');
  const [dragActive, setDragActive] = useState({ current: false, previous: false });
  const [progressData, setProgressData] = useState({
    progress: 0,
    status: 'idle' as 'loading' | 'success' | 'error' | 'idle',
    message: '',
    estimatedTime: 0,
    details: null as any
  });

  useEffect(() => {
    loadAcademicYears();
  }, []);

  // تحميل السنوات الدراسية
  const loadAcademicYears = async () => {
    try {
      const years = await dbManager.getAcademicYears();
      setAcademicYears(years);
      
      const currentYear = await dbManager.getCurrentAcademicYear();
      setCurrentAcademicYear(currentYear);
    } catch (error) {
      console.error('خطأ في تحميل السنوات الدراسية:', error);
    }
  };

  // معالجة drag and drop
  const handleDrag = (e: React.DragEvent, type: 'current' | 'previous') => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(prev => ({ ...prev, [type]: true }));
    } else if (e.type === "dragleave") {
      setDragActive(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleDrop = (e: React.DragEvent, type: 'current' | 'previous') => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(prev => ({ ...prev, [type]: false }));
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => 
      file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    );
    
    if (droppedFiles.length > 0) {
      if (type === 'current') {
        setCurrentFiles(prev => [...prev, ...droppedFiles]);
        setCurrentResult(null);
      } else {
        setPreviousFiles(prev => [...prev, ...droppedFiles]);
        setPreviousResult(null);
      }
    }
  };

  // معالجة اختيار الملفات
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, type: 'current' | 'previous') => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length > 0) {
      if (type === 'current') {
        setCurrentFiles(prev => [...prev, ...selectedFiles]);
        setCurrentResult(null);
      } else {
        setPreviousFiles(prev => [...prev, ...selectedFiles]);
        setPreviousResult(null);
      }
    }
  };

  // إزالة ملف
  const removeFile = (index: number, type: 'current' | 'previous') => {
    if (type === 'current') {
      setCurrentFiles(prev => prev.filter((_, i) => i !== index));
    } else {
      setPreviousFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  // مسح جميع الملفات
  const clearFiles = (type: 'current' | 'previous') => {
    if (type === 'current') {
      setCurrentFiles([]);
      setCurrentResult(null);
    } else {
      setPreviousFiles([]);
      setPreviousResult(null);
    }
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

  // دالة مساعدة للحصول على قيمة الخلية
  const getCellValue = (worksheet: XLSX.WorkSheet, cellAddress: string): string => {
    const cell = worksheet[cellAddress];
    if (!cell || cell.v === undefined || cell.v === null) {
      return '';
    }
    return String(cell.v).trim();
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
      return '';
    }
  };

  // استيراد ملفات الموسم الحالي
  const handleCurrentImport = async () => {
    if (currentFiles.length === 0) return;

    setCurrentImporting(true);
    const startTime = Date.now();
    setProgressData({
      progress: 0,
      status: 'loading',
      message: 'جاري استيراد لوائح الموسم الحالي...',
      estimatedTime: 0,
      details: null
    });

    try {
      const allData: Student[] = [];
      const allErrors: string[] = [];
      const allWarnings: string[] = [];
      let totalProcessed = 0;
      let totalSuccess = 0;
      let totalUpdated = 0;
      let totalErrors = 0;
      let processedFiles = 0;
      let duplicateCount = 0;
      let maleCount = 0;
      let femaleCount = 0;
      let totalRecords = 0;
      const details: any = {};

      // معالجة جميع الملفات
      for (const file of currentFiles) {
        try {
          allErrors.push(`📁 معالجة الملف: ${file.name}`);
          const workbook = await readExcelFile(file);
          
          for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            
            if (!worksheet) {
              allErrors.push(`❌ ورقة العمل ${sheetName} في الملف ${file.name} فارغة أو تالفة`);
              continue;
            }
            
            // قراءة البيانات كمصفوفة للتحكم الكامل
            const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z1000');
            console.log(`📊 نطاق البيانات في ${sheetName}:`, range);
            
            let validRowsInSheet = 0;
            let emptyRowsInSheet = 0;
            let errorRowsInSheet = 0;

            // البداية من الصف 11 (فهرس 10)
            for (let rowIndex = 10; rowIndex <= range.e.r; rowIndex++) {
              try {
                // قراءة البيانات من الأعمدة المحددة
                const nationalId = getCellValue(worksheet, `B${rowIndex + 1}`);
                const lastName = getCellValue(worksheet, `C${rowIndex + 1}`);
                const firstName = getCellValue(worksheet, `D${rowIndex + 1}`);
                const gender = getCellValue(worksheet, `E${rowIndex + 1}`);
                const dateOfBirth = getCellValue(worksheet, `F${rowIndex + 1}`);
                const birthPlace = getCellValue(worksheet, `G${rowIndex + 1}`);
                const section = getCellValue(worksheet, `H${rowIndex + 1}`);
                const level = getCellValue(worksheet, `I${rowIndex + 1}`);
                
                // التحقق من الصف الفارغ
                if (!nationalId && !lastName && !firstName) {
                  emptyRowsInSheet++;
                  continue;
                }
                
                // التحقق من البيانات الأساسية
                if (!nationalId || !lastName || !firstName) {
                  errorRowsInSheet++;
                  allErrors.push(`❌ بيانات ناقصة في ${file.name} - ${sheetName} - صف ${rowIndex + 1}: الرقم الوطني أو الاسم مفقود`);
                  continue;
                }
                
                validRowsInSheet++;
                
                const studentData = {
                  nationalId: nationalId,
                  lastName: lastName,
                  firstName: firstName,
                  gender: (gender || 'ذكر') as 'ذكر' | 'أنثى',
                  dateOfBirth: formatDate(dateOfBirth),
                  birthPlace: birthPlace,
                  section: section,
                  level: level,
                  academicYear: currentAcademicYear, // تعيين السنة الحالية
                  status: 'متمدرس' as any, // تعيين الحالة كمتمدرس
                  studentId: nationalId,
                  grade: level,
                  enrollmentDate: new Date().toISOString().split('T')[0],
                  email: '',
                  phone: '',
                  address: '',
                  emergencyContact: '',
                  emergencyPhone: '',
                  guardianName: '',
                  guardianPhone: '',
                  guardianRelation: '',
                  socialSupport: false,
                  transportService: false,
                  medicalInfo: '',
                  notes: '',
                  ageGroup: '',
                  schoolType: '',
                  region: '',
                  province: '',
                  municipality: '',
                  institution: ''
                };

                // التحقق من وجود التلميذ مسبقاً
                const existingStudent = await dbManager.getStudentByNationalId(studentData.nationalId);
                
                if (existingStudent && existingStudent.academicYear === currentAcademicYear) {
                  // تحديث بيانات موجودة للموسم الحالي مع الحفاظ على المراجع
                  await dbManager.updateStudent(existingStudent.id, studentData);
                  totalUpdated++;
                  allErrors.push(`🔄 تم تحديث: ${studentData.firstName} ${studentData.lastName} - ${studentData.nationalId} - مستوى: ${studentData.level} - قسم: ${studentData.section} (${file.name} - ${sheetName})`);
                } else {
                  // إضافة تلميذ جديد للموسم الحالي
                  await dbManager.addStudent(studentData);
                  totalSuccess++;
                  allErrors.push(`✅ تم إضافة: ${studentData.firstName} ${studentData.lastName} - ${studentData.nationalId} - مستوى: ${studentData.level} - قسم: ${studentData.section} (${file.name} - ${sheetName})`);
                }

                allData.push(studentData);
                totalProcessed++;

                const progress = Math.round((processedFiles / currentFiles.length + (rowIndex - 9) / (range.e.r - 9) / currentFiles.length) * 100);
                const estimatedTime = totalRecords > 0 ? 
                  ((Date.now() - startTime) / totalProcessed) * (totalRecords - totalProcessed) / 1000 : 0;

                setProgressData({
                  progress,
                  status: 'loading',
                  message: `جاري حفظ ${totalProcessed} تلميذ للموسم ${currentAcademicYear}...`,
                  estimatedTime,
                  details: {
                    total: totalRecords,
                    processed: totalProcessed,
                    success: totalSuccess,
                    updated: totalUpdated,
                    errors: totalErrors
                  }
                });

                if (totalProcessed % 20 === 0) {
                  await new Promise(resolve => setTimeout(resolve, 50));
                }

              } catch (error) {
                totalErrors++;
                errorRowsInSheet++;
                allErrors.push(`❌ خطأ في معالجة السجل في ${file.name} - ${sheetName} - صف ${rowIndex + 1}: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
              }
            }
            
            allErrors.push(`📊 ملخص ${sheetName} من ${file.name}: ${validRowsInSheet} صحيح، ${emptyRowsInSheet} فارغ، ${errorRowsInSheet} خطأ`);
          }
          
          processedFiles++;
          allErrors.push(`✅ تم الانتهاء من معالجة الملف: ${file.name} (${totalSuccess} جديد، ${totalUpdated} محدث، ${totalErrors} خطأ)`);
          
        } catch (error) {
          totalErrors++;
          allErrors.push(`❌ خطأ في معالجة الملف ${file.name}: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
        }
      }

      // عرض ملخص المستويات والأقسام المعالجة
      const levelsProcessed = new Set(allData.map(s => s.level).filter(Boolean));
      const sectionsProcessed = new Set(allData.map(s => s.section).filter(Boolean));
      
      console.log('📚 المستويات المعالجة:', Array.from(levelsProcessed));
      console.log('📖 الأقسام المعالجة:', Array.from(sectionsProcessed));

      // تحليل نهائي مفصل
      const finalSummary = {
        ملفات_معالجة: processedFiles,
        إجمالي_السجلات_المعالجة: totalProcessed,
        نجح_الإضافة: totalSuccess,
        نجح_التحديث: totalUpdated,
        فشل: totalErrors,
        ذكور: maleCount,
        إناث: femaleCount,
        تفاصيل_الملف: details
      };
      
      console.log('📋 الملخص النهائي للاستيراد:', finalSummary);
      
      setProgressData({
        progress: 100,
        status: 'success',
        message: `تم استيراد لوائح الموسم الحالي ${currentAcademicYear} بنجاح! (${totalSuccess} جديد، ${totalUpdated} محدث)`,
        estimatedTime: 0,
        details: {
          total: totalProcessed,
          processed: totalProcessed,
          success: totalSuccess,
          updated: totalUpdated,
          errors: totalErrors
        }
      });

      setCurrentResult({
        success: totalSuccess,
        updated: totalUpdated,
        errors: allErrors,
        warnings: allWarnings,
        data: allData,
        duplicates: duplicateCount,
        processed: totalProcessed
      });

    } catch (error) {
      console.error('خطأ في استيراد الموسم الحالي:', error);
      setProgressData({
        progress: 0,
        status: 'error',
        message: `حدث خطأ أثناء استيراد الموسم الحالي: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`,
        estimatedTime: 0,
        details: null
      });
    } finally {
      setCurrentImporting(false);
    }
  };

  // استيراد ملفات الموسم الماضي
  const handlePreviousImport = async () => {
    if (previousFiles.length === 0) return;

    setPreviousImporting(true);
    const startTime = Date.now();
    setProgressData({
      progress: 0,
      status: 'loading',
      message: `جاري استيراد لوائح الموسم الماضي ${selectedPreviousYear}...`,
      estimatedTime: 0,
      details: null
    });

    try {
      const allData: Student[] = [];
      const allErrors: string[] = [];
      const allWarnings: string[] = [];
      let totalProcessed = 0;
      let successCount = 0;
      let updatedCount = 0;
      let errorCount = 0;
      let processedFiles = 0;
      let totalRecords = 0;
      let maleCount = 0;
      let femaleCount = 0;

      // حساب إجمالي السجلات من جميع الملفات
      for (const file of previousFiles) {
        try {
          const workbook = await readExcelFile(file);
          for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) continue;
            
            const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z1000');
            for (let rowIndex = 10; rowIndex <= range.e.r; rowIndex++) {
              const nationalId = getCellValue(worksheet, `B${rowIndex + 1}`);
              if (nationalId && nationalId.trim() !== '') {
                totalRecords++;
              }
            }
          }
        } catch (error) {
          console.warn(`خطأ في حساب السجلات من ${file.name}:`, error);
        }
      }

      // معالجة جميع الملفات
      for (const file of previousFiles) {
        try {
          allErrors.push(`📁 معالجة الملف: ${file.name}`);
          const workbook = await readExcelFile(file);
          
          for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            
            if (!worksheet) {
              allErrors.push(`❌ ورقة العمل ${sheetName} في الملف ${file.name} فارغة أو تالفة`);
              continue;
            }
            
            const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z1000');
            
            for (let rowIndex = 10; rowIndex <= range.e.r; rowIndex++) {
              try {
                // قراءة البيانات من الأعمدة المحددة
                const nationalId = getCellValue(worksheet, `B${rowIndex + 1}`);
                const lastName = getCellValue(worksheet, `C${rowIndex + 1}`);
                const firstName = getCellValue(worksheet, `D${rowIndex + 1}`);
                const gender = getCellValue(worksheet, `E${rowIndex + 1}`);
                const dateOfBirth = getCellValue(worksheet, `F${rowIndex + 1}`);
                const birthPlace = getCellValue(worksheet, `G${rowIndex + 1}`);
                const section = getCellValue(worksheet, `H${rowIndex + 1}`);
                const level = getCellValue(worksheet, `I${rowIndex + 1}`);
                
                // التحقق من الصف الفارغ
                if (!nationalId && !lastName && !firstName) {
                  continue;
                }
                
                // التحقق من البيانات الأساسية
                if (!nationalId || !lastName || !firstName) {
                  errorCount++;
                  allErrors.push(`❌ بيانات ناقصة في ${file.name} - ${sheetName} - صف ${rowIndex + 1}: الرقم الوطني أو الاسم مفقود`);
                  continue;
                }
                
                const studentData = {
                  nationalId: nationalId,
                  lastName: lastName,
                  firstName: firstName,
                  gender: (gender || 'ذكر') as 'ذكر' | 'أنثى',
                  dateOfBirth: formatDate(dateOfBirth),
                  birthPlace: birthPlace,
                  section: section,
                  level: level,
                  academicYear: selectedPreviousYear, // تعيين السنة الماضية
                  status: 'متمدرس' as any, // تعيين الحالة كمتمدرس
                  studentId: nationalId,
                  grade: level,
                  enrollmentDate: new Date().toISOString().split('T')[0],
                  email: '',
                  phone: '',
                  address: '',
                  emergencyContact: '',
                  emergencyPhone: '',
                  guardianName: '',
                  guardianPhone: '',
                  guardianRelation: '',
                  socialSupport: false,
                  transportService: false,
                  medicalInfo: '',
                  notes: '',
                  ageGroup: '',
                  schoolType: '',
                  region: '',
                  province: '',
                  municipality: '',
                  institution: ''
                };

                // التحقق من وجود التلميذ مسبقاً
                const existingStudent = await dbManager.getStudentByNationalId(studentData.nationalId);
                
                if (existingStudent) {
                  // تحديث البيانات الموجودة مع الحفاظ على المراجع
                  await dbManager.updateStudent(existingStudent.id, studentData);
                  updatedCount++;
                  allErrors.push(`🔄 تم تحديث: ${studentData.firstName} ${studentData.lastName} - ${studentData.nationalId} - مستوى: ${studentData.level} - قسم: ${studentData.section} (${selectedPreviousYear})`);
                } else {
                  // إضافة تلميذ جديد مع المراجع
                  await dbManager.addStudent(studentData);
                  successCount++;
                  allErrors.push(`✅ تم إضافة: ${studentData.firstName} ${studentData.lastName} - ${studentData.nationalId} - مستوى: ${studentData.level} - قسم: ${studentData.section} (${selectedPreviousYear})`);
                }

                if (studentData.gender === 'ذكر') maleCount++;
                else femaleCount++;

                allData.push(studentData);
                totalProcessed++;

                const progress = Math.round((totalProcessed / totalRecords) * 100);
                const estimatedTime = totalRecords > 0 ? 
                  ((Date.now() - startTime) / totalProcessed) * (totalRecords - totalProcessed) / 1000 : 0;

                setProgressData({
                  progress,
                  status: 'loading',
                  message: `جاري استيراد ${totalProcessed} تلميذ للموسم ${selectedPreviousYear}...`,
                  estimatedTime,
                  details: {
                    total: totalRecords,
                    processed: totalProcessed,
                    success: successCount,
                    updated: updatedCount,
                    errors: errorCount,
                    male: maleCount,
                    female: femaleCount
                  }
                });

                if (totalProcessed % 10 === 0) {
                  await new Promise(resolve => setTimeout(resolve, 50));
                }

              } catch (error) {
                errorCount++;
                allErrors.push(`❌ خطأ في معالجة السجل في ${file.name} - ${sheetName} - صف ${rowIndex + 1}: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
              }
            }
            
            allErrors.push(`📊 ملخص ${sheetName} من ${file.name}: معالج بنجاح`);
          }
          
          processedFiles++;
          allErrors.push(`✅ تم الانتهاء من معالجة الملف: ${file.name}`);
          
        } catch (error) {
          errorCount++;
          allErrors.push(`❌ خطأ في معالجة الملف ${file.name}: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
        }
      }

      setProgressData({
        progress: 100,
        status: 'success',
        message: `تم استيراد لوائح الموسم الماضي ${selectedPreviousYear} بنجاح! (${successCount} جديد، ${updatedCount} محدث)`,
        estimatedTime: 0,
        details: {
          total: totalProcessed,
          processed: totalProcessed,
          success: successCount,
          updated: updatedCount,
          errors: errorCount,
          male: maleCount,
          female: femaleCount
        }
      });

      setPreviousResult({
        success: successCount,
        updated: updatedCount,
        errors: allErrors,
        warnings: allWarnings,
        data: allData,
        duplicates: 0,
        processed: totalProcessed
      });

    } catch (error) {
      console.error('خطأ في استيراد الموسم الماضي:', error);
      setProgressData({
        progress: 0,
        status: 'error',
        message: 'حدث خطأ أثناء استيراد الموسم الماضي',
        estimatedTime: 0,
        details: null
      });
    } finally {
      setPreviousImporting(false);
    }
  };

  // إجراء المقارنة بين الموسمين
  const handleComparison = async () => {
    setComparing(true);
    setProgressData({
      progress: 0,
      status: 'loading',
      message: `جاري مقارنة الموسم ${currentAcademicYear} مع ${selectedPreviousYear}...`,
      estimatedTime: 0,
      details: null
    });

    try {
      const comparison = await dbManager.compareAcademicYears(currentAcademicYear, selectedPreviousYear);
      setComparisonResult(comparison);
      
      setProgressData({
        progress: 100,
        status: 'success',
        message: 'تم إنجاز المقارنة بنجاح!',
        estimatedTime: 0,
        details: {
          total: comparison.stats.totalCurrent + comparison.stats.totalPrevious,
          processed: comparison.stats.totalCurrent + comparison.stats.totalPrevious,
          success: comparison.continuingStudents.length,
          errors: 0
        }
      });

    } catch (error) {
      console.error('خطأ في المقارنة:', error);
      setProgressData({
        progress: 0,
        status: 'error',
        message: 'حدث خطأ أثناء المقارنة',
        estimatedTime: 0,
        details: null
      });
    } finally {
      setComparing(false);
    }
  };

  // تصدير تقرير المقارنة
  const exportComparisonReport = () => {
    if (!comparisonResult) return;

    const reportData = {
      تاريخ_التقرير: new Date().toISOString(),
      الموسم_الحالي: currentAcademicYear,
      الموسم_الماضي: selectedPreviousYear,
      الإحصائيات: comparisonResult.stats,
      التلاميذ_الجدد: comparisonResult.newStudents.map(s => ({
        الرقم_الوطني: s.nationalId,
        الاسم: `${s.firstName} ${s.lastName}`,
        النوع: s.gender,
        القسم: s.section,
        المستوى: s.level
      })),
      التلاميذ_المغادرين: comparisonResult.leftStudents.map(s => ({
        الرقم_الوطني: s.nationalId,
        الاسم: `${s.firstName} ${s.lastName}`,
        النوع: s.gender,
        القسم: s.section,
        المستوى: s.level
      })),
      التلاميذ_المستمرين: comparisonResult.continuingStudents.map(s => ({
        الرقم_الوطني: s.nationalId,
        الاسم: `${s.firstName} ${s.lastName}`,
        النوع: s.gender,
        القسم: s.section,
        المستوى: s.level
      }))
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `مقارنة_الموسمين_${currentAcademicYear}_${selectedPreviousYear}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // تنزيل نموذج Excel
  const downloadTemplate = () => {
    const templateData = [
      // صفوف فارغة حتى الصف 11
      ...Array(10).fill([]),
      // الصف 11 - العناوين
      ['رت', 'الرقم الوطني', 'النسب', 'الاسم', 'النوع', 'تاريخ الازدياد', 'مكان الازدياد', 'القسم', 'المستوى'],
      // بيانات تجريبية
      ['1', 'D131250967', 'أحمد', 'محمد', 'ذكر', '2005-03-15', 'الرباط', 'علوم', 'الثانية باك'],
      ['2', 'G159046925', 'فاطمة', 'علي', 'أنثى', '2004-07-22', 'سلا', 'آداب', 'الأولى باك'],
      ['3', 'R188026128', 'يوسف', 'حسن', 'ذكر', '2006-01-10', 'القنيطرة', 'علوم', 'الجذع المشترك']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'لائحة التلاميذ');
    XLSX.writeFile(workbook, 'نموذج_لائحة_التلاميذ.xlsx');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* عنوان الصفحة */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
            استيراد الدخول المدرسي ومقارنة المواسم
          </h1>
          <p className="text-gray-600 text-lg">استيراد لوائح التلاميذ ومقارنة الموسم الحالي مع الماضي</p>
          <div className="mt-4 w-24 h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mx-auto"></div>
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

        {/* قسم الموسم الحالي */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">استيراد الموسم الحالي ({currentAcademicYear})</h2>
              <p className="text-gray-600">استيراد لوائح التلاميذ للموسم الدراسي الحالي</p>
            </div>
          </div>

          {/* منطقة رفع ملفات الموسم الحالي */}
          <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 mb-4">
            <div
              className={`cursor-pointer flex flex-col items-center transition-all duration-200 ${
                dragActive.current ? 'scale-105 border-blue-500' : ''
              }`}
              onDragEnter={(e) => handleDrag(e, 'current')}
              onDragLeave={(e) => handleDrag(e, 'current')}
              onDragOver={(e) => handleDrag(e, 'current')}
              onDrop={(e) => handleDrop(e, 'current')}
            >
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFileSelect(e, 'current')}
                className="hidden"
                id="current-file-upload"
                multiple
              />
              <label
                htmlFor="current-file-upload"
                className="cursor-pointer flex flex-col items-center w-full"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-all duration-200 ${
                  dragActive.current ? 'bg-blue-200' : 'bg-blue-100'
                }`}>
                  <FolderOpen className={`w-6 h-6 transition-all duration-200 ${
                    dragActive.current ? 'text-blue-700' : 'text-blue-600'
                  }`} />
                </div>
                <span className="text-lg font-medium text-gray-700 mb-2">
                  ملفات الموسم الحالي {currentAcademicYear}
                </span>
                <span className="text-sm text-gray-500">
                  انقر لاختيار ملفات Excel أو اسحبها وأفلتها هنا
                </span>
              </label>
            </div>
          </div>

          {/* قائمة ملفات الموسم الحالي */}
          {currentFiles.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">ملفات الموسم الحالي ({currentFiles.length})</h4>
                <button
                  onClick={() => clearFiles('current')}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  مسح الكل
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{file.name}</p>
                        <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} ميجابايت</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(index, 'current')}
                      className="text-red-500 hover:text-red-700 p-1 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleCurrentImport}
              disabled={currentFiles.length === 0 || currentImporting}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {currentImporting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <Upload className="w-5 h-5" />
              )}
              استيراد الموسم الحالي ({currentFiles.length} ملف)
            </button>
            
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              <Download className="w-4 h-4" />
              تحميل النموذج
            </button>
          </div>
        </div>

        {/* قسم الموسم الماضي */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">استيراد الموسم الماضي</h2>
              <p className="text-gray-600">استيراد لوائح التلاميذ للموسم الدراسي الماضي للمقارنة</p>
            </div>
          </div>

          {/* اختيار السنة الماضية */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              اختيار السنة الدراسية للموسم الماضي:
            </label>
            <select
              value={selectedPreviousYear}
              onChange={(e) => setSelectedPreviousYear(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="2023/2024">2023/2024</option>
              <option value="2024/2025">2024/2025</option>
              <option value="2025/2026">2025/2026</option>
              {academicYears.filter(y => y.year !== currentAcademicYear).map(year => (
                <option key={year.id} value={year.year}>{year.year}</option>
              ))}
            </select>
          </div>

          {/* منطقة رفع ملفات الموسم الماضي */}
          <div className="border-2 border-dashed border-purple-300 rounded-lg p-6 mb-4">
            <div
              className={`cursor-pointer flex flex-col items-center transition-all duration-200 ${
                dragActive.previous ? 'scale-105 border-purple-500' : ''
              }`}
              onDragEnter={(e) => handleDrag(e, 'previous')}
              onDragLeave={(e) => handleDrag(e, 'previous')}
              onDragOver={(e) => handleDrag(e, 'previous')}
              onDrop={(e) => handleDrop(e, 'previous')}
            >
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFileSelect(e, 'previous')}
                className="hidden"
                id="previous-file-upload"
                multiple
              />
              <label
                htmlFor="previous-file-upload"
                className="cursor-pointer flex flex-col items-center w-full"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-all duration-200 ${
                  dragActive.previous ? 'bg-purple-200' : 'bg-purple-100'
                }`}>
                  <FolderOpen className={`w-6 h-6 transition-all duration-200 ${
                    dragActive.previous ? 'text-purple-700' : 'text-purple-600'
                  }`} />
                </div>
                <span className="text-lg font-medium text-gray-700 mb-2">
                  ملفات الموسم الماضي {selectedPreviousYear}
                </span>
                <span className="text-sm text-gray-500">
                  انقر لاختيار ملفات Excel أو اسحبها وأفلتها هنا
                </span>
              </label>
            </div>
          </div>

          {/* قائمة ملفات الموسم الماضي */}
          {previousFiles.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">ملفات الموسم الماضي ({previousFiles.length})</h4>
                <button
                  onClick={() => clearFiles('previous')}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  مسح الكل
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {previousFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{file.name}</p>
                        <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} ميجابايت</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(index, 'previous')}
                      className="text-red-500 hover:text-red-700 p-1 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handlePreviousImport}
            disabled={previousImporting || previousFiles.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {previousImporting ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Upload className="w-5 h-5" />
            )}
            استيراد الموسم الماضي ({previousFiles.length} ملف)
          </button>
        </div>

        {(currentResult || previousResult) && (
          <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">مقارنة الموسمين</h2>
                <p className="text-gray-600">مقارنة تفصيلية بين الموسم الحالي والماضي</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">{currentAcademicYear}</div>
                  <div className="text-sm text-gray-600">الموسم الحالي</div>
                </div>
                <ArrowRight className="w-6 h-6 text-gray-400" />
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">{selectedPreviousYear}</div>
                  <div className="text-sm text-gray-600">الموسم الماضي</div>
                </div>
              </div>
              
              <button
                onClick={handleComparison}
                disabled={comparing || !currentResult || !previousResult}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {comparing ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Shuffle className="w-5 h-5" />
                )}
                بدء المقارنة
              </button>
            </div>

            {!currentResult && !previousResult && (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">يرجى استيراد لوائح الموسمين أولاً لإجراء المقارنة</p>
              </div>
            )}
          </div>
        )}

        {/* نتائج المقارنة */}
        {comparisonResult && (
          <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">نتائج المقارنة</h3>
              </div>
              
              <button
                onClick={exportComparisonReport}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
              >
                <Download className="w-4 h-4" />
                تصدير التقرير
              </button>
            </div>

            {/* إحصائيات المقارنة */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{comparisonResult.stats.totalCurrent}</div>
                <div className="text-sm text-blue-800">الموسم الحالي</div>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-600">{comparisonResult.stats.totalPrevious}</div>
                <div className="text-sm text-purple-800">الموسم الماضي</div>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{comparisonResult.stats.continuityRate}%</div>
                <div className="text-sm text-green-800">معدل الاستمرارية</div>
              </div>
              
              <div className={`p-4 rounded-lg text-center ${
                comparisonResult.stats.growthRate >= 0 ? 'bg-emerald-50' : 'bg-red-50'
              }`}>
                <div className={`text-2xl font-bold ${
                  comparisonResult.stats.growthRate >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {comparisonResult.stats.growthRate > 0 ? '+' : ''}{comparisonResult.stats.growthRate}%
                </div>
                <div className={`text-sm ${
                  comparisonResult.stats.growthRate >= 0 ? 'text-emerald-800' : 'text-red-800'
                }`}>
                  معدل النمو
                </div>
              </div>
            </div>

            {/* جداول المقارنة */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* التلاميذ الجدد */}
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" />
                  التلاميذ الجدد ({comparisonResult.newStudents.length})
                </h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {comparisonResult.newStudents.slice(0, 10).map((student, index) => (
                    <div key={index} className="bg-white p-2 rounded border text-sm">
                      <div className="font-medium">{student.firstName} {student.lastName}</div>
                      <div className="text-gray-600">{student.nationalId} - {student.section}</div>
                    </div>
                  ))}
                  {comparisonResult.newStudents.length > 10 && (
                    <div className="text-center text-sm text-gray-500">
                      ... و {comparisonResult.newStudents.length - 10} تلميذ آخر
                    </div>
                  )}
                </div>
              </div>

              {/* التلاميذ المغادرين */}
              <div className="bg-red-50 p-4 rounded-lg">
                <h4 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  التلاميذ المغادرين ({comparisonResult.leftStudents.length})
                </h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {comparisonResult.leftStudents.slice(0, 10).map((student, index) => (
                    <div key={index} className="bg-white p-2 rounded border text-sm">
                      <div className="font-medium">{student.firstName} {student.lastName}</div>
                      <div className="text-gray-600">{student.nationalId} - {student.section}</div>
                    </div>
                  ))}
                  {comparisonResult.leftStudents.length > 10 && (
                    <div className="text-center text-sm text-gray-500">
                      ... و {comparisonResult.leftStudents.length - 10} تلميذ آخر
                    </div>
                  )}
                </div>
              </div>

              {/* التلاميذ المستمرين */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  التلاميذ المستمرين ({comparisonResult.continuingStudents.length})
                </h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {comparisonResult.continuingStudents.slice(0, 10).map((student, index) => (
                    <div key={index} className="bg-white p-2 rounded border text-sm">
                      <div className="font-medium">{student.firstName} {student.lastName}</div>
                      <div className="text-gray-600">{student.nationalId} - {student.section}</div>
                    </div>
                  ))}
                  {comparisonResult.continuingStudents.length > 10 && (
                    <div className="text-center text-sm text-gray-500">
                      ... و {comparisonResult.continuingStudents.length - 10} تلميذ آخر
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchoolEnrollmentImport;