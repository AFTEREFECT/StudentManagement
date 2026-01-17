import React, { useState, useEffect } from 'react';
import { FileText, Send, Download, Upload, CheckCircle, AlertCircle, Clock, Users, BarChart3, Mail, FileCheck, FileX, Calendar, Building, Target, RefreshCw, Plus, Edit, Trash2, Eye, Filter } from 'lucide-react';
import { dbManager } from '../utils/database';
import { Student } from '../types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

interface StudentFile {
  id: string;
  studentId: string;
  studentName: string;
  nationalId: string;
  level: string;
  section: string;
  fileType: 'وافد' | 'مغادر';
  requestSent: boolean;
  requestDate?: string;
  fileReceived: boolean;
  receivedDate?: string;
  fromInstitution?: string;
  toInstitution?: string;
  notes: string;
  priority: 'عادي' | 'مستعجل' | 'متأخر';
  status: 'في الانتظار' | 'تم الإرسال' | 'تم التوصل' | 'مكتمل';
  createdAt: string;
  updatedAt: string;
}

interface FileStats {
  totalFiles: number;
  requestsSent: number;
  filesReceived: number;
  pendingFiles: number;
  byLevel: { [key: string]: { total: number; sent: number; received: number; pending: number } };
  byType: { incoming: number; outgoing: number };
  byPriority: { normal: number; urgent: number; overdue: number };
}

