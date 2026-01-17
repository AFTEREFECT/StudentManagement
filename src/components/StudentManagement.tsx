import React, { useState, useEffect } from 'react';
import { Plus, Search, Download, Upload, Edit, Trash2, Eye, Printer, FileText, Filter, X, Building, FileDown, Users } from 'lucide-react';
import { dbManager } from '../utils/database';
import { ExcelImporter, ExcelExporter } from '../utils/excel';
import { Student } from '../types';
import StudentForm from './StudentForm';
import StudentDetail from './StudentDetail';
import { logoManager } from '../utils/logoManager';
import ProgressBar from './ProgressBar';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const StudentManagement: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('الكل');
  const [gradeFilter, setGradeFilter] = useState<string>('الكل');
  const [levelFilter, setLevelFilter] = useState<string>('الكل');
  const [sectionFilter, setSectionFilter] = useState<string>('الكل');
  const [genderFilter, setGenderFilter] = useState<string>('الكل');
  const [showForm, setShowForm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [printingSection, setPrintingSection] = useState<string | null>(null);
  const [printProgress, setPrintProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printFilters, setPrintFilters] = useState({
    level: 'الكل',
    section: 'الكل',
    gender: 'الكل'
  });
  const [importProgress, setImportProgress] = useState({
    progress: 0,
    status: 'idle' as 'loading' | 'success' | 'error' | 'idle',
    message: '',
    estimatedTime: 0,
    details: null as any
  });
  const [showImprovedListModal, setShowImprovedListModal] = useState(false);
  const [improvedListFilters, setImprovedListFilters] = useState({
    level: 'الكل',
    section: 'الكل'
  });
  const [studentsPerPage, setStudentsPerPage] = useState<number>(38);

 const currentDate = new Date().toLocaleDateString('fr-MA');
// الحصول على اللوغو من مدير اللوغو
      const logoHTML = logoManager.getLogoHTML();
  
  // إحصائيات البحث الديناميكية
  const searchStats = {
    total: filteredStudents.length,
    male: filteredStudents.filter(s => s.gender === 'ذكر').length,
    female: filteredStudents.filter(s => s.gender === 'أنثى').length
  };

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    filterStudents();
  }, [students, searchTerm, statusFilter, gradeFilter, levelFilter, sectionFilter, genderFilter]);

  // تحميل بيانات التلاميذ
  const loadStudents = async () => {
    try {
      const studentData = await dbManager.getStudents();
      setStudents(studentData);
    } catch (error) {
      console.error('خطأ في تحميل التلاميذ:', error);
    } finally {
      setLoading(false);
    }
  };

  // تصفية التلاميذ
  const filterStudents = () => {
    let filtered = [...students];

    if (searchTerm) {
      filtered = filtered.filter(student =>
        student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.nationalId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.dateOfBirth.includes(searchTerm)
      );
    }

    if (statusFilter !== 'الكل') {
      filtered = filtered.filter(student => student.status === statusFilter);
    }

    if (gradeFilter !== 'الكل') {
      filtered = filtered.filter(student => student.grade === gradeFilter);
    }

    if (levelFilter !== 'الكل') {
      filtered = filtered.filter(student => student.level === levelFilter);
    }

    if (sectionFilter !== 'الكل') {
      filtered = filtered.filter(student => student.section === sectionFilter);
    }
    if (genderFilter !== 'الكل') {
      filtered = filtered.filter(student => student.gender === genderFilter);
    }

    setFilteredStudents(filtered);
  };

  // إضافة تلميذ جديد
  const handleAddStudent = async (studentData: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await dbManager.addStudent(studentData);
      await loadStudents();
      setShowForm(false);
    } catch (error) {
      console.error('خطأ في إضافة التلميذ:', error);
    }
  };

  // تحديث بيانات تلميذ
  const handleUpdateStudent = async (id: string, studentData: Partial<Student>) => {
    try {
      await dbManager.updateStudent(id, studentData);
      await loadStudents();
      setShowForm(false);
      setSelectedStudent(null);
    } catch (error) {
      console.error('خطأ في تحديث التلميذ:', error);
    }
  };

  // حذف تلميذ
  const handleDeleteStudent = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا التلميذ؟ سيتم حذف جميع سجلات الحضور والنقط المرتبطة به.')) {
      try {
        await dbManager.deleteStudent(id);
        await loadStudents();
      } catch (error) {
        console.error('خطأ في حذف التلميذ:', error);
      }
    }
  };

  // استيراد ملف Excel
  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('🔍 بدء تحليل ملف:', file.name, 'الحجم:', (file.size / 1024 / 1024).toFixed(2), 'MB');

    setImportProgress({
      progress: 0,
      status: 'loading',
      message: `جاري تحليل ملف ${file.name}...`,
      estimatedTime: 0,
      details: null
    });

    try {
      const importResult = await ExcelImporter.importStudents(file);
      const { students: importedStudents, details } = importResult;
      
      console.log('📊 تفاصيل التحليل:', details);
      console.log('👥 عدد التلاميذ المستخرجين:', importedStudents.length);
      
      // عرض تفاصيل التحليل للمستخدم
      if (details.errors.length > 0) {
        console.warn('⚠️ أخطاء في البيانات:', details.errors);
      }
      
      if (details.warnings.length > 0) {
        console.warn('⚠️ تحذيرات:', details.warnings);
      }
      
      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;
      let updatedCount = 0;
      let maleCount = 0;
      let femaleCount = 0;
      let duplicateCount = 0;
      const startTime = Date.now();
      const detailedErrors: string[] = [];

      setImportProgress(prev => ({
        ...prev,
        message: `جاري حفظ ${importedStudents.length} تلميذ في قاعدة البيانات...`,
        details: {
          total: importedStudents.length,
          processed: 0,
          success: 0,
          updated: 0,
          errors: 0,
          male: 0,
          female: 0
        }
      }));

      for (const student of importedStudents) {
        try {
          // التحقق من وجود التلميذ مسبقاً
          const existingStudent = await dbManager.getStudentByNationalId(student.nationalId);
          
          if (existingStudent) {
            // تحديث البيانات الموجودة
            await dbManager.updateStudent(existingStudent.id, student);
            updatedCount++;
            detailedErrors.push(`🔄 تم تحديث: ${student.firstName} ${student.lastName} - ${student.nationalId}`);
          } else {
            // إضافة تلميذ جديد
            await dbManager.addStudent(student);
            successCount++;
            detailedErrors.push(`✅ تم إضافة: ${student.firstName} ${student.lastName} - ${student.nationalId}`);
          }
          
          if (student.gender === 'ذكر') maleCount++;
          else femaleCount++;
        } catch (error) {
          errorCount++;
          const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
          detailedErrors.push(`❌ فشل في حفظ ${student.firstName} ${student.lastName} - ${student.nationalId}: ${errorMessage}`);
          
          // التحقق من سبب الخطأ
          if (errorMessage.includes('UNIQUE constraint failed')) {
            duplicateCount++;
            detailedErrors.push(`🔍 السبب: الرقم الوطني ${student.nationalId} موجود مسبقاً في قاعدة البيانات`);
          }
        }
        
        processedCount++;
        const progress = Math.round((processedCount / importedStudents.length) * 100);
        const estimatedTime = importedStudents.length > 0 ? 
          ((Date.now() - startTime) / processedCount) * (importedStudents.length - processedCount) / 1000 : 0;

        setImportProgress({
          progress,
          status: 'loading',
          message: `جاري حفظ ${processedCount}/${importedStudents.length} تلميذ...`,
          estimatedTime,
          details: {
            total: importedStudents.length,
            processed: processedCount,
            success: successCount,
            updated: updatedCount,
            errors: errorCount,
            male: maleCount,
            female: femaleCount
          }
        });

        // تأخير صغير لإظهار التقدم
        if (processedCount % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      // تحليل نهائي للنتائج
      const finalAnalysis = {
        fileAnalysis: details,
        importResults: {
          total: importedStudents.length,
          success: successCount,
          updated: updatedCount,
          errors: errorCount,
          duplicates: duplicateCount,
          male: maleCount,
          female: femaleCount
        },
        detailedLog: detailedErrors
      };
      
      console.log('📋 التحليل النهائي:', finalAnalysis);

      setImportProgress({
        progress: 100,
        status: 'success',
        message: `تم الاستيراد بنجاح! ${successCount} جديد، ${updatedCount} محدث، ${errorCount} خطأ`,
        estimatedTime: 0,
        details: {
          total: importedStudents.length,
          processed: processedCount,
          success: successCount,
          updated: updatedCount,
          errors: errorCount,
          male: maleCount,
          female: femaleCount
        }
      });
      
      // عرض تقرير مفصل في وحدة التحكم
      if (details.errors.length > 0 || details.warnings.length > 0) {
        console.group('📋 تقرير مفصل للاستيراد');
        console.log('📊 إحصائيات الملف:', {
          'إجمالي الصفوف': details.totalRows,
          'الصفوف الصحيحة': details.validRows,
          'الصفوف الفارغة': details.emptyRows,
          'التكرارات': details.duplicateRows,
          'الأخطاء': details.errorRows
        });
        
        if (details.errors.length > 0) {
          console.warn('❌ الأخطاء المكتشفة:', details.errors);
        }
        
        if (details.warnings.length > 0) {
          console.warn('⚠️ التحذيرات:', details.warnings);
        }
        console.groupEnd();
      }

      await loadStudents();
      
      // إخفاء شريط التقدم بعد 3 ثوان
      setTimeout(() => {
        setImportProgress(prev => ({ ...prev, status: 'idle' }));
      }, 3000);
      
    } catch (error) {
      console.error('خطأ في استيراد ملف Excel:', error);
      setImportProgress({
        progress: 0,
        status: 'error',
        message: `خطأ في استيراد ملف Excel: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`,
        estimatedTime: 0,
        details: null
      });
    }
  };

  // تصدير ملف Excel
  const handleExportExcel = () => {
    ExcelExporter.exportStudents(filteredStudents);
  };

  // تصدير لائحة التلاميذ بالتنسيق الرسمي
  const handleExportStudentListToExcel = async () => {
    if (filteredStudents.length === 0) {
      alert('لا توجد تلاميذ للتصدير');
      return;
    }

    try {
      // الحصول على إعدادات المؤسسة
      const settings = await dbManager.getInstitutionSettings();

      const students = filteredStudents.slice(0, studentsPerPage);
      const institutionInfo = {
        academy: settings?.academy || 'الأكاديمية الجهوية للتربية و التكوين',
        directorate: settings?.directorate || 'المديرية الإقليمية',
        institution: settings?.institution || 'المؤسسة',
        academicYear: settings?.academicYear || '2025/2026',
        level: levelFilter === 'الكل' ? 'جميع المستويات' : levelFilter,
        section: sectionFilter === 'الكل' ? 'جميع الأقسام' : sectionFilter
      };

      await ExcelExporter.exportStudentsList(students, institutionInfo);
      // تم حذف رسالة التصدير بناءً على طلب المستخدم
    } catch (error) {
      console.error('خطأ في التصدير:', error);
      alert('❌ حدث خطأ أثناء التصدير: ' + (error instanceof Error ? error.message : 'خطأ غير معروف'));
    }
  };

  // طباعة لائحة التلاميذ
  const handlePrintStudents = async () => {
    import('../utils/logoManager').then(({ logoManager }) => {
      logoManager.reloadSettings(); // تحديث إعدادات الشعار
    });
    
    if (filteredStudents.length === 0) {
      alert('لا توجد تلاميذ للطباعة');
      return;
    }

    setLoading(true);
    
    try {
      const studentsPerPage = 36; // 36 تلميذ لكل صفحة
      const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
      
      let printContent = '';
      
      const { logoManager } = await import('../utils/logoManager');
      const logoHTML = logoManager.getLogoHTML();
      
      for (let page = 0; page < totalPages; page++) {
        const startIndex = page * studentsPerPage;
        const pageStudents = filteredStudents.slice(startIndex, startIndex + studentsPerPage);
        
        const currentLevel = levelFilter !== 'الكل' ? levelFilter : null;
        const currentSection = sectionFilter !== 'الكل' ? sectionFilter : null;
        
        printContent += `
          <div class="page-container" style="page-break-after: ${page < totalPages - 1 ? 'always' : 'auto'};">
            <div style="text-align: center; margin-bottom: 20px; padding: 15px; border: 2px solid #1e40af;">
              <div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 20px;">
                <div style="text-align: center;">
                  <div style="border: 2px solid #1e40af; padding: 8px; background: white;">
                    <div style="font-size: 14px; font-weight: bold; color: #1e40af;">لائحة التلاميذ</div>
                  </div>
                  <div style="margin-top: 8px; font-size: 11px; color: #1e40af;">
                    تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}<br>
                    المستوى: ${currentLevel || 'جميع المستويات'}<br>
                    القسم: ${currentSection || 'جميع الأقسام'}<br>
                    عدد التلاميذ: ${pageStudents.length}
                  </div>
                </div>
                
           
                    <div style="width: 200px; height: 40px; background: #dc2626; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
 
                    
                      <span style="color: white; font-weight: bold; font-size: 12px;">شعار</span>
                    </div>
                  </div>
                </div>
                
               
              </div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <thead>
                <tr style="background: #1e40af; color: white;">
                  <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold; width: 6%;">رت</th>
                  <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold; width: 15%;">الرمز</th>
                  <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold; width: 15%;">النسب</th>
                  <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold; width: 15%;">الاسم</th>
                  <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold; width: 8%;">النوع</th>
                  <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold; width: 20%;">تاريخ الازدياد</th>
                  <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold; width: 21%;">مكان الازدياد</th>
                </tr>
              </thead>
              <tbody>
                ${pageStudents.map((student, index) => `
                  <tr style="${index % 2 === 0 ? 'background: #f9fafb;' : 'background: white;'}">
                    <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #000; font-weight: bold;">${startIndex + index + 1}</td>
                    <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #000; font-family: monospace;">${student.nationalId}</td>
                    <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #000; font-weight: 500;">${student.lastName}</td>
                    <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #000; font-weight: 500;">${student.firstName}</td>
                    <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #1e40af; font-weight: bold;">${student.gender}</td>
                    <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #000;">${student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('ar-EG') : ''}</td>
                    <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #000;">${student.birthPlace || ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div style="text-align: center; margin-top: 15px; font-size: 10px; color: #666; border-top: 1px solid #ddd; padding-top: 10px;">
              الصفحة ${page + 1} من ${totalPages} | إجمالي التلاميذ: ${filteredStudents.length} | ${new Date().toLocaleDateString('ar-EG')}
            </div>
          </div>
        `;
      }
      
      // إنشاء نافذة الطباعة
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html dir="rtl">
          <head>
            <meta charset="UTF-8">
            <title>لائحة التلاميذ</title>
            <style>
              body { 
                font-family: 'Cairo', Arial, sans-serif; 
                direction: rtl; 
                margin: 0; 
                padding: 0;
                background: white;
                color: #000;
              }
              .page-container { 
                padding: 15mm; 
                min-height: 297mm; 
                box-sizing: border-box;
              }
              table { 
                page-break-inside: avoid; 
                border-collapse: collapse; 
              }
              tr { 
                page-break-inside: avoid; 
                page-break-after: auto; 
              }
              thead { 
                display: table-header-group; 
              }
              @media print {
                body { margin: 0; }
                .page-container { 
                  padding: 10mm; 
                  page-break-after: always;
                }
                .page-container:last-child {
                  page-break-after: auto;
                }
              }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
          </html>
        `);
        printWindow.document.close();
        
        setTimeout(() => {
          printWindow.print();
        }, 1000);
      }
      
    } catch (error) {
      console.error('خطأ في الطباعة:', error);
      alert('حدث خطأ أثناء تحضير الطباعة');
    } finally {
      setLoading(false);
    }
  };

  // طباعة الأقسام منفصلة
  const handlePrintBySection = async () => {
    import('../utils/logoManager').then(({ logoManager }) => {
      logoManager.reloadSettings();
    });
    
    if (filteredStudents.length === 0) {
      alert('لا توجد تلاميذ للطباعة');
      return;
    }

    // تجميع التلاميذ حسب القسم والمستوى
    const studentsBySection = new Map<string, Student[]>();
    
    filteredStudents.forEach(student => {
      const sectionKey = `${student.level || 'غير محدد'}_${student.section || 'غير محدد'}`;
      if (!studentsBySection.has(sectionKey)) {
        studentsBySection.set(sectionKey, []);
      }
      studentsBySection.get(sectionKey)!.push(student);
    });

    const sections = Array.from(studentsBySection.entries());
    if (sections.length === 0) {
      alert('لا توجد أقسام للطباعة');
      return;
    }

    setLoading(true);
    setPrintProgress(0);
    
    try {
      const { logoManager } = await import('../utils/logoManager');
      const logoHTML = logoManager.getLogoHTML();
      
      let printContent = '';
      
      for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
        const [sectionKey, sectionStudents] = sections[sectionIndex];
        const [level, section] = sectionKey.split('_');
        
        setPrintingSection(`${level} - ${section}`);
        setPrintProgress(Math.round((sectionIndex / sections.length) * 100));
        
        const studentsPerPage = 36;
        const totalPages = Math.ceil(sectionStudents.length / studentsPerPage);
        
        for (let page = 0; page < totalPages; page++) {
          const startIndex = page * studentsPerPage;
          const pageStudents = sectionStudents.slice(startIndex, startIndex + studentsPerPage);
          
          printContent += `
            <div class="page-container" style="page-break-after: always;">
              <div style="text-align: center; margin-bottom: 20px; padding: 15px; border: 2px solid #1e40af;">
                <div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 20px;">
                  <div style="text-align: center;">
                    <div style="border: 2px solid #1e40af; padding: 8px; background: white;">
                      <div style="font-size: 14px; font-weight: bold; color: #1e40af;">لائحة التلاميذ</div>
                    </div>
                    <div style="margin-top: 8px; font-size: 11px; color: #1e40af;">
                      تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}<br>
                      المستوى: ${level}<br>
                      القسم: ${section}<br>
                      عدد التلاميذ: ${pageStudents.length}
                    </div>
                  </div>
      

                      
                        <span style="color: white; font-weight: bold; font-size: 12px;">شعار</span>
                      </div>
                    </div>
                  </div>
                  
                  <div style="text-align: center;">
                    
                  </div>
                </div>
              </div>
              
              <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                  <tr style="background: #1e40af; color: white;">
                    <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold; width: 6%;">رت</th>
                    <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold; width: 15%;">الرمز</th>
                    <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold; width: 15%;">النسب</th>
                    <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold; width: 15%;">الاسم</th>
                    <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold; width: 8%;">النوع</th>
                    <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold; width: 20%;">تاريخ الازدياد</th>
                    <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold; width: 21%;">مكان الازدياد</th>
                  </tr>
                </thead>
                <tbody>
                  ${pageStudents.map((student, index) => `
                    <tr style="${index % 2 === 0 ? 'background: #f9fafb;' : 'background: white;'}">
                      <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #000; font-weight: bold;">${startIndex + index + 1}</td>
                      <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #000; font-family: monospace;">${student.nationalId}</td>
                      <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #000; font-weight: 500;">${student.lastName}</td>
                      <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #000; font-weight: 500;">${student.firstName}</td>
                      <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #1e40af; font-weight: bold;">${student.gender}</td>
                      <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #000;">${student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('ar-EG') : ''}</td>
                      <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #000;">${student.birthPlace || ''}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              
              <div style="text-align: center; margin-top: 15px; font-size: 10px; color: #666; border-top: 1px solid #ddd; padding-top: 10px;">
                ${level} - ${section} | الصفحة ${page + 1} من ${totalPages} | عدد التلاميذ: ${sectionStudents.length}
              </div>
            </div>
          `;
        }
        
        // تأخير بسيط بين الأقسام
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setPrintProgress(100);
      setPrintingSection('جاري التحضير للطباعة...');
      
      // إنشاء نافذة الطباعة
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html dir="rtl">
          <head>
            <meta charset="UTF-8">
            <title>لوائح التلاميذ - جميع الأقسام</title>
            <style>
              body { 
                font-family: 'Cairo', Arial, sans-serif; 
                direction: rtl; 
                margin: 0; 
                padding: 0;
                background: white;
                color: #000;
              }
              .page-container { 
                padding: 15mm; 
                min-height: 297mm; 
                box-sizing: border-box;
              }
              table { 
                page-break-inside: avoid; 
                border-collapse: collapse; 
              }
              tr { 
                page-break-inside: avoid; 
                page-break-after: auto; 
              }
              thead { 
                display: table-header-group; 
              }
              @media print {
                body { margin: 0; }
                .page-container { 
                  padding: 10mm; 
                  page-break-after: always;
                }
                .page-container:last-child {
                  page-break-after: auto;
                }
              }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
          </html>
        `);
        printWindow.document.close();
        
        setTimeout(() => {
          printWindow.print();
        }, 1000);
      }
      
    } catch (error) {
      console.error('خطأ في الطباعة:', error);
      alert('حدث خطأ أثناء تحضير الطباعة');
    } finally {
      setLoading(false);
      setPrintingSection(null);
      setPrintProgress(0);
    }
  };

  // طباعة لائحة التلاميذ مع الشعار
  const handlePrintList = async () => {
    try {
      // الحصول على إعدادات الشعار
      const logoSettings = logoManager.getSettings();
      
      // تصفية التلاميذ حسب الفلاتر المحددة
      const studentsToProcess = getFilteredStudents();
      
      if (studentsToProcess.length === 0) {
        alert('لا توجد تلاميذ للطباعة');
        return;
      }

      // تجميع التلاميذ حسب القسم والمستوى للطباعة المنفصلة
      const sectionGroups = new Map<string, Student[]>();
      
      studentsToProcess.forEach(student => {
        const sectionKey = `${student.level}_${student.section}`;
        if (!sectionGroups.has(sectionKey)) {
          sectionGroups.set(sectionKey, []);
        }
        sectionGroups.get(sectionKey)!.push(student);
      });

      // إنشاء PDF واحد يحتوي على جميع الأقسام منفصلة
      const pdf = new jsPDF('p', 'mm', 'a4');
      let isFirstPage = true;
      let sectionIndex = 0;
      const totalSections = sectionGroups.size;

      // معالجة كل قسم منفصلاً
      for (const [sectionKey, sectionStudents] of sectionGroups) {
        const [level, section] = sectionKey.split('_');
        sectionIndex++;
        
        if (!isFirstPage) {
          pdf.addPage();
        }

        // ترتيب تلاميذ القسم أبجدياً
        const sortedSectionStudents = [...sectionStudents].sort((a, b) => 
          a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
        );

        // تقسيم تلاميذ القسم إلى صفحات (36 تلميذ لكل صفحة)
        const studentsPerPage = 30;
        const totalPagesForSection = Math.ceil(sortedSectionStudents.length / studentsPerPage);
        
        // طباعة صفحات القسم الحالي
        for (let pageIndex = 0; pageIndex < totalPagesForSection; pageIndex++) {
          if (pageIndex > 0) {
            pdf.addPage();
          }

          const startIndex = pageIndex * studentsPerPage;
          const endIndex = Math.min(startIndex + studentsPerPage, sortedSectionStudents.length);
          const pageStudents = sortedSectionStudents.slice(startIndex, endIndex);

          // إنشاء HTML للصفحة مع الشعار
          const pageHTML = `
            <div style="
              font-family: 'Cairo', Arial, sans-serif;
              direction: rtl;
              background: white;
              color: #000;
              line-height: 1.2;
              padding: 8mm;
              width: 210mm;
              min-height: 297mm;
              margin: 0 auto;
              box-sizing: border-box;
            ">
              <!-- رأس الصفحة مع الشعار -->
              <div style="text-align: center; margin-bottom: 8mm; border-bottom: 2px solid #000; padding-bottom: 5mm;">
                <div style="display: grid; grid-template-columns: 1fr 2fr 1fr; align-items: center; gap: 10mm; margin-bottom: 5mm;">
                  <!-- الشعار الأيسر -->
                  <div style="text-align: center;">
                    ${logoSettings.logoUrl ? `
                      <img 
                        src="${logoSettings.logoUrl}" 
                        alt="شعار الوزارة"
                        style="
                          width: ${logoSettings.width}px;
                          height: ${logoSettings.height}px;
                          object-fit: contain;
                          display: block;
                          margin: 0 auto;
                        "
                      />
                    ` : `
                      <div style="
                        width: ${logoSettings.width}px;
                        height: ${logoSettings.height}px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        text-align: center;
                        font-size: 8px;
                        line-height: 1.1;
                        color: #dc2626;
                        font-weight: bold;
                        margin: 0 auto;
                        border: 1px solid #dc2626;
                        border-radius: 4px;
                        padding: 2px;
                      ">
                        ${logoSettings.textContent.split('\n').map(line => `<div>${line}</div>`).join('')}
                      </div>
                    `}
                  </div>
                  
                  <!-- العنوان الوسط -->
                  <div>
                    <h1 style="color: #dc2626; font-size: 18px; margin: 0 0 3mm 0; font-weight: bold;">
                      لائحة التلاميذ
                    </h1>
                    <h2 style="color: #1e40af; font-size: 14px; margin: 0; font-weight: bold;">
                      المستوى: ${level} | القسم: ${section}
                    </h2>
                    <div style="color: #6b7280; font-size: 10px; margin-top: 2mm;">
                      القسم ${sectionIndex} من ${totalSections} | الصفحة ${pageIndex + 1} من ${totalPagesForSection}
                    </div>
                  </div>
                  
                  <!-- الشعار الأيمن -->
                  <div style="text-align: center;">
                    ${logoSettings.logoUrl ? `
                      <img 
                        src="${logoSettings.logoUrl}" 
                        alt="شعار الوزارة"
                        style="
                          width: ${logoSettings.width}px;
                          height: ${logoSettings.height}px;
                          object-fit: contain;
                          display: block;
                          margin: 0 auto;
                        "
                      />
                    ` : `
                      <div style="
                        width: ${logoSettings.width}px;
                        height: ${logoSettings.height}px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        text-align: center;
                        font-size: 8px;
                        line-height: 1.1;
                        color: #dc2626;
                        font-weight: bold;
                        margin: 0 auto;
                        border: 1px solid #dc2626;
                        border-radius: 4px;
                        padding: 2px;
                      ">
                        ${logoSettings.textContent.split('\n').map(line => `<div>${line}</div>`).join('')}
                      </div>
                    `}
                  </div>
                </div>
                
                <!-- معلومات إضافية -->
                <div style="font-size: 10px; color: #374151; margin-bottom: 3mm;">
                  <strong>السنة الدراسية:</strong> ${new Date().getFullYear()}/${new Date().getFullYear() + 1} | 
                  <strong>عدد التلاميذ في القسم:</strong> ${sortedSectionStudents.length} | 
                  <strong>تاريخ الطباعة:</strong> ${new Date().toLocaleDateString('ar-EG')}
                </div>
              </div>

              <!-- جدول التلاميذ -->
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 10mm;">
                <thead>
                  <tr style="background-color: #3b82f6; color: white;">
                    <th style="border: 1px solid #000; padding: 3mm; text-align: center; font-weight: bold;">رت</th>
                    <th style="border: 1px solid #000; padding: 3mm; text-align: center; font-weight: bold;">الرمز</th>
                    <th style="border: 1px solid #000; padding: 3mm; text-align: center; font-weight: bold;">النسب</th>
                    <th style="border: 1px solid #000; padding: 3mm; text-align: center; font-weight: bold;">الاسم</th>
                    <th style="border: 1px solid #000; padding: 3mm; text-align: center; font-weight: bold;">النوع</th>
                    <th style="border: 1px solid #000; padding: 3mm; text-align: center; font-weight: bold;">تاريخ الازدياد</th>
                    <th style="border: 1px solid #000; padding: 3mm; text-align: center; font-weight: bold;">مكان الازدياد</th>
                  </tr>
                </thead>
                <tbody>
                  ${pageStudents.map((student, index) => {
                    // ترقيم منفصل لكل قسم (يبدأ من 1 لكل قسم)
                    const studentNumber = startIndex + index + 1;
                    return `
                    <tr style="${index % 2 === 0 ? 'background-color: #f9fafb;' : 'background-color: white;'}">
                      <td style="border: 1px solid #000; padding: 2mm; text-align: center; font-weight: bold; color: #000;">${studentNumber}</td>
                      <td style="border: 1px solid #000; padding: 2mm; text-align: center; font-family: monospace; color: #000;">${student.nationalId}</td>
                      <td style="border: 1px solid #000; padding: 2mm; text-align: center; font-weight: 500; color: #000;">${student.lastName}</td>
                      <td style="border: 1px solid #000; padding: 2mm; text-align: center; font-weight: 500; color: #000;">${student.firstName}</td>
                      <td style="border: 1px solid #000; padding: 2mm; text-align: center; font-weight: bold; color: #1e40af;">${student.gender}</td>
                      <td style="border: 1px solid #000; padding: 2mm; text-align: center; color: #000;">${student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-CA') : ''}</td>
                      <td style="border: 1px solid #000; padding: 2mm; text-align: center; color: #000;">${student.birthPlace || ''}</td>
                    </tr>
                  `;
                  }).join('')}
                </tbody>
              </table>

              <!-- تذييل الصفحة -->
              <div style="position: absolute; bottom: 8mm; left: 8mm; right: 8mm; text-align: center; font-size: 8px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 3mm;">
                <p style="margin: 0;">
                  تم إنشاء هذه اللائحة بواسطة نظام إدارة التلاميذ - ${new Date().toLocaleDateString('ar-EG')} | 
                  القسم: ${section} | المستوى: ${level} | عدد التلاميذ: ${sortedSectionStudents.length}
                </p>
              </div>
            </div>
          `;

          // تحويل HTML إلى PDF
          const printElement = document.createElement('div');
          printElement.innerHTML = pageHTML;
          printElement.style.position = 'absolute';
          printElement.style.left = '-9999px';
          printElement.style.top = '0';
          printElement.style.width = '210mm';
          printElement.style.background = 'white';
          printElement.style.fontFamily = 'Cairo, Arial, sans-serif';
          printElement.style.direction = 'rtl';
          document.body.appendChild(printElement);

          try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const canvas = await html2canvas(printElement, {
              scale: 2,
              useCORS: true,
              allowTaint: true,
              backgroundColor: '#ffffff'
            });
            
            const imgData = canvas.toDataURL('image/png');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = pdfWidth;
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;
            
            // إضافة الصفحات للقسم الحالي
            let yOffset = 0;
            let pageCount = 0;
            
            while (yOffset < imgHeight) {
              if (pageCount > 0) {
                pdf.addPage();
              }
              
              pdf.addImage(imgData, 'PNG', 0, -yOffset, imgWidth, imgHeight);
              yOffset += pdfHeight;
              pageCount++;
            }
            
          } finally {
            document.body.removeChild(printElement);
          }
        }
        
        isFirstPage = false;
      }
      
      // حفظ الملف مع اسم يوضح عدد الأقسام
      const fileName = `لوائح_التلاميذ_${sectionGroups.size}_أقسام_منفصلة_${new Date().toLocaleDateString('fr-MA').replace(/\//g, '-')}.pdf`;
      pdf.save(fileName);

      // تم حذف رسالة النجاح بناءً على طلب المستخدم

    } catch (error) {
      console.error('خطأ في طباعة اللائحة:', error);
      alert('حدث خطأ في طباعة اللائحة');
    }
  };

  // طباعة لائحة التلاميذ بصيغة PDF
  const handlePrintStudentList = () => {
    setShowPrintModal(true);
  };

  // توليد محتوى HTML للطباعة - صفحة واحدة فقط
  const generatePrintableStudentListNew = (studentsForPrint: Student[], institutionInfo: any) => {
    // هذه الدالة الآن تُنشئ صفحة واحدة فقط للطلاب المعطيين
    const htmlContent = `
      <div class="page-container" style="
        font-family: 'Cairo', Arial, sans-serif;
        direction: rtl;
        background: white;
        color: #000;
        line-height: 1.2;
        padding: 5mm;
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        box-sizing: border-box;
        page-break-inside: avoid;
        position: relative;
      ">
        <!-- رأس التقرير المحسن والموحد لكل صفحة -->
        <div style="margin-bottom: 15px; page-break-inside: avoid;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <!-- معلومات المؤسسة على اليسار -->
            <div style="text-align: right; font-size: 11px; line-height: 1.3; flex: 1; color: #000000;">
              <!-- اللوغو -->
              <div style="margin-bottom: 20px; width: 200px; height: 40px;">
                ${logoHTML}
              </div>
            </div>

            <!-- الشعار والمملكة في الوسط -->
            <div style="text-align: center; flex: 1;">
              <div style="font-size: 12px; color: #000000; font-weight: 900; margin-bottom: 8px; line-height: 1.2;">
                <div style="padding: 0px; background: white; text-align: center;">
                  <h1 style="font-size: 24px; font-weight: 900; color: #000000; margin: 0;">لائحة التلاميذ</h1>
                </div>

                <div style="padding: 0px; background: white; text-align: center;">
                  <h1 style="font-size: 24px; font-weight: 900; color: #000000; margin: 0;">${printFilters.section === 'الكل' ? 'جميع الأقسام' : printFilters.section}</h1>
                </div>
              </div>
            </div>

            <!-- عنوان اللائحة على اليمين -->
            <div style="text-align: left; flex: 1;">
              <div style="text-align: center; margin-top: 2px; font-size: 11px; color: #000000;">
                <strong style="color: #000000; font-weight: 900;"></strong> ${institutionInfo.institution}

                <div style="margin-bottom: 6px;">
                  <strong style="color: #000000; font-weight: 900;">السنة الدراسية:</strong> ${institutionInfo.academicYear}

                  <div style="margin-bottom: 3px;">
                    <strong style="color: #000000; font-weight: 900;">المستوى:</strong> ${printFilters.level === 'الكل' ? 'جميع المستويات' : printFilters.level}
                    <p style="margin: 0px 0 0 0; font-weight: 900; color: #000000;">إجمالي التلاميذ: ${studentsForPrint.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- جدول التلاميذ المحسن حسب الصورة -->
        <div class="no-break" style="page-break-inside: avoid;">
          <table style="width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 10px; page-break-inside: avoid;">
            <thead style="display: table-header-group;">
              <tr style="page-break-inside: avoid; page-break-after: avoid;">
                <th style="background: #3b82f6; color: white; padding: 8px 4px; text-align: center; font-weight: 900; border: 1px solid #000; width: 6%;">رت</th>
                <th style="background: #3b82f6; color: white; padding: 8px 4px; text-align: center; font-weight: 900; border: 1px solid #000; width: 15%;">الرمز</th>
                <th style="background: #3b82f6; color: white; padding: 8px 4px; text-align: center; font-weight: 900; border: 1px solid #000; width: 15%;">النسب</th>
                <th style="background: #3b82f6; color: white; padding: 8px 4px; text-align: center; font-weight: 900; border: 1px solid #000; width: 15%;">الاسم</th>
                <th style="background: #3b82f6; color: white; padding: 8px 4px; text-align: center; font-weight: 900; border: 1px solid #000; width: 8%;">النوع</th>
                <th style="background: #3b82f6; color: white; padding: 8px 4px; text-align: center; font-weight: 900; border: 1px solid #000; width: 20%;">تاريخ الازدياد</th>
                <th style="background: #3b82f6; color: white; padding: 8px 4px; text-align: center; font-weight: 900; border: 1px solid #000; width: 21%;">مكان الازدياد</th>
              </tr>
            </thead>
            <tbody>
              ${studentsForPrint.map((student, index) => `
                <tr style="${index % 2 === 0 ? 'background: #f8fafc;' : 'background: white;'} page-break-inside: avoid;">
                  <td style="padding:8px 2px ; text-align: center; border: 1px solid #000; font-weight: 900; font-size: 13px; color: #000;">${index + 1}</td>
                  <td style="padding:  5px 2px; text-align: center; border: 1px solid #000; font-family: monospace; font-weight: 900; font-size: 14px; color: #000;">${student.nationalId}</td>
                  <td style="padding: 5px 2px; text-align: center; border: 1px solid #000; font-weight: 900; font-size: 13px; color: #000;">${student.lastName}</td>
                  <td style="padding:  5px 2px; text-align: center; border: 1px solid #000; font-weight: 900; font-size: 13px; color: #000;">${student.firstName}</td>
                  <td style="padding:  5px 2px; text-align: center; border: 1px solid #000; font-weight: 900; color: #1e40af; font-size: 10px;">${student.gender}</td>
                  <td style="padding:  5px 2px; text-align: center; border: 1px solid #000; font-weight: 900; font-size: 12px; color: #000;">${student.dateOfBirth || 'غير محدد'}</td>
                  <td style="padding:  5px 2px; text-align: center; border: 1px solid #000; font-weight: 900; font-size: 12px; color: #000;">${student.birthPlace || 'غير محدد'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    return `
      <div style="font-family: 'Cairo', Arial, sans-serif; direction: rtl;">
        ${htmlContent}
      </div>
    `;
  };

  // توليد محتوى HTML للطباعة مع دعم العربية الكامل
  // توليد HTML للقسم مع ترقيم منفصل وشعار
  const generateSectionHTML = async (sectionName: string, students: Student[], sectionNumber: number) => {
    // الحصول على الشعار من logoManager
    const logoHTML = logoManager.getLogoHTML();
    
    const studentsPerPage = 30;
    const totalPages = Math.ceil(studentsForPrint.length / studentsPerPage);
    
    let htmlContent = '';
    
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const startIndex = pageIndex * studentsPerPage;
      const endIndex = Math.min(startIndex + studentsPerPage, studentsForPrint.length);
      const pageStudents = studentsForPrint.slice(startIndex, endIndex);
      
      // إضافة فاصل صفحة قبل كل صفحة عدا الأولى
      if (pageIndex > 0) {
        htmlContent += '<div style="page-break-before: always;"></div>';
      }
      
      htmlContent += `
        <div class="page-container" style="
          font-family: 'Cairo', Arial, sans-serif;
          direction: rtl;
          background: white;
          color: #000;
          line-height: 1.2;
          padding: 10mm;
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          box-sizing: border-box;
          page-break-inside: avoid;
          position: relative;
        ">
          <!-- رأس التقرير المحسن والموحد لكل صفحة -->
          <div style="margin-bottom: 15px; page-break-inside: avoid;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
              <!-- معلومات المؤسسة على اليسار -->
              <div style="text-align: right; font-size: 11px; line-height: 1.3; flex: 1; color: #000;">
                <div style="margin-bottom: 6px;">
                  <strong style="color: #000; font-weight: 900;">الأكاديمية:</strong> ${institutionInfo.academy}
                </div>
                <div style="margin-bottom: 6px;">
                  <strong style="color: #000; font-weight: 900;">المديرية:</strong> ${institutionInfo.directorate}
                </div>
                <div style="margin-bottom: 6px;">
                  <strong style="color: #000; font-weight: 900;">المؤسسة:</strong> ${institutionInfo.institution}
                </div>
                <div style="margin-bottom: 6px;">
                  <strong style="color: #000; font-weight: 900;">السنة الدراسية:</strong> ${institutionInfo.academicYear}
                </div> 
                <div style="margin-bottom: 6px;">
                  <strong style="color: #000; font-weight: 900;">القسم:</strong> ${printFilters.section === 'الكل' ? 'جميع الأقسام' : printFilters.section}
                </div>
              </div>
  
                <div style="width: 50px; height: 50px; background: #dc2626; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 12px; margin: 0 auto; border: 2px solid #000;">
                  شعار
                </div>
              </div>
              
              <!-- عنوان اللائحة على اليمين -->
              <div style="text-align: left; flex: 1;">
                <div style="border: 3px solid #000; padding: 8px; background: white; text-align: center;">
                  <h1 style="font-size: 18px; font-weight: 900; color: #000; margin: 0;">لائحة التلاميذ</h1>
                </div>
                <div style="text-align: center; margin-top: 8px; font-size: 11px; color: #000;">
                  <div style="font-weight: 900;">تاريخ الطباعة: ${new Date().toLocaleDateString('fr-MA')}</div>
                  <div style="font-weight: 900; color: #000;">عدد التلاميذ: ${studentsForPrint.length}</div>
                  ${pageIndex > 0 ? `<div style="font-weight: 900; color: #000;">الصفحة ${pageIndex + 1} من ${totalPages}</div>` : ''}
                </div>
              </div>
            </div>
          </div>
          
          <!-- جدول التلاميذ المحسن -->
          <div class="no-break" style="page-break-inside: avoid;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; page-break-inside: avoid;">
              <thead style="display: table-header-group;">
                <tr style="page-break-inside: avoid; page-break-after: avoid;">
                  <th style="background: #000; color: white; padding: 8px 4px; text-align: center; font-weight: 900; border: 2px solid #000; width: 6%;">رت</th>
                  <th style="background: #000; color: white; padding: 8px 4px; text-align: center; font-weight: 900; border: 2px solid #000; width: 15%;">الرمز</th>
                  <th style="background: #000; color: white; padding: 8px 4px; text-align: center; font-weight: 900; border: 2px solid #000; width: 15%;">النسب</th>
                  <th style="background: #000; color: white; padding: 8px 4px; text-align: center; font-weight: 900; border: 2px solid #000; width: 15%;">الاسم</th>
                  <th style="background: #000; color: white; padding: 8px 4px; text-align: center; font-weight: 900; border: 2px solid #000; width: 8%;">النوع</th>
                  <th style="background: #000; color: white; padding: 8px 4px; text-align: center; font-weight: 900; border: 2px solid #000; width: 20%;">المستوى</th>
                  <th style="background: #000; color: white; padding: 8px 4px; text-align: center; font-weight: 900; border: 2px solid #000; width: 12%;">القسم</th>
                  <th style="background: #000; color: white; padding: 8px 4px; text-align: center; font-weight: 900; border: 2px solid #000; width: 9%;">الحالة</th>
                </tr>
              </thead>
              <tbody>
                ${pageStudents.map((student, index) => `
                  <tr style="${index % 2 === 0 ? 'background: #f8fafc;' : 'background: white;'} page-break-inside: avoid;">
                    <td style="padding: 6px 3px; text-align: center; border: 1px solid #ddd; font-weight: 900; font-size: 10px; color: #000;">${startIndex + index + 1}</td>
                    <td style="padding: 6px 3px; text-align: center; border: 1px solid #ddd; font-family: monospace; font-weight: 900; font-size: 10px; color: #000;">${student.nationalId}</td>
                    <td style="padding: 6px 3px; text-align: center; border: 1px solid #ddd; font-weight: 900; font-size: 10px; color: #000;">${student.lastName}</td>
                    <td style="padding: 6px 3px; text-align: center; border: 1px solid #ddd; font-weight: 900; font-size: 10px; color: #000;">${student.firstName}</td>
                    <td style="padding: 6px 3px; text-align: center; border: 1px solid #ddd; font-weight: 900; color: #1e40af; font-size: 10px;">${student.gender}</td>
                    <td style="padding: 6px 3px; text-align: center; border: 1px solid #ddd; font-weight: 900; font-size: 9px; color: #7c3aed;">${student.level || 'غير محدد'}</td>
                    <td style="padding: 6px 3px; text-align: center; border: 1px solid #ddd; font-weight: 900; font-size: 10px; color: #059669;">${student.section || 'غير محدد'}</td>
                    <td style="padding: 6px 3px; text-align: center; border: 1px solid #ddd; font-size: 9px;">
                      <span style="color: #000; padding: 2px 4px; font-weight: 900;">${student.status}</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <!-- تذييل الصفحة -->
          <div style="margin-top: 15px; text-align: center; font-size: 9px; color: #000; border-top: 2px solid #000; padding-top: 8px; page-break-inside: avoid;">
            <p style="margin: 2px 0 0 0; font-weight: 900; color: #000;">الصفحة ${pageIndex + 1} من ${totalPages} | إجمالي التلاميذ: ${studentsForPrint.length}</p>
          </div>
        </div>
      `;
    }
    
    return `
      <div style="font-family: 'Cairo', Arial, sans-serif; direction: rtl;">
        ${htmlContent}
      </div>
    `;
  };

  // إنشاء وتحميل ملف PDF للائحة التلاميذ
  const generatePDFStudentList = async (studentsForPrint: Student[]) => {
    const loadingIndicator = document.createElement('div');
    const elementsToCleanup: HTMLElement[] = [];

    try {
      console.log('📄 بدء إنشاء PDF لـ', studentsForPrint.length, 'تلميذ');

      const firstStudent = studentsForPrint[0];
      const institutionInfo = {
        academy: firstStudent?.region || 'الأكاديمية الجهوية للتربية والتكوين',
        directorate: firstStudent?.province || 'المديرية الإقليمية',
        municipality: firstStudent?.municipality || 'الجماعة',
        institution: firstStudent?.institution || 'المؤسسة التعليمية',
        academicYear: firstStudent?.academicYear || '2025/2026'
      };

      loadingIndicator.innerHTML = `
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: linear-gradient(135deg, #10B981, #3B82F6, #8B5CF6); color: white; padding: 20px 40px; border-radius: 10px; z-index: 9999; text-align: center; font-family: 'Cairo', Arial, sans-serif; direction: rtl; box-shadow: 0 10px 30px rgba(16, 185, 129, 0.4);">
          <div style="width: 40px; height: 40px; border: 4px solid rgba(255, 255, 255, 0.2); border-top: 4px solid #10B981; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px auto;"></div>
          <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">🖨️ جاري إنشاء لائحة التلاميذ</div>
          <div style="font-size: 14px; color: #ccc;">جاري تحضير ${studentsForPrint.length} تلميذ...</div>
          <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
        </div>
      `;
      document.body.appendChild(loadingIndicator);
      elementsToCleanup.push(loadingIndicator);

      const pdf = new jsPDF('p', 'mm', 'a4');
      const studentsPerPage = 30;
      const totalPages = Math.ceil(studentsForPrint.length / studentsPerPage);

      console.log('📊 عدد الصفحات المطلوبة:', totalPages);

      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        console.log(`📄 معالجة الصفحة ${pageIndex + 1}/${totalPages}`);

        const startIndex = pageIndex * studentsPerPage;
        const endIndex = Math.min(startIndex + studentsPerPage, studentsForPrint.length);
        const pageStudents = studentsForPrint.slice(startIndex, endIndex);

        const printElement = document.createElement('div');
        printElement.innerHTML = generatePrintableStudentListNew(pageStudents, institutionInfo);
        printElement.style.position = 'absolute';
        printElement.style.left = '-9999px';
        printElement.style.top = '0';
        printElement.style.width = '210mm';
        printElement.style.background = 'white';
        document.body.appendChild(printElement);
        elementsToCleanup.push(printElement);

        await new Promise(resolve => setTimeout(resolve, 300));

        console.log(`🎨 تحويل الصفحة ${pageIndex + 1} إلى صورة...`);
        const canvas = await html2canvas(printElement, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: 794,
          windowWidth: 794,
          logging: false
        });

        console.log(`✅ تم تحويل الصفحة ${pageIndex + 1} بنجاح`);
        document.body.removeChild(printElement);
        elementsToCleanup.splice(elementsToCleanup.indexOf(printElement), 1);

        if (pageIndex > 0) pdf.addPage();

        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;

        if (imgHeight <= pdfHeight) {
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
        } else {
          let yOffset = 0;
          let isFirst = true;
          while (yOffset < imgHeight) {
            if (!isFirst) pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, -yOffset, pdfWidth, imgHeight);
            yOffset += pdfHeight;
            isFirst = false;
          }
        }
      }

      console.log('💾 حفظ ملف PDF...');
      const fileName = `لائحة_التلاميذ_${printFilters.level !== 'الكل' ? printFilters.level.replace(/\s+/g, '_') : 'جميع_المستويات'}_${printFilters.section !== 'الكل' ? printFilters.section.replace(/\s+/g, '_') : 'جميع_الأقسام'}_${new Date().toLocaleDateString('fr-MA').replace(/\//g, '-')}.pdf`;
      pdf.save(fileName);
      console.log('✅ تم حفظ الملف بنجاح:', fileName);

    } catch (error) {
      console.error('❌ خطأ كامل في إنشاء PDF:', error);
      console.error('تفاصيل الخطأ:', error instanceof Error ? error.stack : error);
      alert('خطأ في إنشاء PDF: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      // تنظيف جميع العناصر المضافة
      console.log('🧹 تنظيف العناصر المؤقتة...');
      elementsToCleanup.forEach(element => {
        if (document.body.contains(element)) {
          document.body.removeChild(element);
        }
      });
      console.log('✅ تم التنظيف بنجاح');
    }
  };

  // الزر المعدل للوائح - توليد HTML للائحة التلاميذ حسب النموذج المغربي الرسمي
  const generateImprovedStudentListHTML = async (studentsForList: Student[], sectionName: string) => {
    // جلب إعدادات المؤسسة من قاعدة البيانات أو من أول تلميذ
    const firstStudent = studentsForList[0];
    let institutionSettings;

    try {
      const settings = await dbManager.getInstitutionSettings();
      if (settings && Object.keys(settings).length > 0) {
        institutionSettings = settings;
      } else {
        throw new Error('لا توجد إعدادات محفوظة');
      }
    } catch (error) {
      // استخدام البيانات من أول تلميذ
      institutionSettings = {
        academy: firstStudent?.region || 'الأكاديمية الجهوية للتربية والتكوين',
        directorate: firstStudent?.province || 'المديرية الإقليمية',
        municipality: firstStudent?.municipality || 'الجماعة',
        institution: firstStudent?.institution || 'المؤسسة التعليمية',
        academicYear: firstStudent?.academicYear || '2025/2026'
      };
    }

    // جلب اللوغو من مدير اللوغو
    const logoSettings = logoManager.getSettings();
    const logoDataURL = logoSettings.logoUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIGZpbGw9IiNGRjAwMDAiLz4KICA8cG9seWdvbiBwb2ludHM9IjMwLDE1IDM1LDI1IDQ1LDI1IDM3LjUsMzIgNDAsNDIgMzAsMzYgMjAsNDIgMjIuNSwzMiAxNSwyNSAyNSwyNSIgZmlsbD0iI0ZGRkZGRiIvPgo8L3N2Zz4=';
    const institutionInfo = {
      academy: institutionSettings.academy,
      directorate: institutionSettings.directorate,
      municipality: institutionSettings.municipality,
      institution: institutionSettings.institution,
      academicYear: institutionSettings.academicYear,
      level: firstStudent?.level || 'المستوى',
      section: sectionName,
      logo: logoDataURL
    };

    // تقسيم التلاميذ إلى صفحات (38 تلميذ لكل صفحة)
    const studentsPerPage = 38;
    const pages: Student[][] = [];
    for (let i = 0; i < studentsForList.length; i += studentsPerPage) {
      pages.push(studentsForList.slice(i, i + studentsPerPage));
    }
const generatePage = (pageStudents: Student[], pageNum: number, totalPages: number, startIndex: number) => `
  <div class="page">

          <div class="title" style="font-size: 20px;">لائحة التلاميذ - ${institutionInfo.level} - ${institutionInfo.section}--<strong>السنة الدراسية:</strong> ${institutionInfo.academicYear} ${totalPages > 1 ? `| <strong>الصفحة:</strong> ${pageNum}/${totalPages}` : ''}  </div>
       
        </div>
      </div>
    </div>
    <table style="width:100%; font-size: 16px; border-collapse: collapse;">
      <thead>
        <tr>
          <th style="width: 5%; font-size: 16px;">رت</th>
          <th style="width: 22%; font-size: 16px;">الاسم الكامل</th>
          <th style="width: 15%; font-size: 16px;">رمز مسار</th>
          <th style="width: 8%; font-size: 16px;">الجنس</th>
          <th style="width: 12%; font-size: 16px;">تاريخ الازدياد</th>
          <th style="width: 18%; font-size: 16px;">مكان الازدياد</th>
          <th style="width: 20%; font-size: 16px;">ملاحظات</th>
        </tr>
      </thead>
      <tbody>
        ${pageStudents.map((student, index) => `
          <tr>
            <td style="font-size: 15px;"><strong>${startIndex + index + 1}</strong></td>
            <td style="font-size: 15px;"><strong>${student.firstName} ${student.lastName}</strong></td>
            <td style="font-family: 'Courier New', monospace; font-size: 15px;"><strong>${student.nationalId || student.studentId}</strong></td>
            <td style="font-size: 15px;">${student.gender === 'ذكر' ? 'ذ' : 'أ'}</td>
            <td style="font-size: 15px;">${student.birthDate ? new Date(student.birthDate).toLocaleDateString('fr-MA') : ''}</td>
            <td style="font-size: 15px;">${student.birthPlace || ''}</td>
            <td style="font-size: 14px;"> </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="footer" style="font-size: 15px;">
      <p><strong>إجمالي التلاميذ:</strong> ${studentsForList.length} | <strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-MA')}</p>
    </div>
    ${pageNum < totalPages ? '<div class="page-break"></div>' : ''}
  </div>
`;


    // توليد HTML كامل مع جميع الصفحات
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 1mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Traditional Arabic', 'Arial', sans-serif; direction: rtl; background: white; }
    .page { width: 210mm; min-height: 297mm; padding: 8mm; background: white; margin: 0 auto; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .page-break { page-break-after: always; }
    .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 1px; margin-bottom: 1px; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1px; }
    .logo { width: 60px; height: 60px; }
    .header-text { flex: 1; text-align: center; }
    .kingdom { font-size: 16px; font-weight: bold; margin-bottom: 4px; } 
    .ministry { font-size: 12px; margin-bottom: 2px; }
    .institution-info { font-size: 10px; margin-bottom: 10px; line-height: 1.5; }
    .title { font-size: 16px; font-weight: bold; text-decoration: underline; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 2px solid #000; padding: 5px 3px; text-align: center; font-size: 10px; }
    th { background-color: #f0f0f0; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .footer { margin-top: 10px; font-size: 9px; text-align: center; border-top: 2px solid #000; padding-top: 8px; }
    @media print {
      body { background: white; }
      .page { margin: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
${pages.map((pageStudents, pageIndex) => generatePage(pageStudents, pageIndex + 1, pages.length, pageIndex * studentsPerPage)).join('')}
</body>
</html>
    `.trim();
  };

  // الزر المعدل للوائح - تحميل اللائحة كـ PDF مباشرة
  const printImprovedListToPDF = async () => {
    try {
      console.log('📥 بدء تحميل اللائحة المعدلة كـ PDF...');

      let studentsForList = [...students];

      // تطبيق الفلاتر
      if (improvedListFilters.level !== 'الكل') {
        studentsForList = studentsForList.filter(s => s.level === improvedListFilters.level);
      }
      if (improvedListFilters.section !== 'الكل') {
        studentsForList = studentsForList.filter(s => s.section === improvedListFilters.section);
      }

      if (studentsForList.length === 0) {
        alert('لا توجد تلاميذ مطابقين للفلاتر المحددة');
        return;
      }

      // ترتيب حسب الاسم الأول
      studentsForList.sort((a, b) => a.firstName.localeCompare(b.firstName, 'ar'));

      const sectionName = improvedListFilters.section !== 'الكل' ? improvedListFilters.section : 'جميع الأقسام';
      const htmlContent = await generateImprovedStudentListHTML(studentsForList, sectionName);

      // إنشاء iframe مخفي لطباعة المحتوى
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) {
        alert('خطأ في إنشاء نافذة الطباعة');
        document.body.removeChild(iframe);
        return;
      }

      // كتابة المحتوى
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      // الانتظار حتى يتم تحميل المحتوى ثم الطباعة
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();

          // إزالة الـ iframe بعد فترة
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        } catch (err) {
          console.error('خطأ في الطباعة:', err);
          document.body.removeChild(iframe);
        }
      }, 500);

      setShowImprovedListModal(false);
      console.log('✅ تم فتح نافذة الطباعة بنجاح');
    } catch (error) {
      console.error('❌ خطأ في طباعة اللائحة:', error);
      alert('حدث خطأ في طباعة اللائحة. جرب مرة أخرى.');
    }
  };

  // تطبيق فلاتر الطباعة وتحميل PDF
  const executePrint = async () => {
    console.log('🚀 بدء عملية الطباعة...');
    console.log('📋 الفلاتر المحددة:', printFilters);
    console.log('👥 إجمالي التلاميذ في قاعدة البيانات:', students.length);

    // طباعة عينة من بيانات التلاميذ للتشخيص
    if (students.length > 0) {
      console.log('📝 عينة من بيانات التلميذ الأول:', {
        name: `${students[0].firstName} ${students[0].lastName}`,
        level: students[0].level,
        section: students[0].section,
        gender: students[0].gender
      });
    }

    let studentsForPrint = [...students];

    // تطبيق الفلاتر مع تسجيل مفصل
    if (printFilters.level !== 'الكل') {
      console.log(`🔍 تصفية حسب المستوى: ${printFilters.level}`);
      const beforeFilter = studentsForPrint.length;
      studentsForPrint = studentsForPrint.filter(s => s.level === printFilters.level);
      console.log(`   قبل الفلتر: ${beforeFilter}, بعد الفلتر: ${studentsForPrint.length}`);
    }

    if (printFilters.section !== 'الكل') {
      console.log(`🔍 تصفية حسب القسم: ${printFilters.section}`);
      const beforeFilter = studentsForPrint.length;
      studentsForPrint = studentsForPrint.filter(s => s.section === printFilters.section);
      console.log(`   قبل الفلتر: ${beforeFilter}, بعد الفلتر: ${studentsForPrint.length}`);
    }

    if (printFilters.gender !== 'الكل') {
      console.log(`🔍 تصفية حسب النوع: ${printFilters.gender}`);
      const beforeFilter = studentsForPrint.length;
      studentsForPrint = studentsForPrint.filter(s => s.gender === printFilters.gender);
      console.log(`   قبل الفلتر: ${beforeFilter}, بعد الفلتر: ${studentsForPrint.length}`);
    }

    console.log('📊 النتيجة النهائية - عدد التلاميذ بعد التصفية:', studentsForPrint.length);

    if (studentsForPrint.length === 0) {
      console.error('❌ لا توجد تلاميذ بعد تطبيق الفلاتر!');
      console.log('💡 المستويات المتاحة:', getUniqueLevels());
      console.log('💡 الأقسام المتاحة:', getUniqueSections());
      alert('لا توجد تلاميذ مطابقين للفلاتر المحددة. يرجى التحقق من المستوى والقسم المختارين.');
      return;
    }

    try {
      console.log('✅ بدء إنشاء ملف PDF...');
      await generatePDFStudentList(studentsForPrint);
      setShowPrintModal(false);
      console.log('✅ تم إنشاء ملف PDF بنجاح وإغلاق نافذة الطباعة');
    } catch (error) {
      console.error('❌ خطأ في إنشاء PDF:', error);
      alert(`حدث خطأ في إنشاء ملف PDF: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    }
  };
  
  // ترتيب المستويات الدراسية منطقياً
  const sortLevels = (levels: string[]) => {
    const levelOrder: { [key: string]: number } = {
      'التحضيري': 1,
      'السنة الأولى ابتدائي': 2,
      'السنة الثانية ابتدائي': 3,
      'السنة الثالثة ابتدائي': 4,
      'السنة الرابعة ابتدائي': 5,
      'السنة الخامسة ابتدائي': 6,
      'السنة السادسة ابتدائي': 7,
      'الأولى إعدادي': 8,
      'الأولى إعدادي مسار دولي': 9,
      'الثانية إعدادي': 10,
      'الثانية إعدادي مسار دولي': 11,
      'الثالثة إعدادي': 12,
      'الثالثة إعدادي مسار دولي': 13,
      'الجذع المشترك': 14,
      'الجذع المشترك العلمي': 15,
      'الجذع المشترك الأدبي': 16,
      'الجذع المشترك علوم وتكنولوجيا': 17,
      'الجذع المشترك آداب وعلوم إنسانية': 18,
      'الأولى باكالوريا': 19,
      'الأولى باكالوريا علوم': 20,
      'الأولى باكالوريا آداب': 21,
      'الأولى باكالوريا علوم وتكنولوجيا': 22,
      'الأولى باكالوريا آداب وعلوم إنسانية': 23,
      'الثانية باكالوريا': 24,
      'الثانية باكالوريا علوم': 25,
      'الثانية باكالوريا آداب': 26,
      'الثانية باكالوريا علوم وتكنولوجيا': 27,
      'الثانية باكالوريا آداب وعلوم إنسانية': 28
    };

    return levels.sort((a, b) => {
      const orderA = levelOrder[a] || 999;
      const orderB = levelOrder[b] || 999;
      return orderA - orderB;
    });
  };

  // ترتيب الأقسام حسب الرقم الأخير
  const sortSections = (sections: string[]) => {
    return sections.sort((a, b) => {
      // استخراج الرقم من آخر القسم (مثل "1/1" أو "القسم 1")
      const numA = parseInt(a.match(/\d+$/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+$/)?.[0] || '0');

      if (numA !== numB) {
        return numA - numB;
      }

      // إذا كانت الأرقام متساوية، ترتيب أبجدي
      return a.localeCompare(b, 'ar');
    });
  };

  // الحصول على الصفوف الفريدة
  const getUniqueGrades = () => {
    return Array.from(new Set(students.map(s => s.grade).filter(Boolean)));
  };

  // الحصول على المستويات الفريدة مرتبة
  const getUniqueLevels = () => {
    const levels = Array.from(new Set(students.map(s => s.level).filter(Boolean)));
    return sortLevels(levels);
  };

  // الحصول على الأقسام الفريدة مرتبة
  const getUniqueSections = () => {
    const sections = Array.from(new Set(students.map(s => s.section).filter(Boolean)));
    return sortSections(sections);
  };

  // الحصول على الأقسام المتاحة للمستوى المحدد (للطباعة)
  const getAvailableSectionsForLevel = (level: string) => {
    if (level === 'الكل') return getUniqueSections();
    return Array.from(new Set(students.filter(s => s.level === level).map(s => s.section).filter(Boolean)));
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="p-6 max-w-7xl mx-auto">
      {/* عنوان الصفحة */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
          إدارة التلاميذ
        </h1>
        <p className="text-gray-600 text-lg">إدارة معلومات التلاميذ وسجلاتهم</p>
        <div className="mt-4 w-24 h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mx-auto"></div>
      </div>

      {/* شريط التقدم */}
      {importProgress.status !== 'idle' && (
        <div className="mb-6">
          <ProgressBar
            progress={importProgress.progress}
            status={importProgress.status}
            message={importProgress.message}
            estimatedTime={importProgress.estimatedTime}
            details={importProgress.details}
          />
        </div>
      )}

      {/* كارد الإحصائيات الديناميكية للبحث */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Search className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">نتائج البحث والتصفية</h2>
            <p className="text-sm text-gray-600">إحصائيات ديناميكية للتلاميذ المعروضين حالياً</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">{searchStats.total}</div>
            <div className="text-blue-800 font-medium">إجمالي النتائج</div>
            <div className="text-sm text-blue-600 mt-1">
              {students.length > 0 ? Math.round((searchStats.total / students.length) * 100) : 0}% من الإجمالي
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 p-4 rounded-xl border border-indigo-200 text-center">
            <div className="text-3xl font-bold text-indigo-600 mb-2">{searchStats.male}</div>
            <div className="text-indigo-800 font-medium">الذكور</div>
            <div className="text-sm text-indigo-600 mt-1">
              {searchStats.total > 0 ? Math.round((searchStats.male / searchStats.total) * 100) : 0}% من النتائج
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-pink-50 to-pink-100 p-4 rounded-xl border border-pink-200 text-center">
            <div className="text-3xl font-bold text-pink-600 mb-2">{searchStats.female}</div>
            <div className="text-pink-800 font-medium">الإناث</div>
            <div className="text-sm text-pink-600 mt-1">
              {searchStats.total > 0 ? Math.round((searchStats.female / searchStats.total) * 100) : 0}% من النتائج
            </div>
          </div>
        </div>
        
        {/* شريط مرئي للتوزيع */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>توزيع النوع في النتائج</span>
            <span>{searchStats.total} تلميذ</span>
          </div>
         
<div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
  <div className="h-full flex">
    <div 
      className="bg-indigo-500 transition-all duration-500" 
      style={{ width: `${searchStats.total > 0 ? (searchStats.male / searchStats.total) * 100 : 0}%` }}
    ></div>
    <div 
      className="bg-pink-500 transition-all duration-500" 
      style={{ width: `${searchStats.total > 0 ? (searchStats.female / searchStats.total) * 100 : 0}%` }}
    ></div>
  </div>
</div>

          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>ذكور ({searchStats.male})</span>
            <span>إناث ({searchStats.female})</span>
          </div>
        </div>
      </div>



      {/* شريط الأزرار */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
        <div className="flex flex-col gap-6">
          {/* الصف الأول - إضافة تلميذ واستيراد */}
         
          {/* الصف الثاني - المؤشر وأزرار التصدير والطباعة */}
          <div className="border-t pt-6">
            <div className="flex items-center justify-between gap-6 flex-wrap">
              {/* مؤشر عدد الأسماء 
              <div className="flex items-center gap-4 px-6 py-3 bg-blue-50 rounded-lg border-2 border-blue-200">
                <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                  عدد الأسماء في اللائحة:
                </label>
                <input
                  type="range"
                  min="20"
                  max="50"
                  step="1"
                  value={studentsPerPage}
                  onChange={(e) => setStudentsPerPage(Number(e.target.value))}
                  className="w-10 h-1 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((studentsPerPage - 20) / 30) * 100}%, #dbeafe ${((studentsPerPage - 20) / 30) * 100}%, #dbeafe 100%)`
                  }}
                />
                <span className="text-xl font-bold text-blue-800 min-w-[3rem] text-center bg-white px-3 py-2 rounded-lg border-2 border-blue-300 shadow-sm">
                  {studentsPerPage}
                </span>
              </div>

              {/* أزرار التصدير والطباعة */}
              <div className="flex gap-3">
                <button
                  onClick={handleExportStudentListToExcel}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <Download className="w-5 h-5" />
                 طباعة لوائح التلاميذ بجودة عالية 
                </button>

                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <FileDown className="w-5 h-5" />
                  تصدير Excel
                </button>
  <button
              onClick={() => setShowForm(true)}
              className="  gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Plus className="w-1 h-1" />
              إضافة تلميذ
            </button>



                
              </div>
            </div>
          </div>
        </div>
      </div>




        
      {/* شريط الأدوات */}

      {/* شريط الفلاتر */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4 border border-gray-100">
        {/* رسالة توجيهية */}
        {(levelFilter === 'الكل' || sectionFilter === 'الكل') && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-600" />
            <p className="text-sm text-blue-700 font-medium">
              يرجى تحديد المستوى والقسم للحصول على نتائج دقيقة
            </p>
          </div>
        )}

        {/* خانة البحث مع الإحصائيات */}
        <div className="mb-4 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="البحث عن التلاميذ (الاسم، اللقب، الرقم الوطني، تاريخ الازدياد...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-gray-700">النتائج:</span>
              <span className="text-blue-600 font-bold">{searchStats.total}</span>
            </div>
            <div className="text-gray-400">|</div>
            <div className="flex items-center gap-2">
              <span className="text-gray-700">ذكور:</span>
              <span className="text-indigo-600 font-bold">{searchStats.male}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-700">إناث:</span>
              <span className="text-pink-600 font-bold">{searchStats.female}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* تصفية المستوى */}
          <select
            value={levelFilter}
            onChange={(e) => {
              setLevelFilter(e.target.value);
              // إعادة تعيين فلتر القسم عند تغيير المستوى
              if (e.target.value !== levelFilter) {
                setSectionFilter('الكل');
              }
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="الكل">اختر المستوى</option>
            {getUniqueLevels().map(level => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>

          {/* تصفية القسم */}
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="الكل">اختر القسم</option>
            {(levelFilter === 'الكل' ? getUniqueSections() :
              sortSections(Array.from(new Set(students.filter(s => s.level === levelFilter).map(s => s.section).filter(Boolean))))
            ).map(section => (
              <option key={section} value={section}>{section}</option>
            ))}
          </select>

          {/* تصفية النوع */}
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="الكل">جميع الأنواع</option>
            <option value="ذكر">ذكر</option>
            <option value="أنثى">أنثى</option>
          </select>
        </div>
{/* [translate:عداد التلاميذ الديناميكي] */}
{levelFilter !== 'الكل' && sectionFilter !== 'الكل' && (
  <div className="mt-4 grid grid-cols-3 gap-3">
    <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-lg text-center shadow-md">
      <div className="text-3xl font-bold">{searchStats.total}</div>
      <div className="text-sm mt-1 opacity-90">[ :المجموع]</div>
    </div>
    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-4 rounded-lg text-center shadow-md">
      <div className="text-3xl font-bold">{searchStats.male}</div>
      <div className="text-sm mt-1 opacity-90">[ :الذكور]</div>
    </div>
    <div className="bg-gradient-to-br from-pink-500 to-pink-600 text-white p-4 rounded-lg text-center shadow-md">
      <div className="text-3xl font-bold">{searchStats.female}</div>
      <div className="text-sm mt-1 opacity-90">[ :الإناث]</div>
    </div>
  </div>
  

        )}
      </div>

      {/* جدول التلاميذ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  التلميذ
                </th>
                <th className="px-6 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الرمز
                </th>
                <th className="px-6 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  النوع
                </th>
                <th className="px-6 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المستوى
                </th>
                <th className="px-6 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  القسم
                </th>
              
                <th className="px-6 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الحالة
                </th>
                <th className="px-6 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  تاريخ التسجيل
                </th>
                <th className="px-6 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStudents.map((student) => (
                <tr
                  key={student.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onDoubleClick={() => {
                    setSelectedStudent(student);
                    setShowDetail(true);
                  }}
                  title="انقر مرتين لعرض التفاصيل"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {student.firstName} {student.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{student.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {student.nationalId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      student.gender === 'ذكر' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                    }`}>
                      {student.gender}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                      {student.level || 'غير محدد'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      {student.section || 'غير محدد'}
                    </span>
                  </td>
                
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      student.status === 'متمدرس' ? 'bg-green-100 text-green-800' :
                    
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {student.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(student.enrollmentDate).toLocaleDateString('en-CA')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedStudent(student);
                          setShowDetail(true);
                        }}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStudent(student);
                          setShowForm(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-900 p-1 rounded"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteStudent(student.id)}
                        className="text-red-600 hover:text-red-900 p-1 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredStudents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">لا توجد تلاميذ</p>
          </div>
        )}
      </div>

      {/* مودال إعدادات الطباعة */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Printer className="w-5 h-5" />
                إعدادات طباعة اللائحة
              </h2>
              <button
                onClick={() => setShowPrintModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* اختيار المستوى */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المستوى
                </label>
                <select
                  value={printFilters.level}
                  onChange={(e) => {
                    setPrintFilters(prev => ({ 
                      ...prev, 
                      level: e.target.value,
                      section: 'الكل' // إعادة تعيين القسم عند تغيير المستوى
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="الكل">جميع المستويات</option>
                  {getUniqueLevels().map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              {/* اختيار القسم */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  القسم
                </label>
                <select
                  value={printFilters.section}
                  onChange={(e) => setPrintFilters(prev => ({ ...prev, section: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="الكل">جميع الأقسام</option>
                  {getAvailableSectionsForLevel(printFilters.level).map(section => (
                    <option key={section} value={section}>{section}</option>
                  ))}
                </select>
              </div>

              {/* اختيار النوع */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  النوع
                </label>
                <select
                  value={printFilters.gender}
                  onChange={(e) => setPrintFilters(prev => ({ ...prev, gender: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="الكل">جميع الأنواع</option>
                  <option value="ذكر">ذكور فقط</option>
                  <option value="أنثى">إناث فقط</option>
                </select>
              </div>

              {/* معاينة عدد التلاميذ */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-blue-800">
                  <strong>عدد التلاميذ المطابقين للفلاتر:</strong> {
                    students.filter(s => {
                      return (printFilters.level === 'الكل' || s.level === printFilters.level) &&
                             (printFilters.section === 'الكل' || s.section === printFilters.section) &&
                             (printFilters.gender === 'الكل' || s.gender === printFilters.gender);
                    }).length
                  } تلميذ
                </div>
                <div className="text-xs text-blue-600 mt-2">
                  سيتم إنشاء ملف PDF مع دعم كامل للنصوص العربية باستخدام تقنية HTML-to-Canvas
                </div>
              </div>

              {/* أزرار التحكم */}
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={executePrint}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  تحميل لائحة PDF بالعربية
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مودال الزر المعدل للوائح */}
      {showImprovedListModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-purple-50 to-blue-50">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                الزر المعدل للوائح
              </h2>
              <button
                onClick={() => setShowImprovedListModal(false)}
                className="p-2 hover:bg-white rounded-lg transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-purple-800 font-medium">
                  📥 ستظهر نافذة الطباعة تلقائياً - اختر "حفظ كـ PDF" أو "Microsoft Print to PDF" من قائمة الطابعات
                </p>
              </div>

              {/* اختيار المستوى */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المستوى
                </label>
                <select
                  value={improvedListFilters.level}
                  onChange={(e) => {
                    setImprovedListFilters(prev => ({
                      ...prev,
                      level: e.target.value,
                      section: 'الكل'
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="الكل">جميع المستويات</option>
                  {getUniqueLevels().map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              {/* اختيار القسم */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  القسم
                </label>
                <select
                  value={improvedListFilters.section}
                  onChange={(e) => setImprovedListFilters(prev => ({ ...prev, section: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="الكل">جميع الأقسام</option>
                  {getAvailableSectionsForLevel(improvedListFilters.level).map(section => (
                    <option key={section} value={section}>{section}</option>
                  ))}
                </select>
              </div>

              {/* معاينة عدد التلاميذ */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
                <div className="text-sm text-purple-900 font-medium">
                  <strong>عدد التلاميذ المطابقين:</strong> {
                    students.filter(s => {
                      return (improvedListFilters.level === 'الكل' || s.level === improvedListFilters.level) &&
                             (improvedListFilters.section === 'الكل' || s.section === improvedListFilters.section);
                    }).length
                  } تلميذ
                </div>
                <div className="text-xs text-purple-700 mt-2">
                  ✨ النموذج المغربي الرسمي مع ترويسة احترافية
                </div>
              </div>

              {/* أزرار التحكم */}
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={printImprovedListToPDF}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  <Printer className="w-4 h-4" />
                  تحميل PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowImprovedListModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* مؤشر التحميل الملون والجذاب */}
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-600 p-8 rounded-2xl shadow-2xl text-center max-w-md mx-4">
              <div className="relative mb-6">
                <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto shadow-lg"></div>
                <div className="absolute inset-0 w-12 h-12 border-4 border-emerald-300 border-t-transparent rounded-full animate-spin mx-auto mt-2 ml-2"></div>
                <div className="absolute inset-0 w-8 h-8 border-4 border-blue-300 border-t-transparent rounded-full animate-spin mx-auto mt-4 ml-4"></div>
              </div>
              
              <h3 className="text-xl font-bold text-white mb-3">
                {printingSection ? `🖨️ جاري طباعة: ${printingSection}` : '🖨️ جاري تحضير الطباعة...'}
              </h3>
              
              <p className="text-white text-opacity-90 mb-4">
                {printingSection ? 
                  `جاري معالجة القسم: ${printingSection}` : 
                  'يرجى عدم إغلاق النافذة أثناء تحضير اللائحة'
                }
              </p>
              
              {printProgress > 0 && (
                <div className="bg-white bg-opacity-20 rounded-lg p-4 mb-4">
                  <div className="flex justify-between text-white text-sm mb-2">
                    <span>التقدم</span>
                    <span>{printProgress}%</span>
                  </div>
                  <div className="w-full bg-white bg-opacity-30 rounded-full h-3">
                    <div 
                      className="bg-white h-3 rounded-full transition-all duration-500 ease-out shadow-sm" 
                      style={{ width: `${printProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              <div className="bg-white bg-opacity-20 rounded-full p-3">
                <div className="text-white font-bold text-lg">
                  ⏳ معالجة {filteredStudents.length} تلميذ...
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* نموذج التلميذ */}
      {showForm && (
        <StudentForm
          student={selectedStudent}
          onSave={selectedStudent ? 
            (data) => handleUpdateStudent(selectedStudent.id, data) : 
            handleAddStudent
          }
          onCancel={() => {
            setShowForm(false);
            setSelectedStudent(null);
          }}
        />
      )}

      {/* تفاصيل التلميذ */}
      {showDetail && selectedStudent && (
        <StudentDetail
          student={selectedStudent}
          onClose={() => {
            setShowDetail(false);
            setSelectedStudent(null);
          }}
        />
      )}
    </div>
  );
};

export default StudentManagement;