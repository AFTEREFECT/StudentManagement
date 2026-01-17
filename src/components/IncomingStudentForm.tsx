import React, { useState, useEffect } from 'react';
import { X, User, Calendar, Building, FileText } from 'lucide-react';

interface IncomingStudent {
  id: string;
  studentId: string;
  lastName: string;
  firstName: string;
  transferDate: string;
  transferType: string;
  originalInstitution: string;
  originalDirectorate: string;
  originalAcademy: string;
  academy: string;
  directorate: string;
  level: string;
  municipality: string;
  institution: string;
  academicYear: string;
  fileStatus: 'لم يتم الإرسال' | 'طلب مرسل' | 'ملف تم التوصل به' | 'مكرر' | 'غير معروف';
  requestCount: number;
  requestDates: string[];
  lastRequestDate?: string;
  notes: string;
  linkedGender?: 'ذكر' | 'أنثى' | 'غير محدد';
  linkedSection?: string;
  linkedNationalId?: string;
  isLinked: boolean;
  createdAt: string;
  updatedAt: string;
}

interface IncomingStudentFormProps {
  student?: IncomingStudent | null;
  onSave: (student: Omit<IncomingStudent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const IncomingStudentForm: React.FC<IncomingStudentFormProps> = ({ student, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    studentId: '',
    lastName: '',
    firstName: '',
    transferDate: new Date().toISOString().split('T')[0],
    transferType: 'تحويل عادي',
    originalInstitution: '',
    originalDirectorate: '',
    originalAcademy: '',
    academy: '',
    directorate: '',
    level: '',
    municipality: '',
    institution: '',
    academicYear: '2025/2026',
    fileStatus: 'لم يتم الإرسال' as IncomingStudent['fileStatus'],
    requestCount: 0,
    requestDates: [] as string[],
    notes: ''
  });

  useEffect(() => {
    if (student) {
      setFormData({
        studentId: student.studentId,
        lastName: student.lastName,
        firstName: student.firstName,
        transferDate: student.transferDate,
        transferType: student.transferType,
        originalInstitution: student.originalInstitution,
        originalDirectorate: student.originalDirectorate,
        originalAcademy: student.originalAcademy,
        academy: student.academy,
        directorate: student.directorate,
        level: student.level,
        municipality: student.municipality,
        institution: student.institution,
        academicYear: student.academicYear,
        fileStatus: student.fileStatus,
        requestCount: student.requestCount,
        requestDates: student.requestDates,
        notes: student.notes
      });
    }
  }, [student]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* رأس النموذج */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {student ? 'تعديل بيانات التلميذ الوافد' : 'إضافة تلميذ وافد جديد'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* نموذج البيانات */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* البيانات الشخصية */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              البيانات الشخصية
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* رقم التلميذ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  رقم التلميذ *
                </label>
                <input
                  type="text"
                  name="studentId"
                  value={formData.studentId}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* النسب */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  النسب *
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* الاسم الشخصي */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الاسم الشخصي *
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* تاريخ التحويل */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تاريخ التحويل
                </label>
                <input
                  type="date"
                  name="transferDate"
                  value={formData.transferDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* نوع التحويل */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نوع التحويل
                </label>
                <select
                  name="transferType"
                  value={formData.transferType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="تحويل عادي">تحويل عادي</option>
                  <option value="تحويل استثنائي">تحويل استثنائي</option>
                  <option value="تحويل إداري">تحويل إداري</option>
                  <option value="تحويل طبي">تحويل طبي</option>
                </select>
              </div>
            </div>
          </div>

          {/* بيانات المؤسسة الأصلية */}
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
              <Building className="w-5 h-5" />
              بيانات المؤسسة الأصلية
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* المؤسسة الأصلية */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المؤسسة الأصلية *
                </label>
                <input
                  type="text"
                  name="originalInstitution"
                  value={formData.originalInstitution}
                  onChange={handleChange}
                  required
                  placeholder="مثال: ثانوية الحسن الثاني التأهيلية"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* المديرية الأصلية */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المديرية الأصلية
                </label>
                <input
                  type="text"
                  name="originalDirectorate"
                  value={formData.originalDirectorate}
                  onChange={handleChange}
                  placeholder="مثال: المديرية الإقليمية للرباط"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* الأكاديمية الأصلية */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الأكاديمية الأصلية
                </label>
                <input
                  type="text"
                  name="originalAcademy"
                  value={formData.originalAcademy}
                  onChange={handleChange}
                  placeholder="مثال: أكاديمية الرباط سلا القنيطرة"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* البيانات الوصفية للمؤسسة الحالية */}
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              بيانات المؤسسة الحالية
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* المستوى */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المستوى *
                </label>
                <input
                  type="text"
                  name="level"
                  value={formData.level}
                  onChange={handleChange}
                  required
                  placeholder="مثال: الثانية باكالوريا"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* الأكاديمية */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الأكاديمية
                </label>
                <input
                  type="text"
                  name="academy"
                  value={formData.academy}
                  onChange={handleChange}
                  placeholder="مثال: أكاديمية الرباط سلا القنيطرة"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* المديرية */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المديرية
                </label>
                <input
                  type="text"
                  name="directorate"
                  value={formData.directorate}
                  onChange={handleChange}
                  placeholder="مثال: المديرية الإقليمية للرباط"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* المؤسسة الحالية */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المؤسسة الحالية
                </label>
                <input
                  type="text"
                  name="institution"
                  value={formData.institution}
                  onChange={handleChange}
                  placeholder="مثال: ثانوية الأندلس التأهيلية"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* الجماعة */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الجماعة
                </label>
                <input
                  type="text"
                  name="municipality"
                  value={formData.municipality}
                  onChange={handleChange}
                  placeholder="مثال: جماعة أكدال الرياض"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* السنة الدراسية */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  السنة الدراسية
                </label>
                <input
                  type="text"
                  name="academicYear"
                  value={formData.academicYear}
                  onChange={handleChange}
                  placeholder="مثال: 2025/2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* ملاحظات */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              ملاحظات ووضعية الملف
            </h3>
            <div className="space-y-4">
              {/* وضعية الملف */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  وضعية الملف
                </label>
                <select
                  name="fileStatus"
                  value={formData.fileStatus}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="لم يتم الإرسال">لم يتم الإرسال</option>
                  <option value="طلب مرسل">طلب مرسل</option>
                  <option value="ملف تم التوصل به">ملف تم التوصل به</option>
                  <option value="مكرر">مكرر</option>
                  <option value="غير معروف">غير معروف</option>
                </select>
              </div>

              {/* ملاحظات */}
              <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ملاحظات
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={4}
                placeholder="أي ملاحظات إضافية حول التلميذ الوافد..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            </div>
          </div>

          {/* أزرار التحكم */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              {student ? 'تحديث بيانات التلميذ الوافد' : 'إضافة التلميذ الوافد'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IncomingStudentForm;