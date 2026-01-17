import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Users, Search, X, Plus, Trash2, UserCheck, CheckCircle } from 'lucide-react';
import { dbManager } from '../utils/database';
import { unifiedWhatsAppService } from '../utils/unifiedWhatsAppService';
import { Student } from '../types';
import { supabase } from '../utils/supabaseClient';

interface SelectedRecipient {
  id: string;
  name: string;
  nationalId: string;
  phone: string;
  section?: string;
  level?: string;
}

export const WhatsAppCommunication: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);

  const [sendMode, setSendMode] = useState<'class' | 'level' | 'all' | 'custom'>('class');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [recipientType, setRecipientType] = useState<'student' | 'guardian'>('student');

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<SelectedRecipient[]>([]);

  const [message, setMessage] = useState('');
  const [messageTemplates, setMessageTemplates] = useState<{ name: string; content: string }[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadData();
    loadMessageTemplates();
  }, []);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      performSearch();
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]);

  const loadData = async () => {
    try {
      await dbManager.initialize();
      const allStudents = await dbManager.getStudents();
      console.log('✅ تم تحميل التلاميذ:', allStudents.length);
      setStudents(allStudents);

      const uniqueLevels = [...new Set(allStudents.map(s => s.level).filter(Boolean))];
      const uniqueSections = [...new Set(allStudents.map(s => s.section).filter(Boolean))];

      console.log('✅ المستويات:', uniqueLevels);
      console.log('✅ الأقسام:', uniqueSections);

      setLevels(uniqueLevels.sort());
      setSections(uniqueSections.sort());
    } catch (error) {
      console.error('❌ خطأ في تحميل البيانات:', error);
    }
  };

  const loadMessageTemplates = () => {
    const templates = [
      {
        name: 'إشعار عام',
        content: 'السلام عليكم ورحمة الله وبركاته\n\nعزيزي ولي أمر التلميذ(ة): {STUDENT_NAME}\n\n{MESSAGE}\n\nشكراً لتعاونكم\nإدارة المؤسسة'
      },
      {
        name: 'إشعار غياب',
        content: 'السلام عليكم\n\nنفيدكم بأن ابنكم/ابنتكم {STUDENT_NAME} تغيب عن الحصص الدراسية اليوم {DATE}\n\nيرجى الاتصال بالإدارة للاستفسار.\n\nمع التحية'
      },
      {
        name: 'دعوة لاجتماع',
        content: 'السلام عليكم\n\nندعوكم لحضور اجتماع أولياء الأمور يوم {DATE} على الساعة {TIME}\n\nالموضوع: {SUBJECT}\n\nحضوركم مهم\nالإدارة'
      },
      {
        name: 'تهنئة',
        content: 'تهانينا الحارة لابنكم/ابنتكم {STUDENT_NAME}\n\n{MESSAGE}\n\nنتمنى له/لها المزيد من التفوق والنجاح'
      },
      {
        name: 'إشعار مالي',
        content: 'السلام عليكم\n\nنذكركم بضرورة تسديد الواجبات المالية الخاصة بـ {STUDENT_NAME}\n\nالمبلغ: {AMOUNT}\nآخر أجل: {DATE}\n\nشكراً لتعاونكم'
      }
    ];
    setMessageTemplates(templates);
  };

  const performSearch = async () => {
    const term = searchTerm.toLowerCase().trim();
    const results = students.filter(s => {
      const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
      const nationalId = s.nationalId?.toLowerCase() || '';
      const studentId = s.studentId?.toLowerCase() || '';

      return fullName.includes(term) || nationalId.includes(term) || studentId.includes(term);
    });
    setSearchResults(results.slice(0, 10));
  };

  const addRecipient = (student: Student) => {
    const phone = recipientType === 'student' ? student.phone : student.guardianPhone;

    if (!phone) {
      alert(`⚠️ لا يوجد رقم هاتف ${recipientType === 'student' ? 'للتلميذ' : 'لولي الأمر'}`);
      return;
    }

    const alreadyAdded = selectedRecipients.find(r => r.id === student.id);
    if (alreadyAdded) {
      alert('⚠️ هذا التلميذ مضاف بالفعل');
      return;
    }

    const newRecipient: SelectedRecipient = {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      nationalId: student.nationalId || '',
      phone: phone,
      section: student.section,
      level: student.level
    };

    setSelectedRecipients([...selectedRecipients, newRecipient]);
    setSearchTerm('');
    setSearchResults([]);
  };

  const removeRecipient = (id: string) => {
    setSelectedRecipients(selectedRecipients.filter(r => r.id !== id));
  };

  const getRecipientsFromSelection = (): SelectedRecipient[] => {
    if (sendMode === 'custom') {
      return selectedRecipients;
    }

    let filteredStudents: Student[] = [];

    if (sendMode === 'all') {
      filteredStudents = students;
    } else if (sendMode === 'level' && selectedLevel) {
      filteredStudents = students.filter(s => s.level === selectedLevel);
    } else if (sendMode === 'class' && selectedSections.length > 0) {
      filteredStudents = students.filter(s => selectedSections.includes(s.section || ''));
    }

    return filteredStudents
      .filter(s => {
        const phone = recipientType === 'student' ? s.phone : s.guardianPhone;
        return phone && phone.trim() !== '';
      })
      .map(s => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        nationalId: s.nationalId || '',
        phone: recipientType === 'student' ? s.phone! : s.guardianPhone!,
        section: s.section,
        level: s.level
      }));
  };

  const applyTemplate = (templateName: string) => {
    const template = messageTemplates.find(t => t.name === templateName);
    if (template) {
      setMessage(template.content);
      setSelectedTemplate(templateName);
    }
  };