const StudentFileManagement: React.FC = () => {
  const [files, setFiles] = useState<StudentFile[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<FileStats>({
    totalFiles: 0,
    requestsSent: 0,
    filesReceived: 0,
    pendingFiles: 0,
    byLevel: {},
    byType: { incoming: 0, outgoing: 0 },
    byPriority: { normal: 0, urgent: 0, overdue: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<StudentFile | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>('الكل');
  const [filterType, setFilterType] = useState<string>('الكل');
  const [filterStatus, setFilterStatus] = useState<string>('الكل');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    studentId: '',
    fileType: 'وافد' as 'وافد' | 'مغادر',
    fromInstitution: '',
    toInstitution: '',
    notes: '',
    priority: 'عادي' as 'عادي' | 'مستعجل' | 'متأخر'
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [files]);

  // تحميل البيانات
  const loadData = async () => {
    try {
      const [studentsData, filesData] = await Promise.all([
        dbManager.getStudents(),
        loadStudentFiles()
      ]);
      
      setStudents(studentsData);
      setFiles(filesData);
    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
    } finally {
      setLoading(false);
    }
  };

  // تحميل ملفات التلاميذ من التخزين المحلي
  const loadStudentFiles = async (): Promise<StudentFile[]> => {
    try {
      const saved = localStorage.getItem('studentFiles');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('خطأ في تحميل ملفات التلاميذ:', error);
      return [];
    }
  };

  // حفظ ملفات التلاميذ
  const saveStudentFiles = (filesToSave: StudentFile[]) => {
    try {
      localStorage.setItem('studentFiles', JSON.stringify(filesToSave));
    } catch (error) {
      console.error('خطأ في حفظ ملفات التلاميذ:', error);
    }
  };

  // حساب الإحصائيات
  const calculateStats = () => {
    const totalFiles = files.length;
    const requestsSent = files.filter(f => f.requestSent).length;
    const filesReceived = files.filter(f => f.fileReceived).length;
    const pendingFiles = totalFiles - filesReceived;

    // إحصائيات حسب المستوى
    const byLevel: { [key: string]: { total: number; sent: number; received: number; pending: number } } = {};
    files.forEach(file => {
      if (!byLevel[file.level]) {
        byLevel[file.level] = { total: 0, sent: 0, received: 0, pending: 0 };
      }
      byLevel[file.level].total++;
      if (file.requestSent) byLevel[file.level].sent++;
      if (file.fileReceived) byLevel[file.level].received++;
      if (!file.fileReceived) byLevel[file.level].pending++;
    });

    // إحصائيات حسب النوع
    const incoming = files.filter(f => f.fileType === 'وافد').length;
    const outgoing = files.filter(f => f.fileType === 'مغادر').length;

    // إحصائيات حسب الأولوية
    const normal = files.filter(f => f.priority === 'عادي').length;
    const urgent = files.filter(f => f.priority === 'مستعجل').length;
    const overdue = files.filter(f => f.priority === 'متأخر').length;

    setStats({
      totalFiles,
      requestsSent,
      filesReceived,
      pendingFiles,
      byLevel,
      byType: { incoming, outgoing },
      byPriority: { normal, urgent, overdue }
    });
  };

  // إضافة ملف جديد
  const handleAddFile = () => {
    const student = students.find(s => s.id === formData.studentId);
    if (!student) {
      alert('يرجى اختيار تلميذ صحيح');
      return;
    }

    const newFile: StudentFile = {
      id: crypto.randomUUID(),
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      nationalId: student.nationalId,
      level: student.level,
      section: student.section,
      fileType: formData.fileType,
      requestSent: false,
      fileReceived: false,
      fromInstitution: formData.fromInstitution,
      toInstitution: formData.toInstitution,
      notes: formData.notes,
      priority: formData.priority,
      status: 'في الانتظار',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updatedFiles = [...files, newFile];
    setFiles(updatedFiles);
    saveStudentFiles(updatedFiles);
    setShowForm(false);
    resetForm();
  };

  // تحديث ملف
  const handleUpdateFile = (fileId: string, updates: Partial<StudentFile>) => {
    const updatedFiles = files.map(file => 
      file.id === fileId 
        ? { ...file, ...updates, updatedAt: new Date().toISOString() }
        : file
    );
    setFiles(updatedFiles);
    saveStudentFiles(updatedFiles);
  };

  // حذف ملف
  const handleDeleteFile = (fileId: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الملف؟')) {
      const updatedFiles = files.filter(f => f.id !== fileId);
      setFiles(updatedFiles);
      saveStudentFiles(updatedFiles);
    }
  };

  // إرسال مراسلة
  const sendRequest = (fileId: string) => {
    handleUpdateFile(fileId, {
      requestSent: true,
      requestDate: new Date().toISOString().split('T')[0],
      status: 'تم الإرسال'
    });
  };

  // تأكيد استلام الملف
  const confirmFileReceived = (fileId: string) => {
    handleUpdateFile(fileId, {
      fileReceived: true,
      receivedDate: new Date().toISOString().split('T')[0],
      status: 'مكتمل'
    });
  };

  // توليد نموذج طلب ملف مدرسي
  const generateRequestForm = async (file: StudentFile) => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // إضافة محتوى النموذج
      const content = `
        <div style="font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 20mm; line-height: 1.6;">
          <div style="text-align: center; margin-bottom: 20mm;">
            <h1 style="font-size: 18px; font-weight: bold; color: #1e40af;">طلب ملف مدرسي</h1>
            <p style="font-size: 12px; color: #374151;">المملكة المغربية - وزارة التربية الوطنية والتعليم الأولي والرياضة</p>
          </div>
          
          <div style="margin-bottom: 15mm;">
            <p><strong>إلى السيد(ة) مدير(ة) المؤسسة:</strong> ${file.fromInstitution || '........................'}</p>
            <p style="margin-top: 10mm;"><strong>الموضوع:</strong> طلب ملف مدرسي</p>
          </div>
          
          <div style="margin-bottom: 15mm;">
            <p>سلام تام بوجود مولانا الإمام دام له التأييد و النصر وبعد،</p>
        
            <p style="margin-top: 5mm;">
             وبعد، نرجو منكم التكرم بإرسال الملف المدرسي للتلميذ(ة) :
            </p>
          </div>
          
          <div style="border: 2px solid #374151; padding: 10mm; margin-bottom: 15mm; background: #f9fafb;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10mm;">
              <div>
                <p><strong>الاسم الكامل:</strong> ${file.studentName}</p>
                <p><strong>الرقم الوطني:</strong> ${file.nationalId}</p>
              </div>
              <div>
                <p><strong>المستوى:</strong> ${file.level}</p> 
                <p><strong>القسم:</strong> ${file.section}</p>
              </div>
            </div>
          </div>
          
          <div style="margin-bottom: 15mm;">
            <p>
              وذلك لاستكمال إجراءات تسجيله(ها) بمؤسستنا للموسم الدراسي الحالي.
            </p>
            <p style="margin-top: 5mm;">
              نشكركم مسبقاً على تعاونكم، وتقبلوا فائق والتقدير والاحترام والسلام.
            </p>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20mm; margin-top: 20mm;">
            <div style="text-align: center;">
              <p><strong>تاريخ الطلب:</strong> ${new Date().toLocaleDateString('Fr-EG')}</p>
            </div>
            <div style="text-align: center;">
              <p><strong>السيد الحارس(ة) العام(ة)  </strong></p>
              <div style="margin-top: 15mm; border-bottom: 1px solid #000; width: 60mm; margin: 15mm auto 0;"></div>
            </div>
          </div>
        </div>
      `;

      // تحويل HTML إلى PDF
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
        
        const canvas = await (window as any).html2canvas(printElement, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`طلب_ملف_مدرسي_${file.studentName.replace(/\s+/g, '_')}.pdf`);
        
        // تحديث حالة الملف
        sendRequest(file.id);
        
      } finally {
        document.body.removeChild(printElement);
      }
      
    } catch (error) {
      console.error('خطأ في توليد نموذج الطلب:', error);
      alert('خطأ في توليد نموذج الطلب');
    }
  };

  // تصدير الإحصائيات
  const exportStats = () => {
    const reportData = [
      ['تقرير تدبير ملفات التلاميذ'],
      [`تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}`],
      [],
      ['الإحصائيات العامة'],
      ['إجمالي الملفات', stats.totalFiles],
      ['المراسلات المرسلة', stats.requestsSent],
      ['الملفات المتوصل بها', stats.filesReceived],
      ['الملفات المتبقية', stats.pendingFiles],
      [],
      ['الإحصائيات حسب النوع'],
      ['الوافدون', stats.byType.incoming],
      ['المغادرون', stats.byType.outgoing],
      [],
      ['الإحصائيات حسب المستوى'],
      ['المستوى', 'الإجمالي', 'تم الإرسال', 'تم التوصل', 'في الانتظار'],
      ...Object.entries(stats.byLevel).map(([level, data]) => [
        level, data.total, data.sent, data.received, data.pending
      ])
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير الملفات');
    XLSX.writeFile(workbook, `تقرير_ملفات_التلاميذ_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // إعادة تعيين النموذج
  const resetForm = () => {
    setFormData({
      studentId: '',
      fileType: 'وافد',
      fromInstitution: '',
      toInstitution: '',
      notes: '',
      priority: 'عادي'
    });
    setSelectedFile(null);
  };

  // تصفية الملفات
  const getFilteredFiles = () => {
    return files.filter(file => {
      const matchesSearch = searchTerm === '' || 
        file.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.nationalId.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesLevel = filterLevel === 'الكل' || file.level === filterLevel;
      const matchesType = filterType === 'الكل' || file.fileType === filterType;
      const matchesStatus = filterStatus === 'الكل' || file.status === filterStatus;
      
      return matchesSearch && matchesLevel && matchesType && matchesStatus;
    });
  };

  const filteredFiles = getFilteredFiles();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg">جاري تحميل نظام تدبير الملفات...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* عنوان الصفحة */}
        <div className="mb-6 sm:mb-8 text-center">
          <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2 sm:mb-3">
            تدبير ملفات التلاميذ الوافدين والمغادرين
          </h1>
          <p className="text-gray-600 text-sm sm:text-lg">نظام شامل لتتبع وإدارة ملفات التلاميذ مع المراسلات والإحصائيات</p>
          <div className="mt-4 w-24 h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mx-auto"></div>
        </div>

        {/* لوحة الإحصائيات الرئيسية */}
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm mb-6 border border-gray-100">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            لوحة التتبع الرئيسية
          </h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 sm:p-6 rounded-xl text-center border border-blue-200">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-2">{stats.totalFiles}</div>
              <div className="text-sm sm:text-base font-medium text-blue-800">إجمالي الملفات</div>
              <div className="text-xs text-blue-600 mt-1">وافدين + مغادرين</div>
            </div>
            
            <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 sm:p-6 rounded-xl text-center border border-green-200">
              <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-2">{stats.requestsSent}</div>
              <div className="text-sm sm:text-base font-medium text-green-800">مراسلات أُرسلت</div>
              <div className="text-xs text-green-600 mt-1">
                {stats.totalFiles > 0 ? Math.round((stats.requestsSent / stats.totalFiles) * 100) : 0}% من الإجمالي
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 sm:p-6 rounded-xl text-center border border-purple-200">
              <div className="text-2xl sm:text-3xl font-bold text-purple-600 mb-2">{stats.filesReceived}</div>
              <div className="text-sm sm:text-base font-medium text-purple-800">ملفات متوصل بها</div>
              <div className="text-xs text-purple-600 mt-1">
                {stats.requestsSent > 0 ? Math.round((stats.filesReceived / stats.requestsSent) * 100) : 0}% من المرسلة
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 sm:p-6 rounded-xl text-center border border-orange-200">
              <div className="text-2xl sm:text-3xl font-bold text-orange-600 mb-2">{stats.pendingFiles}</div>
              <div className="text-sm sm:text-base font-medium text-orange-800">ملفات متبقية</div>
              <div className="text-xs text-orange-600 mt-1">في الانتظار</div>
            </div>
          </div>
        </div>

        {/* إحصائيات حسب المستوى */}
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm mb-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">الإحصائيات حسب المستوى</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right font-bold text-gray-700">المستوى</th>
                  <th className="px-4 py-3 text-center font-bold text-blue-700">الإجمالي</th>
                  <th className="px-4 py-3 text-center font-bold text-green-700">تم الإرسال</th>
                  <th className="px-4 py-3 text-center font-bold text-purple-700">تم التوصل</th>
                  <th className="px-4 py-3 text-center font-bold text-orange-700">في الانتظار</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-700">معدل الإنجاز</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.byLevel).map(([level, data]) => (
                  <tr key={level} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{level}</td>
                    <td className="px-4 py-3 text-center font-bold text-blue-600">{data.total}</td>
                    <td className="px-4 py-3 text-center font-bold text-green-600">{data.sent}</td>
                    <td className="px-4 py-3 text-center font-bold text-purple-600">{data.received}</td>
                    <td className="px-4 py-3 text-center font-bold text-orange-600">{data.pending}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-bold text-gray-900">
                          {data.total > 0 ? Math.round((data.received / data.total) * 100) : 0}%
                        </span>
                        <div className="w-12 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${data.total > 0 ? (data.received / data.total) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* أدوات التحكم */}
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm mb-6 border border-gray-100">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">إدارة الملفات</h2>
                <p className="text-sm text-gray-600">تتبع ومتابعة ملفات التلاميذ</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">إضافة ملف</span>
              </button>
              
              <button
                onClick={exportStats}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">تصدير</span>
              </button>
            </div>
          </div>

          {/* فلاتر البحث */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="البحث..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="الكل">جميع المستويات</option>
              {Array.from(new Set(students.map(s => s.level).filter(Boolean))).map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="الكل">جميع الأنواع</option>
              <option value="وافد">وافدين</option>
              <option value="مغادر">مغادرين</option>
            </select>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="الكل">جميع الحالات</option>
              <option value="في الانتظار">في الانتظار</option>
              <option value="تم الإرسال">تم الإرسال</option>
              <option value="تم التوصل">تم التوصل</option>
              <option value="مكتمل">مكتمل</option>
            </select>
            
            <button
              onClick={loadData}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">تحديث</span>
            </button>
          </div>
        </div>

        {/* جدول الملفات */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التلميذ</th>
                  <th className="px-4 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">النوع</th>
                  <th className="px-4 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">المستوى</th>
                  <th className="px-4 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">المراسلة</th>
                  <th className="px-4 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">الملف</th>
                  <th className="px-4 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">الحالة</th>
                  <th className="px-4 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredFiles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">لا توجد ملفات</p>
                      <p className="text-gray-400 text-sm mt-2">ابدأ بإضافة ملف جديد</p>
                    </td>
                  </tr>
                ) : (
                  filteredFiles.map((file) => (
                    <tr key={file.id} className="hover:bg-gray-50">
                      <td className="px-4 sm:px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{file.studentName}</div>
                          <div className="text-xs text-gray-500">{file.nationalId}</div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-center">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          file.fileType === 'وافد' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {file.fileType}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-center text-sm text-gray-900">{file.level}</td>
                      <td className="px-4 sm:px-6 py-4 text-center">
                        {file.requestSent ? (
                          <div className="flex items-center justify-center gap-1">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-xs text-green-600">
                              {file.requestDate ? new Date(file.requestDate).toLocaleDateString('ar-EG') : ''}
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => generateRequestForm(file)}
                            className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                          >
                            <Send className="w-3 h-3" />
                            إرسال
                          </button>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-center">
                        {file.fileReceived ? (
                          <div className="flex items-center justify-center gap-1">
                            <FileCheck className="w-4 h-4 text-green-600" />
                            <span className="text-xs text-green-600">
                              {file.receivedDate ? new Date(file.receivedDate).toLocaleDateString('ar-EG') : ''}
                            </span>
                          </div>
                        ) : file.requestSent ? (
                          <button
                            onClick={() => confirmFileReceived(file.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                          >
                            <FileCheck className="w-3 h-3" />
                            تأكيد
                          </button>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500">في الانتظار</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-center">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          file.status === 'مكتمل' ? 'bg-green-100 text-green-800' :
                          file.status === 'تم التوصل' ? 'bg-purple-100 text-purple-800' :
                          file.status === 'تم الإرسال' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {file.status}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedFile(file);
                              setFormData({
                                studentId: file.studentId,
                                fileType: file.fileType,
                                fromInstitution: file.fromInstitution || '',
                                toInstitution: file.toInstitution || '',
                                notes: file.notes,
                                priority: file.priority
                              });
                              setShowForm(true);
                            }}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteFile(file.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* نموذج إضافة/تعديل ملف */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedFile ? 'تعديل ملف التلميذ' : 'إضافة ملف جديد'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* اختيار التلميذ */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    التلميذ *
                  </label>
                  <select
                    value={formData.studentId}
                    onChange={(e) => setFormData(prev => ({ ...prev, studentId: e.target.value }))}
                    disabled={!!selectedFile}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value="">اختر التلميذ</option>
                    {students.map(student => (
                      <option key={student.id} value={student.id}>
                        {student.firstName} {student.lastName} - {student.level}
                      </option>
                    ))}
                  </select>
                </div>

                {/* نوع الملف */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    نوع الملف *
                  </label>
                  <select
                    value={formData.fileType}
                    onChange={(e) => setFormData(prev => ({ ...prev, fileType: e.target.value as 'وافد' | 'مغادر' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="وافد">وافد</option>
                    <option value="مغادر">مغادر</option>
                  </select>
                </div>

                {/* المؤسسة المرسلة/المستقبلة */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {formData.fileType === 'وافد' ? 'المؤسسة المرسلة' : 'المؤسسة المستقبلة'}
                  </label>
                  <input
                    type="text"
                    value={formData.fileType === 'وافد' ? formData.fromInstitution : formData.toInstitution}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      [formData.fileType === 'وافد' ? 'fromInstitution' : 'toInstitution']: e.target.value 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="اسم المؤسسة"
                  />
                </div>

                {/* الأولوية */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الأولوية
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as 'عادي' | 'مستعجل' | 'متأخر' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="عادي">عادي</option>
                    <option value="مستعجل">مستعجل</option>
                    <option value="متأخر">متأخر</option>
                  </select>
                </div>

                {/* ملاحظات */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ملاحظات
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="ملاحظات إضافية..."
                  />
                </div>

                {/* أزرار التحكم */}
                <div className="flex gap-4 pt-4">
                  <button
                    onClick={selectedFile ? () => {
                      if (selectedFile) {
                        handleUpdateFile(selectedFile.id, {
                          fromInstitution: formData.fromInstitution,
                          toInstitution: formData.toInstitution,
                          notes: formData.notes,
                          priority: formData.priority
                        });
                        setShowForm(false);
                        resetForm();
                      }
                    } : handleAddFile}
                    disabled={!formData.studentId}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {selectedFile ? 'تحديث الملف' : 'إضافة الملف'}
                  </button>
                  <button
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* معلومات إضافية */}
        <div className="mt-8 bg-blue-50 p-4 sm:p-6 rounded-xl border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">كيفية استخدام النظام</h3>
          <div className="space-y-2 text-blue-800 text-sm">
            <p>• <strong>إضافة ملف:</strong> اختر التلميذ ونوع الملف (وافد/مغادر) والمؤسسة</p>
            <p>• <strong>إرسال مراسلة:</strong> اضغط "إرسال" لتوليد نموذج طلب الملف المدرسي</p>
            <p>• <strong>تأكيد الاستلام:</strong> اضغط "تأكيد" عند وصول الملف</p>
            <p>• <strong>المتابعة:</strong> راقب الإحصائيات والحالات من اللوحة الرئيسية</p>
            <p>• <strong>التصدير:</strong> صدّر التقارير لمتابعة التقدم</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentFileManagement;