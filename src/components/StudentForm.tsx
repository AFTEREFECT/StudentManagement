import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { dbManager } from '../utils/database';
import { Student } from '../types';

interface StudentFormProps {
  student?: Student | null;
  onSave: (student: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const StudentForm: React.FC<StudentFormProps> = ({ student, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    nationalId: '',
    gender: 'ذكر' as 'ذكر' | 'أنثى',
    birthPlace: '',
    dateOfBirth: '',
    email: '',
    phone: '',
    studentId: '',
    grade: '',
    section: '',
    level: '',
    enrollmentDate: '',
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
    status: 'متمدرس' as 'منقطع' | 'مدمج ' | 'غ ملتحق' | 'مغادر' | 'وافد',
    // الحقول الجديدة للإحصائيات المتقدمة
    ageGroup: '',
    schoolType: '',
    academicYear: '2025/2026',
    region: '',
    province: '',
    municipality: '',
    institution: ''
  });

  const [levels, setLevels] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  useEffect(() => {
    loadLevelsAndSections();
  }, []);

  // تحميل المستويات والأقسام
  const loadLevelsAndSections = async () => {
    try {
      const [levelsData, sectionsData] = await Promise.all([
        dbManager.getLevels(),
        dbManager.getSections()
      ]);
      setLevels(levelsData);
      setSections(sectionsData);
    } catch (error) {
      console.error('خطأ في تحميل المستويات والأقسام:', error);
    }
  };

  useEffect(() => {
    if (student) {
      setFormData({
        firstName: student.firstName,
        lastName: student.lastName,
        nationalId: student.nationalId,
        gender: student.gender,
        birthPlace: student.birthPlace,
        dateOfBirth: student.dateOfBirth,
        email: student.email,
        phone: student.phone,
        studentId: student.studentId,
        grade: student.grade,
        section: student.section,
        level: student.level,
        enrollmentDate: student.enrollmentDate,
        address: student.address,
        emergencyContact: student.emergencyContact,
        emergencyPhone: student.emergencyPhone,
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
        guardianRelation: student.guardianRelation,
        socialSupport: student.socialSupport,
        transportService: student.transportService,
        medicalInfo: student.medicalInfo,
        notes: student.notes,
        status: student.status,
        ageGroup: student.ageGroup || '',
        schoolType: student.schoolType || '',
        academicYear: student.academicYear || '2025/2026', 
        region: student.region || '',
        province: student.province || '',
        municipality: student.municipality || '',
        institution: student.institution || ''
      });
    }
  }, [student]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  // حساب الفئة العمرية تلقائياً عند تغيير تاريخ الميلاد
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

  const handleDateOfBirthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const birthDate = e.target.value;
    setFormData(prev => ({
      ...prev,
      dateOfBirth: birthDate,
      ageGroup: calculateAgeGroup(birthDate)
    }));
  };

  // معالجة تغيير المستوى
  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedLevelId = e.target.value;
    const selectedLevel = levels.find(l => l.level_id === selectedLevelId);
    
    setFormData(prev => ({
      ...prev,
      levelId: selectedLevelId,
      level: selectedLevel ? selectedLevel.level_name : '',
      sectionId: '', // إعادة تعيين القسم عند تغيير المستوى
      section: ''
    }));
  };

  // معالجة تغيير القسم
  const handleSectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSectionId = e.target.value;
    const selectedSection = sections.find(s => s.class_id === selectedSectionId);
    
