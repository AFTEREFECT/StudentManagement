import React, { useState, useEffect } from 'react';
import {
  Users, Upload, Download, FileText, Send, CheckCircle, AlertCircle, Search,
  Filter, Plus, Edit, Trash2, Eye, Calendar, Building, Mail, RefreshCw,
  BarChart3, Clock, FileCheck, X, FolderOpen, Link2, UserX, Settings
} from 'lucide-react';
import { outgoingStudentsDB, OutgoingStudent } from '../utils/outgoingStudentsDatabase';
import OutgoingStudentImport from './OutgoingStudentImport';
import OutgoingStudentSendForm from './OutgoingStudentSendForm';
import * as XLSX from 'xlsx';

const OutgoingStudentsManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'management' | 'import' | 'send' | 'statistics'>('management');
  const [students, setStudents] = useState<OutgoingStudent[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<OutgoingStudent[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('الكل');
  const [levelFilter, setLevelFilter] = useState('الكل');
  const [destinationFilter, setDestinationFilter] = useState('الكل');

  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [showSendForm, setShowSendForm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<OutgoingStudent | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterStudents();
  }, [students, searchTerm, statusFilter, levelFilter, destinationFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await outgoingStudentsDB.getAllStudents();
      setStudents(data);
    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterStudents = () => {
    let filtered = [...students];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.firstName.toLowerCase().includes(term) ||
        s.lastName.toLowerCase().includes(term) ||
        s.studentId.toLowerCase().includes(term) ||
        s.destinationInstitution.toLowerCase().includes(term)
      );
    }

    if (statusFilter && statusFilter !== 'الكل') {
      filtered = filtered.filter(s => s.fileStatus === statusFilter);
    }

    if (levelFilter && levelFilter !== 'الكل') {
      filtered = filtered.filter(s => s.level === levelFilter);
    }

    if (destinationFilter && destinationFilter !== 'الكل') {
      filtered = filtered.filter(s => s.destinationInstitution === destinationFilter);
    }

    setFilteredStudents(filtered);
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const handleSendFiles = () => {
    if (selectedStudents.size > 0) {
      setShowSendForm(true);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (confirm('هل أنت متأكد من حذف هذا التلميذ المغادر؟')) {
      try {
        await outgoingStudentsDB.deleteStudent(studentId);
        await loadData();
        alert('تم حذف التلميذ بنجاح');
      } catch (error) {
        alert('حدث خطأ أثناء الحذف');
      }
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedStudents.size === 0) return;

    if (confirm(`هل أنت متأكد من حذف ${selectedStudents.size} تلميذ؟`)) {
      try {
        await outgoingStudentsDB.deleteMultipleStudents(Array.from(selectedStudents));
        setSelectedStudents(new Set());
        await loadData();
        alert('تم الحذف بنجاح');
      } catch (error) {
        alert('حدث خطأ أثناء الحذف');
      }
    }
  };

  const exportToExcel = () => {
    const dataToExport = filteredStudents.map(s => ({
      'رقم التلميذ': s.studentId,
      'الاسم الكامل': `${s.firstName} ${s.lastName}`,
      'الجنس': s.gender || 'غير محدد',
      'المستوى': s.level,
      'تاريخ التحويل': s.transferDate,
      'نوع التحويل': s.transferType,
      'المؤسسة الأصلية': s.originalInstitution,
      'مؤسسة الاستقبال': s.destinationInstitution,
      'المديرية المستقبلة': s.destinationDirectorate,
      'الأكاديمية المستقبلة': s.destinationAcademy,
      'حالة الملف': s.fileStatus,
      'المرجع الإداري': s.administrativeReference,
      'عدد الإرسالات': s.sendCount,
      'آخر إرسال': s.lastSendDate ? new Date(s.lastSendDate).toLocaleDateString('ar') : '-',
      'ملاحظات': s.notes
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'المغادرين');
    XLSX.writeFile(wb, `التلاميذ_المغادرين_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getStatusColor = (status: OutgoingStudent['fileStatus']) => {
    switch (status) {
      case 'لم يُرسل': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'تم الإرسال': return 'bg-green-100 text-green-800 border-green-300';
      case 'مؤجل': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'ملغى': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: OutgoingStudent['fileStatus']) => {
    switch (status) {
      case 'لم يُرسل': return <Clock className="w-4 h-4" />;
      case 'تم الإرسال': return <CheckCircle className="w-4 h-4" />;
      case 'مؤجل': return <AlertCircle className="w-4 h-4" />;
      case 'ملغى': return <X className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const levels = ['الكل', ...new Set(students.map(s => s.level).filter(Boolean))];
  const destinations = ['الكل', ...new Set(students.map(s => s.destinationInstitution).filter(Boolean))];

  const statistics = {
    total: students.length,
    notSent: students.filter(s => s.fileStatus === 'لم يُرسل').length,
    sent: students.filter(s => s.fileStatus === 'تم الإرسال').length,
    postponed: students.filter(s => s.fileStatus === 'مؤجل').length,
    cancelled: students.filter(s => s.fileStatus === 'ملغى').length,
    males: students.filter(s => s.gender === 'ذكر').length,
    females: students.filter(s => s.gender === 'أنثى').length
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
            <Send className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">تدبير المغادرين</h1>
            <p className="text-gray-600">إدارة التلاميذ المغادرين ومتابعة إرسال الملفات</p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">المجموع</span>
            </div>
            <p className="text-3xl font-bold text-blue-600">{statistics.total}</p>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-900">لم يُرسل</span>
            </div>
            <p className="text-3xl font-bold text-gray-600">{statistics.notSent}</p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-900">تم الإرسال</span>
            </div>
            <p className="text-3xl font-bold text-green-600">{statistics.sent}</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-xl border border-yellow-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-900">مؤجل</span>
            </div>
            <p className="text-3xl font-bold text-yellow-600">{statistics.postponed}</p>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <X className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-red-900">ملغى</span>
            </div>
            <p className="text-3xl font-bold text-red-600">{statistics.cancelled}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('management')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'management'
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            إدارة المغادرين
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'import'
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            استيراد ملفات الاكسيل
          </button>
          <button
            onClick={() => setActiveTab('statistics')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'statistics'
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            إحصائيات
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'management' && (
        <div className="space-y-6">
          {/* Search and Filters */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="ابحث بالاسم أو رقم التلميذ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="الكل">كل الحالات</option>
                <option value="لم يُرسل">لم يُرسل</option>
                <option value="تم الإرسال">تم الإرسال</option>
                <option value="مؤجل">مؤجل</option>
                <option value="ملغى">ملغى</option>
              </select>

              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                {levels.map(level => (
                  <option key={level} value={level}>{level || 'غير محدد'}</option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSendFiles}
                disabled={selectedStudents.size === 0}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                إرسال الملفات ({selectedStudents.size})
              </button>
              <button
                onClick={exportToExcel}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                تصدير Excel
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={selectedStudents.size === 0}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                حذف المحدد
              </button>
              <button
                onClick={loadData}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                تحديث
              </button>
            </div>
          </div>

          {/* Students Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-right">
                      <input
                        type="checkbox"
                        checked={selectedStudents.size === filteredStudents.length && filteredStudents.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">رقم التلميذ</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الاسم الكامل</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">المستوى</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">مؤسسة الاستقبال</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">تاريخ التحويل</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الحالة</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">المرجع</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          جاري التحميل...
                        </div>
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        لا توجد بيانات
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedStudents.has(student.id)}
                            onChange={() => toggleStudentSelection(student.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{student.studentId}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {student.firstName} {student.lastName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{student.level}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{student.destinationInstitution}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{student.transferDate}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(student.fileStatus)}`}>
                            {getStatusIcon(student.fileStatus)}
                            {student.fileStatus}
                          </span> 
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {student.administrativeReference || '-'}
                        </td>
                       
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedStudent(student);
                                setShowDetails(true);
                              }}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="عرض التفاصيل"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(student.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
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

          <div className="text-sm text-gray-600 text-center">
            عرض {filteredStudents.length} من أصل {students.length} تلميذ
          </div>
        </div>
      )}

      {activeTab === 'import' && (
        <OutgoingStudentImport onImportComplete={loadData} />
      )}

      {activeTab === 'statistics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-8 h-8 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">المجموع الكلي</h3>
              </div>
              <p className="text-4xl font-bold text-blue-600 mb-2">{statistics.total}</p>
              <p className="text-sm text-gray-600">تلميذ مغادر</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">تم الإرسال</h3>
              </div>
              <p className="text-4xl font-bold text-green-600 mb-2">{statistics.sent}</p>
              <p className="text-sm text-gray-600">ملف مرسل</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">توزيع الحالات</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Clock className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-600">{statistics.notSent}</p>
                <p className="text-sm text-gray-600">لم يُرسل</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">{statistics.sent}</p>
                <p className="text-sm text-gray-600">تم الإرسال</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <AlertCircle className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-yellow-600">{statistics.postponed}</p>
                <p className="text-sm text-gray-600">مؤجل</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <X className="w-8 h-8 text-red-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-600">{statistics.cancelled}</p>
                <p className="text-sm text-gray-600">ملغى</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Form Modal */}
      {showSendForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <OutgoingStudentSendForm
              students={students.filter(s => selectedStudents.has(s.id))}
              onRequestSent={() => {
                setShowSendForm(false);
                setSelectedStudents(new Set());
                loadData();
              }}
              onCancel={() => {
                setShowSendForm(false);
                setSelectedStudents(new Set());
              }}
            />
          </div>
        </div>
      )}

      {/* Student Details Modal */}
      {showDetails && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">تفاصيل التلميذ المغادر</h3>
              <button onClick={() => setShowDetails(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">رقم التلميذ</label>
                  <p className="text-lg font-semibold text-gray-900">{selectedStudent.studentId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">الاسم الكامل</label>
                  <p className="text-lg font-semibold text-gray-900">{selectedStudent.firstName} {selectedStudent.lastName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">المستوى</label>
                  <p className="text-gray-900">{selectedStudent.level}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">الجنس</label>
                  <p className="text-gray-900">{selectedStudent.gender || 'غير محدد'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">تاريخ التحويل</label>
                  <p className="text-gray-900">{selectedStudent.transferDate}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">نوع التحويل</label>
                  <p className="text-gray-900">{selectedStudent.transferType}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">المؤسسة الأصلية</label>
                  <p className="text-gray-900">{selectedStudent.originalInstitution}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">مؤسسة الاستقبال</label>
                  <p className="text-gray-900">{selectedStudent.destinationInstitution}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">المديرية المستقبلة</label>
                  <p className="text-gray-900">{selectedStudent.destinationDirectorate}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">الأكاديمية المستقبلة</label>
                  <p className="text-gray-900">{selectedStudent.destinationAcademy}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">حالة الملف</label>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedStudent.fileStatus)}`}>
                    {getStatusIcon(selectedStudent.fileStatus)}
                    {selectedStudent.fileStatus}
                  </span>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">المرجع الإداري</label>
                  <p className="text-gray-900">{selectedStudent.administrativeReference || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">عدد الإرسالات</label>
                  <p className="text-gray-900">{selectedStudent.sendCount}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">آخر إرسال</label>
                  <p className="text-gray-900">{selectedStudent.lastSendDate ? new Date(selectedStudent.lastSendDate).toLocaleDateString('ar') : '-'}</p>
                </div>
              </div>

              {selectedStudent.correspondenceHistory && selectedStudent.correspondenceHistory.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">سجل المراسلات</h4>
                  <div className="space-y-2">
                    {selectedStudent.correspondenceHistory.map((record) => (
                      <div key={record.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-gray-900">رقم {record.sendingNumber}</span>
                          <span className="text-sm text-gray-600">{new Date(record.date).toLocaleDateString('ar')}</span>
                        </div>
                        <p className="text-sm text-gray-600">المرجع: {record.reference}</p>
                        <p className="text-sm text-gray-600">رقم المغادرة: {record.administrativeReference}</p>
                        {record.notes && <p className="text-sm text-gray-600 mt-1">{record.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedStudent.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-600">ملاحظات</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedStudent.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutgoingStudentsManagement;
