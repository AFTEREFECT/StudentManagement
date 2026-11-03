 import React, { useState, useEffect } from 'react';
import { Key, Search, CreditCard as Edit, Trash2, Eye, EyeOff, Send } from 'lucide-react';
import { dbManager } from '../utils/database';
import { Student } from '../types';
 import { supabase } from '../utils/supabaseClient';

interface Credential {
  student_id: string;
  secret_code: string;
  issue_date: string;
}

interface CredentialWithStudent extends Credential {
  studentName: string;
  studentGrade: string;
  studentSection: string;
  orderNumber: number;
  managedPhone?: string;
}

interface EditingPhone {
  studentId: string;
  phone: string;
}

const CredentialsManagement: React.FC = () => {
  const [credentials, setCredentials] = useState<CredentialWithStudent[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredCredentials, setFilteredCredentials] = useState<CredentialWithStudent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('الكل');
  const [sectionFilter, setSectionFilter] = useState<string>('الكل');
  const [loading, setLoading] = useState(true);
  const [showCodes, setShowCodes] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<CredentialWithStudent | null>(null);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [editingPhone, setEditingPhone] = useState<EditingPhone | null>(null);
  const [tempPhone, setTempPhone] = useState<string>('');

  const [messageTemplate, setMessageTemplate] = useState<string>(() =>
    localStorage.getItem('credentials_message_template') ||
    'مرحباً {studentName}\n\nبيانات ولوجك لبوابة متمدرس:\nاسم المستعمل: {studentId}@taalim.ma\nالقن السري: {secretCode}\n\nرابط متمدرس: https://moutamadris.men.gov.ma/moutamadris/Account'
  );

  const [formData, setFormData] = useState({
    student_id: '',
    secret_code: '',
    issue_date: new Date().toISOString().split('T')[0]
  });

  const [bulkSendMode, setBulkSendMode] = useState<'section' | 'level'>('section');
const [bulkSelectedLevel, setBulkSelectedLevel] = useState<string>('');
const [bulkSelectedSections, setBulkSelectedSections] = useState<string[]>([]);
const [bulkSending, setBulkSending] = useState(false);
const [bulkProgress, setBulkProgress] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterCredentials();
  }, [credentials, searchTerm, gradeFilter, sectionFilter]);

  const sortSectionNames = (sections: string[]) => {
    const parseSection = (value: string) => {
      const text = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
      const match = text.match(/^(\d+)APIC[\- ]?(\d+)$/i) || text.match(/^(\d+)APIC(\d+)$/i);

      if (match) {
        return {
          levelNum: Number(match[1]),
          sectionNum: Number(match[2]),
          isParsed: true,
        };
      }

      return {
        levelNum: Number.MAX_SAFE_INTEGER,
        sectionNum: Number.MAX_SAFE_INTEGER,
        isParsed: false,
      };
    };

    return [...sections].sort((a, b) => {
      const pa = parseSection(a);
      const pb = parseSection(b);

      if (pa.isParsed && pb.isParsed) {
        if (pa.levelNum !== pb.levelNum) return pa.levelNum - pb.levelNum;
        return pa.sectionNum - pb.sectionNum;
      }

      if (pa.isParsed && !pb.isParsed) return -1;
      if (!pa.isParsed && pb.isParsed) return 1;

      return String(a).localeCompare(String(b), 'ar');
    });
  };

  const sortGradeNames = (grades: string[]) => {
    const parseGrade = (value: string) => {
      const text = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
      const match = text.match(/^(\d+)APIC$/i);

      if (match) {
        return {
          levelNum: Number(match[1]),
          isParsed: true,
        };
      }

      return {
        levelNum: Number.MAX_SAFE_INTEGER,
        isParsed: false,
      };
    };

    return [...grades].sort((a, b) => {
      const pa = parseGrade(a);
      const pb = parseGrade(b);

      if (pa.isParsed && pb.isParsed) {
        return pa.levelNum - pb.levelNum;
      }

      if (pa.isParsed && !pb.isParsed) return -1;
      if (!pa.isParsed && pb.isParsed) return 1;

      return String(a).localeCompare(String(b), 'ar');
    });
  };

const getManagedPhoneValue = (student: any) => {
  return String(student?.phone || "").trim();
};


  // تحميل البيانات
  const loadData = async () => {
    try {
      const [credentialsData, studentsData] = await Promise.all([
        dbManager.getCredentials(),
        dbManager.getStudents()
      ]);

      setStudents(studentsData);

      const credentialsWithStudents = credentialsData.map((credential, index) => {
  const student = studentsData.find(s => s.nationalId === credential.student_id);
  const managedPhone = getManagedPhoneValue(student);

  return {
    ...credential,
    studentName: student ? `${student.firstName} ${student.lastName}` : 'تلميذ غير معروف',
    studentGrade: student?.grade || student?.level || '',
    studentSection: student?.section || student?.sectionName || '',
    orderNumber: index + 1,
    managedPhone
  };
});

      setCredentials(credentialsWithStudents);
    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
    } finally {
      setLoading(false);
    }
  };

  // تصفية الأكواد السرية
  const filterCredentials = () => {
    let filtered = [...credentials];

    if (searchTerm) {
      filtered = filtered.filter(credential =>
        credential.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        credential.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        credential.secret_code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (gradeFilter !== 'الكل') {
      filtered = filtered.filter(credential => credential.studentGrade === gradeFilter);
    }

    if (sectionFilter !== 'الكل') {
      filtered = filtered.filter(credential => credential.studentSection === sectionFilter);
    }

    setFilteredCredentials(filtered);
  };

  // إضافة أو تحديث كود سري
  const handleSaveCredential = async () => {
    try {
      await dbManager.addOrUpdateCredential(formData);
      await loadData();
      setShowForm(false);
      setSelectedCredential(null);
      setFormData({
        student_id: '',
        secret_code: '',
        issue_date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('خطأ في حفظ الكود السري:', error);
      alert('خطأ في حفظ الكود السري: ' + (error instanceof Error ? error.message : 'خطأ غير معروف'));
    }
  };

  // تعديل الهاتف المعتمد
  const handleUpdatePhone = async (studentNationalId: string, newPhone: string) => {
    try {
      await dbManager.initialize();

      const student = students.find(s => s.nationalId === studentNationalId);
      if (!student) {
        alert('التلميذ غير موجود');
        return;
      }

      await dbManager.updateStudent(student.id, {
        phone: newPhone,
        updatedAt: new Date().toISOString()
      });

      setCredentials(prev =>
        prev.map(c =>
          c.student_id === studentNationalId ? { ...c, managedPhone: newPhone } : c
        )
      );

      setEditingPhone(null);
      alert('✅ تم تحديث الهاتف المعتمد بنجاح');
      await loadData();
    } catch (error) {
      console.error('خطأ في تحديث الهاتف:', error);
      alert('خطأ في تحديث الهاتف');
    }
  };

  // حذف كود سري
  const handleDeleteCredential = async (studentId: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الكود السري؟')) {
      try {
        await dbManager.deleteCredential(studentId);
        await loadData();
      } catch (error) {
        console.error('خطأ في حذف الكود السري:', error);
      }
    }
  };

  // إرسال الكود السري عبر واتساب للهاتف المعتمد فقط
 const handleSendToWhatsApp = async (credential: CredentialWithStudent) => {
  const phoneNumber = String(credential.managedPhone || '').trim();

  if (!phoneNumber) {
    alert('رقم الهاتف المعتمد غير متوفر لهذا التلميذ.');
    return;
  }

  setSendingTo(credential.student_id);

  try {
    await dbManager.initialize();
    const settings = await dbManager.getInstitutionSettings();

    const institutionId =
      settings?.supabaseInstitutionId ||
      settings?.supabase_institution_id ||
      settings?.institutionId;

    if (!institutionId) {
      alert('⚠️ لم يتم العثور على معرف المؤسسة. يرجى تفعيل البرنامج أولاً.');
      return;
    }

    const { data: inst, error } = await supabase
      .from('institutions')
      .select('whatsapp_session_status')
      .eq('id', institutionId)
      .single();

    if (error) {
      console.error('خطأ في التحقق من جلسة واتساب:', error);
      alert('⚠️ حدث خطأ أثناء التحقق من جلسة WhatsApp.');
      return;
    }

    const message = buildCredentialMessage(credential);

    const res = await fetch('https://queue.progtalamid.com/enqueue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        institution_id: institutionId,
        phone: phoneNumber,
        message,
        priority: 2,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `HTTP ${res.status}`);
    }

    alert(`✅ تم إضافة رسالة القن السري إلى قائمة الانتظار بنجاح: ${phoneNumber}`);
  } catch (error) {
    console.error('❌ خطأ في إرسال الرسالة:', error);
    alert('❌ حدث خطأ أثناء إرسال القن السري.');
  } finally {
    setSendingTo(null);
  }
};


const handleBulkSendCredentials = async () => {
  const recipients = getBulkRecipients();

  if (recipients.length === 0) {
    alert('⚠️ لا يوجد تلاميذ مطابقون للاختيار أو لا توجد أرقام هاتف معتمدة.');
    return;
  }

  const confirmMessage =
    bulkSendMode === 'level'
      ? `هل أنت متأكد من إرسال القن السري إلى ${recipients.length} تلميذ(ة) في المستوى ${bulkSelectedLevel}؟`
      : `هل أنت متأكد من إرسال القن السري إلى ${recipients.length} تلميذ(ة) في الأقسام المحددة؟`;

  if (!confirm(confirmMessage)) return;

  setBulkSending(true);
  setBulkProgress(0);

  try {
    await dbManager.initialize();
    const settings = await dbManager.getInstitutionSettings();

    const institutionId =
      settings?.supabaseInstitutionId ||
      settings?.supabase_institution_id ||
      settings?.institutionId;

    if (!institutionId) {
      alert('⚠️ لم يتم العثور على معرف المؤسسة. يرجى تفعيل البرنامج أولاً.');
      return;
    }

    const { data: inst, error } = await supabase
      .from('institutions')
      .select('whatsapp_session_status')
      .eq('id', institutionId)
      .single();

    if (error) {
      console.error('خطأ في التحقق من جلسة واتساب:', error);
      alert('⚠️ حدث خطأ أثناء التحقق من جلسة WhatsApp.');
      return;
    }

    // إذا أردت لاحقًا التحقق الفعلي من الحالة فعّل هذا الشرط:
    // if (inst?.whatsapp_session_status !== 'connected') {
    //   alert('⚠️ جلسة WhatsApp غير متصلة.');
    //   return;
    // }

    for (let i = 0; i < recipients.length; i++) {
      const credential = recipients[i];
      const phone = String(credential.managedPhone || '').trim();

      if (!phone) continue;

      const personalizedMessage = buildCredentialMessage(credential);

      const res = await fetch('https://queue.progtalamid.com/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          institution_id: institutionId,
          phone,
          message: personalizedMessage,
          priority: 2,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }

      setBulkProgress(Math.round(((i + 1) / recipients.length) * 100));
    }

    alert(`✅ تم إضافة ${recipients.length} رسالة قن سري إلى قائمة الانتظار بنجاح.`);
  } catch (error) {
    console.error('❌ خطأ في الإرسال الجماعي للأكواد السرية:', error);
    alert('❌ حدث خطأ أثناء تجهيز الإرسال الجماعي للقن السري.');
  } finally {
    setBulkSending(false);
    setBulkProgress(0);
  }
};
  const getUniqueGrades = () => {
    const grades = Array.from(new Set(credentials.map(c => c.studentGrade).filter(Boolean)));
    return sortGradeNames(grades);
  };

  const getUniqueSections = () => {
    const sections = Array.from(new Set(credentials.map(c => c.studentSection).filter(Boolean)));
    return sortSectionNames(sections);
  };

  const getBulkRecipients = () => {
  let filtered: CredentialWithStudent[] = [];

  if (bulkSendMode === 'level' && bulkSelectedLevel) {
    filtered = credentials.filter(
      c =>
        c.studentGrade === bulkSelectedLevel &&
        String(c.managedPhone || '').trim()
    );
  }

  if (bulkSendMode === 'section' && bulkSelectedSections.length > 0) {
    filtered = credentials.filter(
      c =>
        bulkSelectedSections.includes(c.studentSection) &&
        String(c.managedPhone || '').trim()
    );
  }

  return filtered;
};

const buildCredentialMessage = (credential: CredentialWithStudent) => {
  const student = students.find(s => s.nationalId === credential.student_id);

  return messageTemplate
    .replace(/{studentName}/g, credential.studentName)
    .replace(/{studentId}/g, credential.student_id)
    .replace(/{secretCode}/g, credential.secret_code)
    .replace(/{email}/g, student?.email || 'غير متوفر')
    .replace(/{level}/g, credential.studentGrade || '')
    .replace(/{section}/g, credential.studentSection || '');
};
  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, secret_code: result }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* قالب رسالة الكود السري */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg shadow-md p-4 mb-6">
          <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-600" />
            قالب رسالة الكود السري
          </h3>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              نص الرسالة
            </label>
            <textarea
              value={messageTemplate}
              onChange={(e) => {
                setMessageTemplate(e.target.value);
                localStorage.setItem('credentials_message_template', e.target.value);
              }}
              rows={6}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="مرحباً {studentName}..."
            />
            <p className="text-xs text-gray-600 mt-2">
              💡 المتغيرات: {'{'}<strong>studentName</strong>{'}'}, {'{'}<strong>studentId</strong>{'}'}, {'{'}<strong>secretCode</strong>{'}'}, {'{'}<strong>email</strong>{'}'}, {'{'}<strong>level</strong>{'}'}, {'{'}<strong>section</strong>{'}'}
            </p>
          </div>
        </div>

        {/* الهاتف المعتمد */}
        <div className="bg-gradient-to-r from-green-50 to-teal-50 border-2 border-green-300 rounded-lg shadow-md p-4 mb-6">
          <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
            <Send className="w-4 h-4 text-green-600" />
            الهاتف المعتمد للإرسال
          </h3>
          <p className="text-sm text-gray-700">
            يتم الإرسال تلقائيًا إلى <span className="font-bold text-green-700">رقم الهاتف المعتمد</span> الموجود في حقل
            <span className="font-mono mx-1">students.phone</span>
            كما هو مضبوط في صفحة <span className="font-bold">إدارة أرقام الهواتف</span>.
          </p>
        </div>

        {/* عنوان الصفحة */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-3">
            إدارة الأكواد السرية
          </h1>
          <p className="text-gray-600 text-lg">إدارة الأكواد السرية للتلاميذ وتتبع صلاحياتها</p>
          <div className="mt-4 w-24 h-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full mx-auto"></div>
        </div>

        {/* شريط الأدوات */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="البحث في الأكواد السرية..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent w-full sm:w-64"
                />
              </div>

              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="الكل">جميع الصفوف</option>
                {getUniqueGrades().map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>

              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="الكل">جميع الأقسام</option>
                {getUniqueSections().map(section => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCodes(!showCodes)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md ${
                  showCodes
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800'
                    : 'bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800'
                }`}
              >
                {showCodes ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                {showCodes ? 'إخفاء الأكواد' : 'إظهار الأكواد'}
              </button>
            </div>
            
          </div>
        </div>

        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Key className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">إجمالي الأكواد</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">{credentials.length}</p>
          </div>




          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Search className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">النتائج المفلترة</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{filteredCredentials.length}</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-medium text-gray-700">الصفوف المختلفة</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{getUniqueGrades().length}</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-medium text-gray-700">الأقسام المختلفة</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">{getUniqueSections().length}</p>
          </div>
        </div>

 


        {/* جدول الأكواد السرية */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الرقم الترتيبي
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    التلميذ
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    رقم التلميذ
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الصف
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    القسم
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الكود السري
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الهاتف المعتمد
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCredentials.map((credential) => (
                  <tr key={credential.student_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-blue-600">
                        {credential.orderNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {credential.studentName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {credential.student_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {credential.studentGrade}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {credential.studentSection}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-mono ${showCodes ? 'text-gray-900' : 'text-gray-400'}`}>
                          {showCodes ? credential.secret_code : '••••••••'}
                        </span>
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                          سري
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {editingPhone?.studentId === credential.student_id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={tempPhone}
                            onChange={(e) => setTempPhone(e.target.value)}
                            className="w-40 px-2 py-1 text-sm border border-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                            placeholder="0612345678"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdatePhone(credential.student_id, tempPhone)}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                            title="حفظ"
                          >
                            ✔
                          </button>
                          <button
                            onClick={() => setEditingPhone(null)}
                            className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
                            title="إلغاء"
                          >
                            ✖
                          </button>
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-2 cursor-pointer hover:bg-green-50 px-2 py-1 rounded transition-colors"
                          onClick={() => {
                            setEditingPhone({
                              studentId: credential.student_id,
                              phone: credential.managedPhone || ''
                            });
                            setTempPhone(credential.managedPhone || '');
                          }}
                          title="اضغط لتعديل الهاتف المعتمد"
                        >
                          <span className="text-xs text-gray-500">📱</span>
                          {String(credential.managedPhone || "").trim() ? (
  <span className="text-green-600 font-medium text-sm dir-ltr inline-block">
    {String(credential.managedPhone || "").trim()}
  </span>
) : (
  <span className="text-red-600 font-medium text-xs">لا يوجد</span>
)}
                          <Edit className="w-3 h-3 text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
  onClick={() => handleSendToWhatsApp(credential)}
  disabled={sendingTo === credential.student_id || !String(credential.managedPhone || "").trim()}
  className="text-green-600 hover:text-green-900 p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
  title={String(credential.managedPhone || "").trim() ? 'إرسال إلى الهاتف المعتمد' : 'الهاتف المعتمد غير متوفر'}
>
  <Send className="w-4 h-4" />
</button>
                        <button
                          onClick={() => {
                            setSelectedCredential(credential);
                            setFormData({
                              student_id: credential.student_id,
                              secret_code: credential.secret_code,
                              issue_date: credential.issue_date
                            });
                            setShowForm(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-900 p-1 rounded"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCredential(credential.student_id)}
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

          {filteredCredentials.length === 0 && (
            <div className="text-center py-12">
              <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">لا توجد أكواد سرية</p>
            </div>
          )}
        </div>
      </div>

      {/* نموذج إضافة/تعديل كود سري */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedCredential ? 'تعديل الكود السري' : 'إضافة كود سري جديد'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setSelectedCredential(null);
                  setFormData({
                    student_id: '',
                    secret_code: '',
                    issue_date: new Date().toISOString().split('T')[0]
                  });
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  التلميذ *
                </label>
                <select
                  value={formData.student_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, student_id: e.target.value }))}
                  disabled={!!selectedCredential}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="">اختر التلميذ</option>
                  {students.map(student => (
                    <option key={student.id} value={student.nationalId}>
                      {student.firstName} {student.lastName} - {student.nationalId}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الكود السري *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.secret_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, secret_code: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="أدخل الكود السري"
                  />
                  <button
                    type="button"
                    onClick={generateRandomCode}
                    className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
                  >
                    توليد
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تاريخ الإصدار *
                </label>
                <input
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, issue_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleSaveCredential}
                  disabled={!formData.student_id || !formData.secret_code}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {selectedCredential ? 'تحديث الكود' : 'إضافة الكود'}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setSelectedCredential(null);
                    setFormData({
                      student_id: '',
                      secret_code: '',
                      issue_date: new Date().toISOString().split('T')[0]
                    });
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
    </div>
  );
};

export default CredentialsManagement;