    setFormData(prev => ({
      ...prev,
      sectionId: selectedSectionId,
      section: selectedSection ? selectedSection.class_name : ''
    }));
  };

  // الحصول على الأقسام المتاحة للمستوى المحدد
  const getAvailableSections = () => {
    if (!formData.levelId) return [];
    return sections.filter(s => s.level_id === formData.levelId);
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* رأس النموذج */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {student ? 'تعديل بيانات التلميذ' : 'إضافة تلميذ جديد'}
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
            <h3 className="text-lg font-semibold text-blue-900 mb-4">البيانات الشخصية</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* الرقم الوطني */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الرقم الوطني *
                </label>
                <input
                  type="text"
                  name="nationalId"
                  value={formData.nationalId}
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

              {/* الاسم العائلي */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الاسم العائلي *
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

              {/* النوع */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  النوع *
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ذكر">ذكر</option>
                  <option value="أنثى">أنثى</option>
                </select>
              </div>

              {/* مكان الازدياد */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  مكان الازدياد
                </label>
                <input
                  type="text"
                  name="birthPlace"
                  value={formData.birthPlace}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* تاريخ الازدياد */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تاريخ الازدياد
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleDateOfBirthChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* الفئة العمرية (محسوبة تلقائياً) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الفئة العمرية
                </label>
                <input
                  type="text"
                  name="ageGroup"
                  value={formData.ageGroup}
                  onChange={handleChange}
                  placeholder="محسوبة تلقائياً من تاريخ الميلاد"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* البيانات الأكاديمية */}
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-green-900 mb-4">البيانات الأكاديمية</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* الرقم الجامعي */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الرقم الجامعي/المدرسي *
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

              {/* القسم */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  القسم *
                </label>
                <select
                  name="sectionId"
                  value={formData.sectionId}
                  onChange={handleSectionChange}
               
                  disabled={!formData.levelId}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">اختر القسم</option>
                  {getAvailableSections().map(section => (
                    <option key={section.class_id} value={section.class_id}>
                      {section.class_name}
                    </option>
                  ))}
                </select>
                {!formData.levelId && (
                  <p className="text-xs text-gray-500 mt-1">يجب اختيار المستوى أولاً</p>
                )}
              </div>

              {/* المستوى */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المستوى *
                </label>
                <select
                  name="levelId"
                  value={formData.levelId}
                  onChange={handleLevelChange}
                
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">اختر المستوى</option>
                  {levels.map(level => (
                    <option key={level.level_id} value={level.level_id}>
                      {level.level_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* الصف */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الصف
                </label>
                <input
                  type="text"
                  name="grade"
                  value={formData.grade}
                  onChange={handleChange}
                  placeholder="مثال: الصف العاشر، الحادي عشر"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* تاريخ التسجيل */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تاريخ التسجيل *
                </label>
                <input
                  type="date"
                  name="enrollmentDate"
                  value={formData.enrollmentDate}
                  onChange={handleChange}
                  required
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

              {/* نوع المدرسة */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نوع المدرسة
                </label>
                <select
                  name="schoolType"
                  value={formData.schoolType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">اختر نوع المدرسة</option>
                  <option value="ابتدائي">ابتدائي</option>
                  <option value="إعدادي">إعدادي</option>
                  <option value="ثانوي">ثانوي</option>
                  <option value="جامعي">جامعي</option>
                  <option value="تكوين مهني">تكوين مهني</option>
                </select>
              </div>

              {/* حالة التلميذ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الحالة
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="متمدرس">متمدرس</option>
                  <option value="وافد">وافد</option>
                  <option value="مغادر">مغادر</option>
                  <option value="غ ملتحق">غ ملتحق</option>
                  <option value="منقطع">منقطع</option>
                </select>
              </div>
            </div>
          </div>

          {/* البيانات الجغرافية والإدارية */}
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-purple-900 mb-4">البيانات الجغرافية والإدارية</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* الجهة */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الجهة
                </label>
                <input
                  type="text"
                  name="region"
                  value={formData.region}
                  onChange={handleChange}
                  placeholder="مثال: الرباط سلا القنيطرة"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* الإقليم/العمالة */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الإقليم/العمالة
                </label>
                <input
                  type="text"
                  name="province"
                  value={formData.province}
                  onChange={handleChange}
                  placeholder="مثال: الرباط، سلا، القنيطرة"
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
                  placeholder="مثال: أكدال الرياض، حسان"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* المؤسسة */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المؤسسة
                </label>
                <input
                  type="text"
                  name="institution"
                  value={formData.institution}
                  onChange={handleChange}
                  placeholder="اسم المؤسسة التعليمية"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* بيانات الاتصال */}
          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-orange-900 mb-4">بيانات الاتصال</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* البريد الإلكتروني */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* رقم الهاتف */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  رقم الهاتف
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* العنوان */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  العنوان
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* بيانات ولي الأمر */}
          <div className="bg-teal-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-teal-900 mb-4">بيانات ولي الأمر</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* اسم ولي الأمر */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم ولي الأمر
                </label>
                <input
                  type="text"
                  name="guardianName"
                  value={formData.guardianName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* هاتف ولي الأمر */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  هاتف ولي الأمر
                </label>
                <input
                  type="tel"
                  name="guardianPhone"
                  value={formData.guardianPhone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* صلة القرابة */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  صلة القرابة
                </label>
                <input
                  type="text"
                  name="guardianRelation"
                  value={formData.guardianRelation}
                  onChange={handleChange}
                  placeholder="مثال: الأب، الأم، الأخ"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* جهة اتصال الطوارئ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  جهة اتصال الطوارئ
                </label>
                <input
                  type="text"
                  name="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* هاتف الطوارئ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  هاتف الطوارئ
                </label>
                <input
                  type="tel"
                  name="emergencyPhone"
                  value={formData.emergencyPhone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* الخدمات والمعلومات الإضافية */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">الخدمات والمعلومات الإضافية</h3>
            <div className="space-y-4">
              {/* الخدمات */}
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="socialSupport"
                    checked={formData.socialSupport}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="mr-2 text-sm font-medium text-gray-700">الدعم الاجتماعي</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="transportService"
                    checked={formData.transportService}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="mr-2 text-sm font-medium text-gray-700">خدمة النقل</span>
                </label>
              </div>

              {/* المعلومات الطبية */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المعلومات الطبية
                </label>
                <textarea
                  name="medicalInfo"
                  value={formData.medicalInfo}
                  onChange={handleChange}
                  rows={2}
                  placeholder="أي معلومات طبية مهمة أو حساسيات"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
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
                  rows={3}
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
              {student ? 'تحديث بيانات التلميذ' : 'إضافة التلميذ'}
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

export default StudentForm;