const handleSend = async () => {
  if (!message.trim()) {
    alert('⚠️ يرجى كتابة نص الرسالة');
    return;
  }

  const recipients = getRecipientsFromSelection();

  if (recipients.length === 0) {
    alert('⚠️ لا يوجد مستلمون للرسالة. تأكد من أن التلاميذ المختارين لديهم أرقام هواتف.');
    return;
  }

  const confirmMessage = `هل أنت متأكد من إرسال الرسالة إلى ${recipients.length} ${recipientType === 'student' ? 'تلميذ' : 'ولي أمر'}؟`;

  if (!confirm(confirmMessage)) {
    return;
  }

  // ⚡ التحقق من أن الجلسة متصلة
  const institutionId = localStorage.getItem('institutionId');
  
  if (!institutionId) {
    alert('⚠️ لم يتم العثور على معرف المؤسسة. يرجى الذهاب إلى صفحة ربط WhatsApp أولاً.');
    return;
  }

  // التحقق من الاتصال
  try {
    const { data: inst } = await supabase
      .from('institutions')
      .select('whatsapp_session_status')
      .eq('id', institutionId)
      .single();

    if (!inst || inst.whatsapp_session_status !== 'CONNECTED') {
      alert('⚠️ جلسة WhatsApp غير متصلة. يرجى الذهاب إلى صفحة ربط WhatsApp وإنشاء جلسة جديدة.');
      return;
    }
  } catch (error) {
    console.error('خطأ في التحقق من الاتصال:', error);
    alert('⚠️ حدث خطأ في التحقق من الاتصال. يرجى المحاولة مرة أخرى.');
    return;
  }

  setSending(true);
  setSendProgress(0);

  try {
    console.log('🔍 بدء إرسال الرسائل عبر Waaku');
    console.log(`📊 عدد المستلمين: ${recipients.length}`);

    let successCount = 0;
    let failCount = 0;
    const failedRecipients: string[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

      // تخصيص الرسالة
      let personalizedMessage = message
        .replace(/{STUDENT_NAME}/g, recipient.name)
        .replace(/{NATIONAL_ID}/g, recipient.nationalId)
        .replace(/{SECTION}/g, recipient.section || '')
        .replace(/{LEVEL}/g, recipient.level || '')
        .replace(/{DATE}/g, new Date().toLocaleDateString('ar-EG'))
        .replace(/{TIME}/g, new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }));

      console.log(`📤 إرسال إلى: ${recipient.name} - ${recipient.phone}`);

      // ⚡ استخدام unifiedWhatsAppService (الذي يستخدم Waaku)
      const result = await unifiedWhatsAppService.sendMessage(recipient.phone, personalizedMessage);

      if (result.success) {
        successCount++;
        console.log(`✅ نجح إرسال: ${recipient.name}`);
      } else {
        failCount++;
        failedRecipients.push(`${recipient.name} (${result.message})`);
        console.error(`❌ فشل إرسال: ${recipient.name} - ${result.message}`);
      }

      // تحديث التقدم
      setSendProgress(Math.round(((i + 1) / recipients.length) * 100));
      
      // ⏳ انتظار ثانية واحدة بين كل رسالة
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // عرض النتيجة
    let resultMessage = `✅ تم إرسال ${successCount} رسالة بنجاح`;
    
    if (failCount > 0) {
      resultMessage += `\n\n❌ فشل إرسال ${failCount} رسالة:\n${failedRecipients.slice(0, 5).join('\n')}`;
      if (failedRecipients.length > 5) {
        resultMessage += `\n... و ${failedRecipients.length - 5} آخرين`;
      }
    }

    setModalMessage({
      type: successCount > 0 ? 'success' : 'error',
      text: resultMessage
    });
    setShowModal(true);

    // مسح البيانات بعد الإرسال الناجح
    if (successCount > 0) {
      if (sendMode === 'custom') {
        setSelectedRecipients([]);
      }
      setMessage('');
      setSelectedTemplate('');
    }

  } catch (error) {
    console.error('خطأ في الإرسال:', error);
    setModalMessage({
      type: 'error',
      text: '❌ حدث خطأ أثناء إرسال الرسائل'
    });
    setShowModal(true);
  }

  setSending(false);
  setSendProgress(0);
};

  
  
  
  ;

  const recipients = getRecipientsFromSelection();

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-10 h-10" />
          <div>
            <h1 className="text-3xl font-bold">التواصل عبر واتساب</h1>
            <p className="text-green-100">إرسال رسائل جماعية للتلاميذ وأولياء الأمور</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              اختيار المستلمين
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  طريقة الاختيار
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <button
                    onClick={() => setSendMode('class')}
                    className={`px-4 py-2 rounded-lg font-bold transition-all ${
                      sendMode === 'class'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    حسب القسم
                  </button>
                  <button
                    onClick={() => setSendMode('level')}
                    className={`px-4 py-2 rounded-lg font-bold transition-all ${
                      sendMode === 'level'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    حسب المستوى
                  </button>
                  <button
                    onClick={() => setSendMode('all')}
                    className={`px-4 py-2 rounded-lg font-bold transition-all ${
                      sendMode === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    onClick={() => setSendMode('custom')}
                    className={`px-4 py-2 rounded-lg font-bold transition-all ${
                      sendMode === 'custom'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    تلاميذ محددين
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  جهة الاتصال
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setRecipientType('student')}
                    className={`px-4 py-2 rounded-lg font-bold transition-all ${
                      recipientType === 'student'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    رقم التلميذ
                  </button>
                  <button
                    onClick={() => setRecipientType('guardian')}
                    className={`px-4 py-2 rounded-lg font-bold transition-all ${
                      recipientType === 'guardian'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    رقم ولي الأمر
                  </button>
                </div>
              </div>

              {sendMode === 'level' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    اختر المستوى
                  </label>
                  <select
                    value={selectedLevel}
                    onChange={(e) => setSelectedLevel(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- اختر مستوى --</option>
                    {levels.map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>
              )}

              {sendMode === 'class' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    اختر الأقسام (يمكن اختيار أكثر من قسم)
                  </label>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-2 border border-gray-300 rounded-lg">
                    {sections.map(section => (
                      <label
                        key={section}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                          selectedSections.includes(section)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSections.includes(section)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSections([...selectedSections, section]);
                            } else {
                              setSelectedSections(selectedSections.filter(s => s !== section));
                            }
                          }}
                          className="hidden"
                        />
                        <span className="text-sm font-bold">{section}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {sendMode === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    بحث عن تلميذ (الاسم أو الرقم الوطني)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="ابحث عن تلميذ..."
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                  </div>

                  {searchResults.length > 0 && (
                    <div className="mt-2 border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
                      {searchResults.map(student => {
                        const phone = recipientType === 'student' ? student.phone : student.guardianPhone;
                        return (
                          <div
                            key={student.id}
                            className="p-3 hover:bg-gray-50 border-b border-gray-200 last:border-b-0 cursor-pointer"
                            onClick={() => addRecipient(student)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold text-gray-900">
                                  {student.firstName} {student.lastName}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {student.nationalId} | {student.section}
                                </p>
                              </div>
                              <div className="text-left">
                                {phone ? (
                                  <div>
                                    <p className="text-sm text-green-600 font-bold">{phone}</p>
                                    <Plus className="w-5 h-5 text-blue-600" />
                                  </div>
                                ) : (
                                  <p className="text-xs text-red-600">لا يوجد رقم</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {selectedRecipients.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-bold text-gray-700 mb-2">
                        التلاميذ المختارون ({selectedRecipients.length})
                      </h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedRecipients.map(recipient => (
                          <div
                            key={recipient.id}
                            className="flex items-center justify-between bg-blue-50 p-3 rounded-lg"
                          >
                            <div>
                              <p className="font-bold text-gray-900">{recipient.name}</p>
                              <p className="text-sm text-gray-600">{recipient.phone}</p>
                            </div>
                            <button
                              onClick={() => removeRecipient(recipient.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-gray-900">عدد المستلمين:</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-600">{recipients.length}</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {recipientType === 'student' ? 'سيتم الإرسال لأرقام التلاميذ' : 'سيتم الإرسال لأرقام أولياء الأمور'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">نص الرسالة</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  قالب جاهز (اختياري)
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- اختر قالباً --</option>
                  {messageTemplates.map(template => (
                    <option key={template.name} value={template.name}>{template.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نص الرسالة
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="اكتب رسالتك هنا..."
                  dir="rtl"
                />
                <p className="text-sm text-gray-600 mt-2">
                  يمكنك استخدام: {'{STUDENT_NAME}'}, {'{NATIONAL_ID}'}, {'{SECTION}'}, {'{LEVEL}'}, {'{DATE}'}, {'{TIME}'}
                </p>
              </div>

              <button
                onClick={handleSend}
                disabled={sending || recipients.length === 0 || !message.trim()}
                className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:from-green-700 hover:to-teal-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
                {sending ? `جاري الإرسال... ${sendProgress}%` : `إرسال الرسالة (${recipients.length})`}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">معلومات مهمة</h3>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>سيتم إرسال الرسائل فقط للتلاميذ الذين لديهم أرقام هواتف</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>يمكنك تخصيص الرسالة باستخدام المتغيرات المذكورة</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>تأكد من إعدادات واتساب في صفحة الإعدادات</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>يمكنك اختيار إرسال الرسائل للتلاميذ أو أولياء الأمور</span>
              </li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="text-sm font-bold text-yellow-900 mb-2">ملاحظة</h4>
            <p className="text-sm text-yellow-800">
              تأكد من صحة أرقام الهواتف قبل الإرسال. الإرسال الجماعي قد يستغرق بعض الوقت حسب عدد المستلمين.
            </p>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center mb-4">
              {modalMessage.type === 'success' ? (
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              ) : (
                <X className="w-16 h-16 text-red-600 mx-auto mb-4" />
              )}
              <p className="text-lg font-bold text-gray-900 whitespace-pre-line">
                {modalMessage.text}
              </p>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-all"
            >
              حسناً
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
