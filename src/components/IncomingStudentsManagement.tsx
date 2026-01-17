import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Upload, 
  Download, 
  FileText, 
  Send, 
  CheckCircle, 
  AlertCircle, 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  Calendar,
  Building,
  Mail,
  RefreshCw,
  BarChart3,
  Clock,
  FileCheck,
  X,
  FolderOpen
} from 'lucide-react';
import { incomingStudentsDB } from '../utils/incomingStudentsDatabase';
import IncomingStudentImport from './IncomingStudentImport';
import IncomingStudentRequestForm from './IncomingStudentRequestForm';
import IncomingStudentForm from './IncomingStudentForm';
import * as XLSX from 'xlsx';

interface IncomingStudent {
  id: string;
  nationalId: string;
  firstName: string;
  lastName: string;
  gender: 'ذكر' | 'أنثى';
  dateOfBirth: string;
  birthPlace: string;
  level: string;
  section: string;
  previousInstitution: string;
  enrollmentDate: string;
  fileStatus: 'لم يتم الإرسال' | 'طلب مرسل' | 'ملف تم التوصل به' | 'مكرر' | 'غير معروف';
  requestCount: number;
  requestDates: string[];
  lastRequestDate?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface IncomingStudentStats {
  totalStudents: number;
  requestsSent: number;
  filesReceived: number;
  pendingFiles: number;
  byLevel: { [key: string]: number };
  byInstitution: { [key: string]: number };
  byStatus: { [key: string]: number };
}

const IncomingStudentsManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('management');
  const [students, setStudents] = useState<IncomingStudent[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<IncomingStudent[]>([]);
  const [stats, setStats] = useState<IncomingStudentStats>({
    totalStudents: 0,
    requestsSent: 0,
    filesReceived: 0,
    pendingFiles: 0,
    byLevel: {},
    byInstitution: {},
    byStatus: {}
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('الكل');
  const [statusFilter, setStatusFilter] = useState('الكل');
  const [institutionFilter, setInstitutionFilter] = useState('الكل');
  const [showForm, setShowForm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<IncomingStudent | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [showRequestForm, setShowRequestForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterStudents();
    calculateStats();
  }, [students, searchTerm, levelFilter, statusFilter, institutionFilter]);

  // تحميل البيانات
  const loadData = async () => {
    try {
      const studentsData = await incomingStudentsDB.getAllStudents();
      setStudents(studentsData);
    } catch (error) {
      console.error('خطأ في تحميل بيانات التلاميذ الوافدين:', error);
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
        student.nationalId.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (levelFilter !== 'الكل') {
      filtered = filtered.filter(student => student.level === levelFilter);
    }

    if (statusFilter !== 'الكل') {
      filtered = filtered.filter(student => student.fileStatus === statusFilter);
    }

    if (institutionFilter !== 'الكل') {
      filtered = filtered.filter(student => student.originalInstitution === institutionFilter);
    }

    setFilteredStudents(filtered);
  };

  // حساب الإحصائيات
  const calculateStats = () => {
    const totalStudents = students.length;
    const requestsSent = students.filter(s => s.requestCount > 0).length;
    const filesReceived = students.filter(s => s.fileStatus === 'ملف تم التوصل به').length;
    const pendingFiles = totalStudents - filesReceived;

    // إحصائيات حسب المستوى
    const byLevel: { [key: string]: number } = {};
    students.forEach(student => {
      byLevel[student.level] = (byLevel[student.level] || 0) + 1;
    });

    // إحصائيات حسب المؤسسة
    const byInstitution: { [key: string]: number } = {};
    students.forEach(student => {
      if (student.originalInstitution) {
        byInstitution[student.originalInstitution] = (byInstitution[student.originalInstitution] || 0) + 1;
      }
    });

    // إحصائيات حسب الحالة
    const byStatus: { [key: string]: number } = {};
    students.forEach(student => {
      byStatus[student.fileStatus] = (byStatus[student.fileStatus] || 0) + 1;
    });

    setStats({
      totalStudents,
      requestsSent,
      filesReceived,
      pendingFiles,
      byLevel,
      byInstitution,
      byStatus
    });
  };

  // تحديث حالة التلميذ
  const updateStudentStatus = async (studentId: string, status: IncomingStudent['fileStatus'], notes?: string) => {
    try {
      await incomingStudentsDB.updateStudentStatus(studentId, status, notes);
      await loadData();
    } catch (error) {
      console.error('خطأ في تحديث حالة التلميذ:', error);
      alert('خطأ في تحديث حالة التلميذ');
    }
  };

  // إرسال طلب ملف
  const sendFileRequest = async (studentIds: string[]) => {
    try {
      for (const studentId of studentIds) {
        await incomingStudentsDB.addFileRequest(studentId);
      }
      await loadData();
      setSelectedStudents(new Set());
    } catch (error) {
      console.error('خطأ في إرسال طلب الملف:', error);
      alert('خطأ في إرسال طلب الملف');
    }
  };

  // حذف تلميذ
  const deleteStudent = async (studentId: string) => {
    if (confirm('هل أنت متأكد من حذف هذا التلميذ من قائمة الوافدين؟')) {
      try {
        await incomingStudentsDB.deleteStudent(studentId);
        await loadData();
      } catch (error) {
        console.error('خطأ في حذف التلميذ:', error);
        alert('خطأ في حذف التلميذ');
      }
    }
  };

  // حذف التلاميذ المحددين
  const deleteSelectedStudents = async () => {
    if (selectedStudents.size === 0) {
      alert('يرجى تحديد التلاميذ المراد حذفهم');
      return;
    }

    if (confirm(`هل أنت متأكد من حذف ${selectedStudents.size} تلميذ من قائمة الوافدين؟`)) {
      try {
        await incomingStudentsDB.deleteMultipleStudents(Array.from(selectedStudents));
        await loadData();
        setSelectedStudents(new Set());
      } catch (error) {
        console.error('خطأ في حذف التلاميذ المحددين:', error);
        alert('خطأ في حذف التلاميذ المحددين');
      }
    }
  };

  // تفريغ قاعدة بيانات الوافدين
  const clearIncomingDatabase = async () => {
    if (confirm('هل أنت متأكد من تفريغ قاعدة بيانات التلاميذ الوافدين بالكامل؟ سيتم حذف جميع البيانات والطلبات نهائياً.')) {
      try {
        await incomingStudentsDB.clearAllData();
        await loadData();
        setSelectedStudents(new Set());
        alert('تم تفريغ قاعدة بيانات التلاميذ الوافدين بنجاح!');
      } catch (error) {
        console.error('خطأ في تفريغ قاعدة البيانات:', error);
        alert('خطأ في تفريغ قاعدة البيانات');
      }
    }
  };

  // تحديد/إلغاء تحديد تلميذ
  const toggleStudentSelection = (studentId: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  // تحديد/إلغاء تحديد الكل
  const toggleSelectAll = () => {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
    }
  };

  // تصدير البيانات
  const exportData = () => {
    const dataToExport = filteredStudents.map((student, index) => ({
      'رت': index + 1,
      'الرقم الوطني': student.nationalId,
      'الاسم الكامل': `${student.firstName} ${student.lastName}`,
      'النوع': student.gender,
      'تاريخ الميلاد': student.dateOfBirth,
      'مكان الميلاد': student.birthPlace,
      'المستوى': student.level,
      'القسم': student.section,
      'المؤسسة السابقة': student.previousInstitution,
      'تاريخ الالتحاق': student.enrollmentDate,
      'وضعية الملف': student.fileStatus,
      'عدد المراسلات': student.requestCount,
      'آخر تاريخ إرسال': student.lastRequestDate || '',
      'ملاحظات': student.notes,
      'تاريخ الإنشاء': new Date(student.createdAt).toLocaleDateString('ar-EG')
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'التلاميذ الوافدين');
    XLSX.writeFile(workbook, `التلاميذ_الوافدين_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // الحصول على لون الحالة
  const getStatusColor = (status: IncomingStudent['fileStatus']) => {
    switch (status) {
      case 'لم يتم الإرسال': return 'bg-red-50 text-red-800 border-red-200';
      case 'طلب مرسل': return 'bg-green-50 text-green-800 border-green-200';
      case 'ملف تم التوصل به': return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'مكرر': return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'غير معروف': return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      default: return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  // الحصول على المستويات الفريدة
  const getUniqueLevels = () => {
    return Array.from(new Set(students.map(s => s.level).filter(Boolean)));
  };

  // الحصول على المؤسسات الفريدة
  const getUniqueInstitutions = () => {
    return Array.from(new Set(students.map(s => s.originalInstitution).filter(Boolean)));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg">جاري تحميل نظام إدارة التلاميذ الوافدين...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* عنوان الصفحة */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
            تدبير حركية التلاميذ الوافدين
          </h1>
          <p className="text-gray-600 text-lg">نظام شامل لإدارة التلاميذ الوافدين مع تتبع الملفات والمراسلات</p>
          <div className="mt-4 w-24 h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mx-auto"></div>
        </div>

        {/* الإحصائيات الرئيسية */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">إجمالي الوافدين</span>
            </div>
            <p className="text-3xl font-bold text-blue-600">{stats.totalStudents}</p>
            <p className="text-xs text-gray-500 mt-1">تلميذ وافد</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Send className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700">طلبات مرسلة</span>
            </div>
            <p className="text-3xl font-bold text-green-600">{stats.requestsSent}</p>
            <p className="text-xs text-gray-500 mt-1">
              {stats.totalStudents > 0 ? Math.round((stats.requestsSent / stats.totalStudents) * 100) : 0}% من الإجمالي
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <FileCheck className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">ملفات متوصل بها</span>
            </div>
            <p className="text-3xl font-bold text-purple-600">{stats.filesReceived}</p>
            <p className="text-xs text-gray-500 mt-1">
              {stats.requestsSent > 0 ? Math.round((stats.filesReceived / stats.requestsSent) * 100) : 0}% من المرسلة
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium text-gray-700">ملفات متبقية</span>
            </div>
            <p className="text-3xl font-bold text-orange-600">{stats.pendingFiles}</p>
            <p className="text-xs text-gray-500 mt-1">في الانتظار</p>
          </div>
        </div>

        {/* قائمة الأقسام */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
           {[
            { id: 'management', label: 'إدارة الوافدين', icon: Users, color: 'purple' },
           { id: 'import', label: 'استيراد الوافدين', icon: Upload, color: 'green' },
            { id: 'overview', label: 'نظرة عامة', icon: BarChart3, color: 'blue' }
       
         
          ].map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`p-4 rounded-xl text-center transition-all duration-200 ${
                  activeTab === tab.id
                    ? `bg-${tab.color}-600 text-white shadow-lg transform scale-105`
                    : `bg-white text-gray-700 hover:bg-${tab.color}-50 shadow-sm hover:shadow-md border border-gray-100`
                }`}
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3 ${
                  activeTab === tab.id 
                    ? 'bg-white bg-opacity-20' 
                    : `bg-${tab.color}-100`
                }`}>
                  <IconComponent className={`w-6 h-6 ${
                    activeTab === tab.id 
                      ? 'text-white' 
                      : `text-${tab.color}-600`
                  }`} />
                </div>
                <h3 className="font-semibold text-sm">{tab.label}</h3>
              </button>
            );
          })}
        </div>

        {/* محتوى الأقسام */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          {/* نظرة عامة */}
          {activeTab === 'overview' && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">نظرة عامة على التلاميذ الوافدين</h2>
              
              {/* إحصائيات حسب الحالة */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                {Object.entries(stats.byStatus).map(([status, count]) => (
                  <div key={status} className={`p-4 rounded-lg text-center border ${getStatusColor(status as IncomingStudent['fileStatus'])}`}>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-sm font-medium">{status}</div>
                    <div className="text-xs mt-1">
                      {stats.totalStudents > 0 ? Math.round((count / stats.totalStudents) * 100) : 0}%
                    </div>
                  </div>
                ))}
              </div>

              {/* إحصائيات حسب المستوى */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">التوزيع حسب المستوى</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Object.entries(stats.byLevel).map(([level, count]) => (
                    <div key={level} className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="text-xl font-bold text-blue-600">{count}</div>
                      <div className="text-sm text-blue-800">{level}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* إحصائيات حسب المؤسسة */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">التوزيع حسب المؤسسة السابقة</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(stats.byInstitution).slice(0, 6).map(([institution, count]) => (
                    <div key={institution} className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <div className="text-lg font-bold text-purple-600">{count}</div>
                      <div className="text-sm text-purple-800 truncate">{institution}</div>
                    </div>
                  ))}
                </div>
                {Object.keys(stats.byInstitution).length > 6 && (
                  <p className="text-sm text-gray-500 mt-2 text-center">
                    ... و {Object.keys(stats.byInstitution).length - 6} مؤسسة أخرى
                  </p>
                )}
              </div>
            </div>
          )}

          {/* استيراد الوافدين */}
          {activeTab === 'import' && (
            <IncomingStudentImport onImportComplete={loadData} />
          )}

          {/* إدارة الوافدين */}
          {activeTab === 'management' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">إدارة التلاميذ الوافدين</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    <Plus className="w-4 h-4" />
                    إضافة وافد
                  </button>
                  
                  <button
                    onClick={clearIncomingDatabase}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
                  >
                    <Trash2 className="w-4 h-4" />
                    تفريغ القاعدة
                  </button>
                  
                  <button
                    onClick={exportData}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                  >
                    <Download className="w-4 h-4" />
                    تصدير
                  </button>
                </div>
              </div>

              {/* أدوات التصفية */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* البحث */}
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="البحث..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* فلتر المستوى */}
                  <select
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="الكل">جميع المستويات</option>
                    {getUniqueLevels().map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>

                  {/* فلتر الحالة */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="الكل">جميع الحالات</option>
                    <option value="لم يتم الإرسال">لم يتم الإرسال</option>
                    <option value="طلب مرسل">طلب مرسل</option>
                    <option value="ملف تم التوصل به">ملف تم التوصل به</option>
                    <option value="مكرر">مكرر</option>
                    <option value="غير معروف">غير معروف</option>
                  </select>

                  {/* فلتر المؤسسة */}
                  <select
                    value={institutionFilter}
                    onChange={(e) => setInstitutionFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="الكل">جميع المؤسسات</option>
                    {getUniqueInstitutions().map(institution => (
                      <option key={institution} value={institution}>{institution}</option>
                    ))}
                  </select>

                  {/* أزرار الإجراءات */}
                  <div className="flex gap-2">
                    <button
                      onClick={toggleSelectAll}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm"
                    >
                      {selectedStudents.size === filteredStudents.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                    </button>
                     
                    {selectedStudents.size > 0 && (
                      <button
                        onClick={() => setShowRequestForm(true)}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm"
                      >
                        طلب ملفات ({selectedStudents.size})
                      </button>
                    )}
                    
                    {selectedStudents.size > 0 && (
                      <button
                        onClick={deleteSelectedStudents}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 text-sm"
                      >
                        حذف المحدد ({selectedStudents.size})
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* جدول التلاميذ */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right">
                        <input
                          type="checkbox"
                          checked={selectedStudents.size === filteredStudents.length && filteredStudents.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 text-blue-600"
                        />
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التلميذ</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">رقم التلميذ</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">المستوى</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">القسم</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">الجنس</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">المؤسسة الأصلية</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">وضعية الملف</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">المراسلات</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">آخر إرسال</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center">
                          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500 text-lg">لا يوجد تلاميذ وافدين</p>
                          <p className="text-gray-400 text-sm mt-2">ابدأ بإضافة أو استيراد التلاميذ الوافدين</p>
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selectedStudents.has(student.id)}
                              onChange={() => toggleStudentSelection(student.id)}
                              className="rounded border-gray-300 text-blue-600"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {student.firstName} {student.lastName}
                              </div>
                              <div className="text-xs text-gray-500">{student.nationalId}</div>
                              {student.isLinked && (
                                <div className="text-xs text-green-600 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  مرتبط
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="text-sm font-mono text-gray-900">{student.studentId}</div>
                          </td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900">{student.level}</td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900">
                            {student.linkedSection || 'غير معروف'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              student.linkedGender === 'ذكر' ? 'bg-blue-100 text-blue-800' :
                              student.linkedGender === 'أنثى' ? 'bg-pink-100 text-pink-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {student.linkedGender || 'غير محدد'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900 max-w-32 truncate">
                            {student.originalInstitution || 'غير محدد'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <select
                              value={student.fileStatus}
                              onChange={(e) => updateStudentStatus(student.id, e.target.value as IncomingStudent['fileStatus'])}
                              className={`px-2 py-1 text-xs font-semibold rounded border ${getStatusColor(student.fileStatus)}`}
                            >
                              <option value="لم يتم الإرسال">لم يتم الإرسال</option>
                              <option value="طلب مرسل">طلب مرسل</option>
                              <option value="ملف تم التوصل به">ملف تم التوصل به</option>
                              <option value="مكرر">مكرر</option>
                              <option value="غير معروف">غير معروف</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="text-lg font-bold text-blue-600">{student.requestCount}</div>
                            <div className="text-xs text-gray-500">مراسلة</div>
                          </td>
                          <td className="px-6 py-4 text-center text-sm text-gray-500">
                            {student.lastRequestDate ? new Date(student.lastRequestDate).toLocaleDateString('fr-MA') : '-'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setShowForm(true);
                                }}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                                title="تعديل"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => setShowRequestForm(true)}
                                className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors duration-200"
                                title="طلب ملف"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => deleteStudent(student.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                                title="حذف"
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
          )}
        </div>

        {/* نموذج إضافة/تعديل تلميذ وافد */}
        {showForm && (
          <IncomingStudentForm
            student={selectedStudent}
            onSave={async (studentData) => {
              try {
                if (selectedStudent) {
                  await incomingStudentsDB.updateStudent(selectedStudent.id, studentData);
                } else {
                  await incomingStudentsDB.addStudent(studentData);
                }
                await loadData();
                setShowForm(false);
                setSelectedStudent(null);
              } catch (error) {
                console.error('خطأ في حفظ التلميذ:', error);
                alert('خطأ في حفظ بيانات التلميذ');
              }
            }}
            onCancel={() => {
              setShowForm(false);
              setSelectedStudent(null);
            }}
          />
        )}

        {/* نموذج طلب الملفات */}
        {showRequestForm && (
          <IncomingStudentRequestForm
            students={filteredStudents.filter(s => selectedStudents.has(s.id))}
            onRequestSent={async () => {
              await sendFileRequest(Array.from(selectedStudents));
              setShowRequestForm(false);
            }}
            onCancel={() => setShowRequestForm(false)}
          />
        )}
      </div>
    </div>
  );
};
 

export default IncomingStudentsManagement