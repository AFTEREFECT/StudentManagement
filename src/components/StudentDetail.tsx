import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, Calendar, MapPin, AlertCircle, CalendarDays, AlertTriangle, Clock, XCircle, Send, Key, Edit } from 'lucide-react';
import { Student, AttendanceRecord, GradeRecord } from '../types';
import { StudentScheduleView } from './StudentScheduleView';
import { StudentScheduleAlternate } from './StudentScheduleAlternate';
import { dbManager } from '../utils/database';
import { useSubscription } from '../hooks/useSubscription';

interface StudentDetailProps {
  student: Student;
  onClose: () => void;
}

const StudentDetail: React.FC<StudentDetailProps> = ({ student, onClose }) => {
  const { hasFeature } = useSubscription();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [gradeRecords, setGradeRecords] = useState<GradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleLayout, setScheduleLayout] = useState<'vertical' | 'horizontal'>('vertical');
  const [secretCode, setSecretCode] = useState<string | null>(null);
  const [sendingCredentials, setSendingCredentials] = useState(false);
  const [sendMessage, setSendMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editedGuardianPhone, setEditedGuardianPhone] = useState(student.guardianPhone || '');
  const [editedPhone, setEditedPhone] = useState(student.phone || '');
  const [orderNumber, setOrderNumber] = useState<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('modal-overlay')) {
        onClose();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const loadStudentData = async () => {
      try {
        await dbManager.initialize();
        const [attendance, grades, credential, students] = await Promise.all([
          dbManager.getAttendanceRecords(student.id),
          dbManager.getGradeRecords(student.id),
          dbManager.getStudentCredential(student.nationalId),
          dbManager.getStudents()
        ]);
        setAttendanceRecords(attendance);
        setGradeRecords(grades);
        setSecretCode(credential);

        const studentIndex = students.findIndex(s => s.id === student.id);
        if (studentIndex !== -1) {
          setOrderNumber(studentIndex + 1);
        }
      } catch (error) {
        console.error('خطأ في تحميل بيانات الطالب:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStudentData();
  }, [student.id, student.nationalId]);

  const calculateAttendanceRate = () => {
    if (attendanceRecords.length === 0) return 0;
    const presentCount = attendanceRecords.filter(record => record.status === 'حاضر').length;
    return Math.round((presentCount / attendanceRecords.length) * 100);
  };

  const calculateAverageGrade = () => {
    if (gradeRecords.length === 0) return 0;
    const totalGrade = gradeRecords.reduce((sum, record) => sum + (record.grade / record.maxGrade) * 100, 0);
    return Math.round(totalGrade / gradeRecords.length);
  };

  const absenceCount = attendanceRecords.filter(r => r.status === 'غائب').length;
  const lateCount = attendanceRecords.filter(r => r.status === 'متأخر').length;
  const violationCount = attendanceRecords.filter(r => r.status === 'مخالفة').length;

  const handleSendCredentials = async () => {
    if (!hasFeature('auto_credentials_send')) {
      setSendMessage({ type: 'error', text: 'يجب الاشتراك في الخدمة للاستفادة من هذه الميزة' });
      return;
    }

    if (!secretCode) {
      setSendMessage({ type: 'error', text: 'لا يوجد كود سري لهذا التلميذ' });
      return;
    }

    if (!editedGuardianPhone && !editedPhone) {
      setSendMessage({ type: 'error', text: 'يرجى إدخال رقم هاتف ولي الأمر أو التلميذ' });
      return;
    }

    setSendingCredentials(true);
    setSendMessage(null);

    try {
      await dbManager.initialize();
      const settings = await dbManager.getWhatsAppSettings();

      console.log('🔍 فحص إعدادات واتساب:', {
        hasApiKey: !!settings.apiKey,
        hasInstanceId: !!settings.instanceId,
        apiKeyLength: settings.apiKey?.length || 0,
        instanceId: settings.instanceId || 'غير موجود'
      });

      if (!settings || !settings.apiKey || !settings.instanceId || settings.apiKey.trim() === '' || settings.instanceId.trim() === '') {
        setSendMessage({
          type: 'error',
          text: 'يرجى تكوين إعدادات واتساب أولاً من صفحة الإعدادات'
        });
        setSendingCredentials(false);
        return;
      }

      const targetPhone = editedGuardianPhone || editedPhone;
const msg = `مرحباً ${student.firstName} ${student.lastName},بيانات ولوجك لبوابة متمدرس هي:اسم المستعمل: ${student.nationalId}@taalim.maالقن السري: ${secretCode}رابط متمدرس: https://moutamadris.men.gov.ma/moutamadris/Account
`;


      
      console.log('📤 إرسال الكود السري إلى:', targetPhone);

      const response = await fetch(
        `https://api.ultramsg.com/${settings.instanceId}/messages/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: settings.apiKey,
            to: targetPhone,
            body: message
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('✅ نتيجة الإرسال:', result);
        setSendMessage({
          type: 'success',
          text: `تم إرسال الكود السري بنجاح إلى ${targetPhone}`
        });
      } else {
        const errorText = await response.text();
        console.error('❌ فشل إرسال الرسالة:', errorText);
        setSendMessage({
          type: 'error',
          text: `فشل إرسال الكود السري. حالة: ${response.status}`
        });
      }
    } catch (error) {
      console.error('❌ خطأ في إرسال الكود:', error);
      setSendMessage({
        type: 'error',
        text: 'فشل إرسال الكود السري: ' + (error instanceof Error ? error.message : 'خطأ غير معروف')
      });
    } finally {
      setSendingCredentials(false);
    }
  };

  const handleSavePhoneNumbers = async () => {
    try {
      await dbManager.updateStudent(student.id, {
        guardianPhone: editedGuardianPhone,
        phone: editedPhone
      });
      setIsEditingPhone(false);
      setSendMessage({ type: 'success', text: 'تم تحديث أرقام الهاتف بنجاح' });
    } catch (error) {
      console.error('خطأ في تحديث أرقام الهاتف:', error);
      setSendMessage({ type: 'error', text: 'فشل تحديث أرقام الهاتف' });
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-xl">
          <h2 className="text-2xl font-bold">
            ملف التلميذ الشامل
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {student.firstName} {student.lastName}
                </h3>
                <div className="flex items-center gap-4">
                  <p className="text-gray-600">رمز مسار: {student.nationalId}</p>
                  {orderNumber && (
                    <p className="text-blue-600 font-bold">الرقم الترتيبي: {orderNumber}</p>
                  )}
                </div>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                  student.status === 'نشط' ? 'bg-green-100 text-green-800' :
                  student.status === 'غير نشط' ? 'bg-red-100 text-red-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {student.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">البريد الإلكتروني</span>
                </div>
                <p className="text-gray-600">{student.email || 'غير محدد'}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">رقم الهاتف</span>
                </div>
                <p className="text-gray-600">{student.phone || 'غير محدد'}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">هاتف ولي الأمر</span>
                </div>
                {isEditingPhone ? (
                  <input
                    type="tel"
                    value={editedGuardianPhone}
                    onChange={(e) => setEditedGuardianPhone(e.target.value)}
                    className="w-full px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="أدخل رقم ولي الأمر"
                  />
                ) : (
                  <p className="text-gray-600">{editedGuardianPhone || 'غير محدد'}</p>
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">هاتف التلميذ</span>
                </div>
                {isEditingPhone ? (
                  <input
                    type="tel"
                    value={editedPhone}
                    onChange={(e) => setEditedPhone(e.target.value)}
                    className="w-full px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="أدخل رقم التلميذ"
                  />
                ) : (
                  <p className="text-gray-600">{editedPhone || 'غير محدد'}</p>
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">تاريخ الميلاد</span>
                </div>
                <p className="text-gray-600">{student.dateOfBirth || 'غير محدد'}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">المستوى</span>
                </div>
                <p className="text-gray-600">{student.level || 'غير محدد'}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">القسم</span>
                </div>
                <p className="text-gray-600">{student.section || 'غير محدد'}</p>
              </div>

              {student.address && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-900">العنوان</span>
                  </div>
                  <p className="text-gray-600">{student.address}</p>
                </div>
              )}
            </div>

            {isEditingPhone && (
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleSavePhoneNumbers}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  حفظ التغييرات
                </button>
                <button
                  onClick={() => {
                    setIsEditingPhone(false);
                    setEditedGuardianPhone(student.guardianPhone || '');
                    setEditedPhone(student.phone || '');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            )}

            {!isEditingPhone && (
              <button
                onClick={() => setIsEditingPhone(true)}
                className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                <Edit className="w-4 h-4 inline ml-2" />
                تعديل أرقام الهاتف
              </button>
            )}
          </div>

          {sendMessage && (
            <div className={`mb-6 p-4 rounded-lg ${
              sendMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-300' : 'bg-red-50 text-red-800 border border-red-300'
            }`}>
              <p className="font-medium">{sendMessage.text}</p>
            </div>
          )}

          {secretCode && (
            <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border-2 border-blue-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 p-3 rounded-lg">
                    <Key className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-blue-900 text-lg">الكود السري</h4>
                    <p className="text-blue-700 text-sm">للدخول إلى مسار</p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div className="text-3xl font-bold text-blue-900 font-mono tracking-wider bg-white px-4 py-2 rounded-lg border-2 border-blue-400 shadow-md">
                    {secretCode}
                  </div>
                  <button
                    onClick={handleSendCredentials}
                    disabled={sendingCredentials}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="إرسال الكود عبر واتساب"
                  >
                    <Send className="w-5 h-5" />
                    {sendingCredentials ? 'جاري الإرسال...' : 'إرسال'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-red-50 p-6 rounded-lg border-2 border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-6 h-6 text-red-600" />
                <h4 className="font-bold text-red-900">الغيابات</h4>
              </div>
              <p className="text-3xl font-bold text-red-600">{absenceCount}</p>
              <p className="text-sm text-red-600">حالة غياب مسجلة</p>
            </div>

            <div className="bg-yellow-50 p-6 rounded-lg border-2 border-yellow-200">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-6 h-6 text-yellow-600" />
                <h4 className="font-bold text-yellow-900">التأخرات</h4>
              </div>
              <p className="text-3xl font-bold text-yellow-600">{lateCount}</p>
              <p className="text-sm text-yellow-600">حالة تأخر مسجلة</p>
            </div>

            <div className="bg-orange-50 p-6 rounded-lg border-2 border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
                <h4 className="font-bold text-orange-900">المخالفات</h4>
              </div>
              <p className="text-3xl font-bold text-orange-600">{violationCount}</p>
              <p className="text-sm text-orange-600">مخالفة مسجلة</p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
              <p className="mt-4 text-gray-600">جاري تحميل البيانات...</p>
            </div>
          ) : (
            <>
              {attendanceRecords.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-blue-600" />
                    سجل الحضور والغيابات
                  </h3>
                  <div className=" rounded-lg border-2 border-gray-200">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                        <tr>
                          <th className="  text-right font-bold">التاريخ</th>
                          <th className="px-4 py-3 text-right font-bold">الحصة</th>
                          <th className="px-4 py-3 text-right font-bold">المادة</th>
                          <th className="px-4 py-3 text-center font-bold">الحالة</th>
                          <th className="px-4 py-3 text-right font-bold">ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceRecords.map((record, index) => (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-700">
                              {new Date(record.date).toLocaleDateString('ar-EG')}
                            </td>
                            <td className="px-4 py-3 text-gray-700">{record.period || 'غير محدد'}</td>
                            <td className="px-4 py-3 text-gray-700">{record.subject || 'غير محدد'}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-bold ${
                                record.status === 'حاضر' ? 'bg-green-100 text-green-800' :
                                record.status === 'غائب' ? 'bg-red-100 text-red-800' :
                                record.status === 'متأخر' ? 'bg-yellow-100 text-yellow-800' :
                                record.status === 'مخالفة' ? 'bg-orange-100 text-orange-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {record.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-sm">{record.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {attendanceRecords.length === 0 && (
                <div className="mb-8 bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-blue-600" />
                    <div>
                      <h4 className="font-bold text-blue-900">لا توجد سجلات غياب</h4>
                      <p className="text-blue-700">لم يتم تسجيل أي غيابات أو تأخرات أو مخالفات لهذا التلميذ حتى الآن.</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="mb-8">
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setShowSchedule(!showSchedule)}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
              >
                <CalendarDays className="w-5 h-5" />
                {showSchedule ? 'إخفاء جدول الحصص' : 'عرض جدول الحصص'}
              </button>

              {showSchedule && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setScheduleLayout('vertical')}
                    className={`px-4 py-3 rounded-lg font-bold transition-all ${
                      scheduleLayout === 'vertical'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    title="النسخة العمودية (الحصص صفوف)"
                  >
                    عمودي
                  </button>
                  <button
                    onClick={() => setScheduleLayout('horizontal')}
                    className={`px-4 py-3 rounded-lg font-bold transition-all ${
                      scheduleLayout === 'horizontal'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    title="النسخة الأفقية (الأيام صفوف)"
                  >
                    أفقي
                  </button>
                </div>
              )}
            </div>

            {showSchedule && student.section && (
              <div className="mt-4">
                {scheduleLayout === 'vertical' ? (
                  <StudentScheduleView
                    section={student.section}
                    studentName={`${student.firstName} ${student.lastName}`}
                  />
                ) : (
                  <StudentScheduleAlternate
                    section={student.section}
                    studentName={`${student.firstName} ${student.lastName}`}
                  />
                )}
              </div>
            )}
          </div>

          {student.notes && (
            <div className="bg-gray-50 p-6 rounded-lg border-2 border-gray-200">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">ملاحظات إضافية</h4>
              <p className="text-gray-700">{student.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDetail;
