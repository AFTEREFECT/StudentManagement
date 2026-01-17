import React, { useState, useEffect } from 'react';
import { Calendar, Users, Send, FileText, Search, Filter, CheckCircle, AlertCircle, Clock, FileCheck, X, Printer } from 'lucide-react';
import { dbManager } from '../utils/database';
import { unifiedWhatsAppService } from '../utils/unifiedWhatsAppService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  studentId: string;
  level: string;
  section: string;
  guardianPhone: string;
  parentPhone?: string;
}

interface AbsenceRecord {
  id?: string;
  student_id: string;
  date: string;
  period: string;
  subject: string;
  time_from: string;
  time_to: string;
  room: string;
  status: 'حاضر' | 'غائب' | 'متأخر' | 'مخالفة';
  reason: string;
  notified: boolean;
}

interface TimetableEntry {
  class: string;
  day_arabic: string;
  time_slot: string;
  start_time: string;
  end_time: string;
  subject_arabic: string;
  teacher_name_arabic: string;
  room_name: string;
}

export const AbsenceManagement: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string>('الكل');
  const [selectedSection, setSelectedSection] = useState<string>('الكل');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedPeriod, setSelectedPeriod] = useState<'صباحية' | 'مسائية' | ''>('');
  const [availableSubjects, setAvailableSubjects] = useState<TimetableEntry[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<TimetableEntry | null>(null);
  const [subject, setSubject] = useState<string>('');
  const [timeFrom, setTimeFrom] = useState<string>('08:00');
  const [timeTo, setTimeTo] = useState<string>('09:00');
  const [room, setRoom] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [absenceStatuses, setAbsenceStatuses] = useState<Map<string, AbsenceRecord>>(new Map());
  const [levels, setLevels] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [periods, setPeriods] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [scheduleAvailable, setScheduleAvailable] = useState(false);
  const [currentSchedule, setCurrentSchedule] = useState<TimetableEntry | null>(null);
  const [dateOnlyMode, setDateOnlyMode] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    filterStudents();
  }, [students, selectedLevel, selectedSection, searchQuery]);

  useEffect(() => {
    if (selectedSection && selectedSection !== 'الكل') {
      loadScheduleForSection(selectedSection, selectedDate);
    }
  }, [selectedSection, selectedDate]);

  useEffect(() => {
    if (!dateOnlyMode && selectedSection && selectedSection !== 'الكل' && selectedPeriod && selectedDate) {
      loadAvailableSubjects();
    } else {
      setAvailableSubjects([]);
      setSelectedSubject(null);
    }
  }, [selectedSection, selectedPeriod, selectedDate, dateOnlyMode]);

  const loadInitialData = async () => {
    try {
      await dbManager.initialize();

      const allStudents = await dbManager.getStudents();
      setStudents(allStudents);

      const uniqueLevels = Array.from(new Set(allStudents.map(s => s.level))).filter(Boolean);
      const sortedLevels = sortLevels(uniqueLevels);
      setLevels(sortedLevels);

      const uniqueSections = Array.from(new Set(allStudents.map(s => s.section))).filter(Boolean);
      const sortedSections = sortSections(uniqueSections);
      setSections(sortedSections);

      const allSubjects = await dbManager.getAllSubjects();
      console.log('المواد المحملة:', allSubjects);
      setSubjects(allSubjects);

      const timetable = await dbManager.getAllTimetable();
      console.log('جداول الحصص المحملة:', timetable.length);
      setScheduleAvailable(timetable.length > 0);
    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
    }
  };

  const sortLevels = (levels: string[]): string[] => {
    const levelOrder = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة'];
    return levels.sort((a, b) => {
      const aIndex = levelOrder.findIndex(l => a.includes(l));
      const bIndex = levelOrder.findIndex(l => b.includes(l));
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      return a.localeCompare(b, 'ar');
    });
  };

  const sortSections = (sections: string[]): string[] => {
    return sections.sort((a, b) => {
      const getNum = (s: string) => {
        const match = s.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };
      const numA = getNum(a);
      const numB = getNum(b);
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });
  };

  const loadScheduleForSection = async (section: string, date: string) => {
    try {
      await dbManager.initialize();
      const timetable = await dbManager.getTimetableByClass(section);
      console.log(`جدول القسم ${section}:`, timetable);

      const uniquePeriods = Array.from(new Set(timetable.map((t: any) => t.time_slot))).filter(Boolean).sort();
      console.log('الحصص المتاحة:', uniquePeriods);
      setPeriods(uniquePeriods);
    } catch (error) {
      console.error('خطأ في تحميل جدول القسم:', error);
    }
  };

  const getDayInFrench = (date: string): string => {
    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const dateObj = new Date(date + 'T00:00:00');
    return dayNames[dateObj.getDay()];
  };

  const loadAvailableSubjects = async () => {
    try {
      await dbManager.initialize();

      const dayFrench = getDayInFrench(selectedDate);
      const periodSuffix = selectedPeriod === 'صباحية' ? '_m' : '_s';
      const dayWithPeriod = dayFrench + periodSuffix;

      console.log('\n=== 🔍 بدء البحث عن المواد ===');
      console.log('📅 التاريخ:', selectedDate);
      console.log('🌍 اليوم بالفرنسية:', dayFrench);
      console.log('⏰ الفترة:', selectedPeriod, '(اللاحقة:', periodSuffix + ')');
      console.log('🎯 اليوم + الفترة:', dayWithPeriod);
      console.log('🏫 القسم:', selectedSection);

      const timetable = await dbManager.getTimetableByClass(selectedSection);
      console.log(`📖 إجمالي الحصص للقسم ${selectedSection}:`, timetable.length);

      if (timetable.length > 0) {
        console.log('🔍 أمثلة من حقل day في timetable:',
          timetable.slice(0, 5).map((t: any) => ({ day: t.day, subject: t.subject_arabic })));
      }

      const matchingSubjects = timetable.filter((entry: any) => {
        const entryDay = entry.day?.toLowerCase();
        const targetDay = dayWithPeriod.toLowerCase();
        const isMatch = entryDay === targetDay;

        if (isMatch) {
          console.log('✅ تطابق:', {
            entryDay,
            targetDay,
            subject: entry.subject_arabic,
            time: `${entry.start_time}-${entry.end_time}`,
            room: entry.room_name
          });
        }

        return isMatch;
      });

      console.log(`\n🎉 عدد المواد المتطابقة: ${matchingSubjects.length}`);
      if (matchingSubjects.length > 0) {
        console.log('📚 المواد المتاحة:', matchingSubjects.map((s: any) => ({
          subject: s.subject_arabic,
          teacher: s.teacher_name_arabic,
          time: `${s.start_time}-${s.end_time}`,
          room: s.room_name
        })));
      } else {
        console.warn('⚠️ لم يتم العثور على مواد!');
      }
      console.log('=== نهاية البحث ===\n');

      setAvailableSubjects(matchingSubjects as TimetableEntry[]);

      if (matchingSubjects.length === 0) {
        setSelectedSubject(null);
        setCurrentSchedule(null);
        setSubject('');
        setTimeFrom('08:00');
        setTimeTo('09:00');
        setRoom('');
      }
    } catch (error) {
      console.error('❌ خطأ في جلب المواد المتاحة:', error);
    }
  };

  const handleSubjectSelection = (subjectEntry: TimetableEntry) => {
    setSelectedSubject(subjectEntry);
    setCurrentSchedule(subjectEntry);
    setSubject(subjectEntry.subject_arabic || '');
    setTimeFrom(subjectEntry.start_time || '08:00');
    setTimeTo(subjectEntry.end_time || '09:00');
    setRoom(subjectEntry.room_name || '');
    console.log('✅ تم تحديد المادة:', subjectEntry);
  };

  const filterStudents = () => {
    let filtered = students;

    if (selectedLevel !== 'الكل') {
      filtered = filtered.filter(s => s.level === selectedLevel);

      const levelSections = Array.from(new Set(students.filter(s => s.level === selectedLevel).map(s => s.section))).filter(Boolean);
      const sortedLevelSections = sortSections(levelSections);
      setSections(sortedLevelSections);
    } else {
      const uniqueSections = Array.from(new Set(students.map(s => s.section))).filter(Boolean);
      const sortedSections = sortSections(uniqueSections);
      setSections(sortedSections);
    }

    if (selectedSection !== 'الكل') {
      filtered = filtered.filter(s => s.section === selectedSection);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.firstName.toLowerCase().includes(query) ||
        s.lastName.toLowerCase().includes(query) ||
        s.nationalId.toLowerCase().includes(query) ||
        s.studentId.toLowerCase().includes(query)
      );
    }

    setFilteredStudents(filtered);
  };

  const handleStatusChange = (studentId: string, status: 'حاضر' | 'غائب' | 'متأخر' | 'مخالفة') => {
    const newStatuses = new Map(absenceStatuses);

    if (status === 'حاضر') {
      newStatuses.delete(studentId);
    } else {
      const record: AbsenceRecord = {
        student_id: studentId,
        date: selectedDate,
        period: dateOnlyMode ? 'غير محدد' : (selectedPeriod || 'غير محدد'),
        subject: dateOnlyMode ? 'غير محدد' : subject,
        time_from: dateOnlyMode ? '00:00' : timeFrom,
        time_to: dateOnlyMode ? '00:00' : timeTo,
        room: dateOnlyMode ? 'غير محدد' : room,
        status: status,
        reason: '',
        notified: false
      };
      newStatuses.set(studentId, record);
    }

    setAbsenceStatuses(newStatuses);
  };

  const handleSaveAll = async () => {
    setLoading(true);

    try {
      await dbManager.initialize();
      const records = Array.from(absenceStatuses.values());

      if (records.length === 0) {
        setModalMessage({ type: 'error', text: 'لا توجد غيابات أو مخالفات لحفظها' });
        setShowModal(true);
        setLoading(false);
        return;
      }

      let savedCount = 0;
      for (const record of records) {
        const student = students.find(s => s.id === record.student_id);
        if (student) {
          await dbManager.addAttendanceRecord({
            studentId: record.student_id,
            date: record.date,
            status: record.status,
            period: record.period,
            subject: record.subject,
            notes: `${record.time_from} - ${record.time_to} | القاعة: ${record.room}`
          });
          savedCount++;
        }
      }

      setModalMessage({
        type: 'success',
        text: `✅ تم حفظ ${savedCount} سجل بنجاح في قاعدة البيانات المحلية\n\n` +
              `الغيابات: ${records.filter(r => r.status === 'غائب').length}\n` +
              `التأخرات: ${records.filter(r => r.status === 'متأخر').length}\n` +
              `المخالفات: ${records.filter(r => r.status === 'مخالفة').length}`
      });
      setShowModal(true);
      setAbsenceStatuses(new Map());
    } catch (error) {
      console.error('خطأ في الحفظ:', error);
      setModalMessage({ type: 'error', text: '❌ فشل حفظ البيانات. حاول مرة أخرى.' });
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  const sendWhatsAppNotification = async (student: Student, absence: AbsenceRecord) => {
    const phone = student.parentPhone || student.guardianPhone;
    if (!phone) {
      throw new Error('رقم ولي الأمر غير متوفر');
    }

    const teacherText = currentSchedule?.teacher_name_arabic || '';

    const message = `#نخبركم أن ابنكم ${student.firstName} ${student.lastName} ` +
      `${absence.status === 'غائب' ? 'تغيب' : absence.status === 'متأخر' ? 'تأخر' : 'ارتكب مخالفة'} ` +
      `يوم ${absence.date} الحصة: ${absence.period} ` +
      `من الساعة ${absence.time_from} إلى الساعة ${absence.time_to} ` +
      `مادة: ${absence.subject}${teacherText ? ` - الأستاذ: ${teacherText}` : ''} القاعة: ${absence.room} عن الإدارة.`;

    const result = await unifiedWhatsAppService.sendMessage(phone, message);

    if (!result.success) {
      throw new Error(result.message);
    }

    return { sent: true, message };
  };

  const handleSendNotifications = async () => {
    setLoading(true);

    try {
      const absentRecords = Array.from(absenceStatuses.entries());

      if (absentRecords.length === 0) {
        setModalMessage({ type: 'error', text: 'لا توجد غيابات للإرسال' });
        setShowModal(true);
        setLoading(false);
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const [studentId, absence] of absentRecords) {
        const student = students.find(s => s.id === studentId);
        if (!student) continue;

        try {
          await sendWhatsAppNotification(student, absence);
          successCount++;
        } catch (error) {
          console.error(`فشل إرسال إشعار لـ ${student.firstName}:`, error);
          failCount++;
        }
      }

      setModalMessage({
        type: successCount > 0 ? 'success' : 'error',
        text: `تم إعداد ${successCount} إشعار للإرسال${failCount > 0 ? `\nفشل: ${failCount}` : ''}\n\nملاحظة: يجب إعداد WhatsApp API لإرسال الإشعارات فعلياً`
      });
      setShowModal(true);
    } catch (error) {
      console.error('خطأ في الإرسال:', error);
      setModalMessage({ type: 'error', text: '❌ فشل إعداد الإشعارات' });
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPermitTicket = async (student: Student) => {
    console.log('📄 إنشاء ورقة السماح بالدخول للتلميذ:', student.firstName, student.lastName);

    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.width = '210mm';
    tempDiv.style.background = 'white';
    tempDiv.style.padding = '15mm';
    tempDiv.style.direction = 'rtl';
    tempDiv.style.fontFamily = 'Arial, Tahoma, sans-serif';

tempDiv.innerHTML = `
  <div style="border: 3px solid #000; padding: 20px; background: white; min-height: 100mm; width: 420px;">
    <div style="font-size:22px; font-weight:bold; text-align:right;">يسمح</div>
    <div style="margin:10px 0; font-size:20px; text-align:right;">للتلميذ(ة): ............... ${student.firstName} ${student.lastName} ...............</div>
    <div style="margin:10px 0; font-size:20px; text-align:right;">من قسم: ............... ${student.section || 'غير محدد'} ............... بالدخول إلى الفصل</div>
    <div style="margin:10px 0; font-size:20px; text-align:right;">يوم: ........... ${new Date(selectedDate).toLocaleDateString('fr-EG')} ...........</div>
    <div style="margin:10px 0; font-size:20px; text-align:right;">على الساعة: h........ mn........</div>
    <div style="margin:15px 0; font-size:19px; text-align:right; font-weight:bold;">الإمضاء</div>
    <div style="border-bottom:2px solid #000; height:25px; width:200px; margin-bottom:15px;"></div>

    <div style="margin-top:8px; font-size:20px; text-align:right;">
      <label><input type="checkbox" style="margin-left:7px;"> بعد تبرير غيابه</label>
      <br>
      <label><input type="checkbox" style="margin-left:7px;"> بعد تسجيل تأخره</label>
    </div>
  </div>
`;


    

    document.body.appendChild(tempDiv);

    try {
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`ورقة_السماح_${student.firstName}_${student.lastName}.pdf`);

      console.log('✅ تم إنشاء PDF بنجاح');
    } catch (error) {
      console.error('❌ خطأ في إنشاء PDF:', error);
      alert('⚠️ فشل إنشاء ملف PDF. يرجى المحاولة مرة أخرى.');
    } finally {
      document.body.removeChild(tempDiv);
    }
  };

  const handlePrintBulkPermits = async () => {
    const studentsNeedingPermits = filteredStudents.filter(student => {
      const status = absenceStatuses.get(student.id)?.status;
      return status && status !== 'حاضر';
    });

    if (studentsNeedingPermits.length === 0) {
      alert('⚠️ لا يوجد تلاميذ غائبون أو متأخرون أو مخالفون للطباعة');
      return;
    }

    console.log(`📄 إنشاء أوراق السماح لـ ${studentsNeedingPermits.length} تلميذ...`);
    setLoading(true);

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      let isFirstPage = true;

      for (const student of studentsNeedingPermits) {
        if (!isFirstPage) {
          pdf.addPage();
        }
        isFirstPage = false;

        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.width = '210mm';
        tempDiv.style.background = 'white';
        tempDiv.style.padding = '15mm';
        tempDiv.style.direction = 'rtl';
        tempDiv.style.fontFamily = 'Arial, Tahoma, sans-serif';
 
tempDiv.innerHTML = `
  <div style="border: 3px solid #000; padding: 20px; background: white; min-height: 100mm; width: 420px;">
    <div style="font-size:22px; font-weight:bold; text-align:right;">يسمح</div>
    <div style="margin:10px 0; font-size:20px; text-align:right;">للتلميذ(ة): ............... ${student.firstName} ${student.lastName} ...............</div>
    <div style="margin:10px 0; font-size:20px; text-align:right;">من قسم: ............... ${student.section || 'غير محدد'} ............... بالدخول إلى الفصل</div>
    <div style="margin:10px 0; font-size:20px; text-align:right;">يوم: ........... ${new Date(selectedDate).toLocaleDateString('fr-EG')} ...........</div>
    <div style="margin:10px 0; font-size:20px; text-align:right;">على الساعة: h........ mn........</div>
    <div style="margin:15px 0; font-size:19px; text-align:right; font-weight:bold;">الإمضاء</div>
    <div style="border-bottom:2px solid #000; height:25px; width:200px; margin-bottom:15px;"></div>

    <div style="margin-top:8px; font-size:20px; text-align:right;">
      <label><input type="checkbox" style="margin-left:7px;"> بعد تبرير غيابه</label>
      <br>
      <label><input type="checkbox" style="margin-left:7px;"> بعد تسجيل تأخره</label>
    </div>
  </div>
`;
 
        document.body.appendChild(tempDiv);

        try {
          const canvas = await html2canvas(tempDiv, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          });

          const imgData = canvas.toDataURL('image/png');
          const imgWidth = 210;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        } finally {
          document.body.removeChild(tempDiv);
        }
      }

      pdf.save(`أوراق_السماح_${selectedSection}_${new Date(selectedDate).toLocaleDateString('ar-EG')}.pdf`);
      console.log('✅ تم إنشاء PDF جماعي بنجاح');

      setModalMessage({
        type: 'success',
        text: `✅ تم إنشاء ${studentsNeedingPermits.length} ورقة سماح بنجاح`
      });
      setShowModal(true);
    } catch (error) {
      console.error('❌ خطأ في إنشاء PDF:', error);
      setModalMessage({
        type: 'error',
        text: '❌ فشل إنشاء أوراق السماح'
      });
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6 overflow-y-auto" style={{ maxHeight: '100vh' }}>
      <div className="max-w-7xl mx-auto pb-20">
        {showModal && modalMessage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-bounce-in">
              <div className={`p-6 rounded-t-2xl ${modalMessage.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-3">
                    {modalMessage.type === 'success' ? (
                      <CheckCircle className="w-8 h-8" />
                    ) : (
                      <AlertCircle className="w-8 h-8" />
                    )}
                    <h3 className="text-xl font-bold">
                      {modalMessage.type === 'success' ? 'نجح العملية' : 'خطأ'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <p className="text-gray-800 text-lg whitespace-pre-line">{modalMessage.text}</p>
                <button
                  onClick={() => setShowModal(false)}
                  className={`w-full mt-6 px-6 py-3 rounded-lg font-bold text-white transition-colors ${
                    modalMessage.type === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  حسناً
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-6 text-white">
            <div className="flex items-center gap-3">
              <Users className="w-10 h-10" />
              <div>
                <h1 className="text-3xl font-bold">تدبير الغيابات</h1>
                <p className="text-purple-100 mt-1">نظام متكامل لتسجيل وإدارة غيابات التلاميذ</p>
              </div>
            </div>
          </div>

          {!scheduleAvailable && (
            <div className="m-6 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-yellow-900 mb-2">تحذير: جداول الحصص غير مستوردة</h3>
                  <p className="text-yellow-800">
                    لتفعيل الربط التلقائي مع جداول الحصص، يرجى استيراد <strong>جداول الحصص</strong> من صفحة "استيراد جداول الحصص".
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentSchedule && (
            <div className="m-6 p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div className="w-full">
                  <h3 className="font-bold text-green-900 mb-2">معلومات الحصة الحالية</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-green-800">
                    <div><strong>المادة:</strong> {currentSchedule.subject_arabic}</div>
                    <div><strong>الأستاذ:</strong> {currentSchedule.teacher_name_arabic}</div>
                    <div><strong>القاعة:</strong> {currentSchedule.room_name}</div>
                    <div><strong>التوقيت:</strong> {currentSchedule.time_slot}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-6 border-b border-gray-200 bg-gradient-to-br from-blue-50 to-purple-50">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5 text-purple-600" />
              الخطوة 1: اختر المستوى والقسم
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  المستوى
                </label>
                <select
                  value={selectedLevel}
                  onChange={(e) => {
                    setSelectedLevel(e.target.value);
                    setSelectedSection('الكل');
                    setPeriods([]);
                    setAvailableSubjects([]);
                    setSelectedSubject(null);
                  }}
                  className="w-full px-4 py-3 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 bg-white text-lg font-semibold"
                >
                  <option value="الكل">جميع المستويات</option>
                  {levels.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">القسم</label>
                <select
                  value={selectedSection}
                  onChange={(e) => {
                    setSelectedSection(e.target.value);
                    setAvailableSubjects([]);
                    setSelectedSubject(null);
                  }}
                  className="w-full px-4 py-3 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 bg-white text-lg font-semibold"
                >
                  <option value="الكل">جميع الأقسام</option>
                  {sections.map(section => (
                    <option key={section} value={section}>{section}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  بحث
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو رمز مسار..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                />
              </div>
            </div>

            {selectedSection && selectedSection !== 'الكل' && (
              <div className="mt-4 flex gap-4">
                <button
                  onClick={async () => {
                    await dbManager.initialize();
                    const timetable = await dbManager.getTimetableByClass(selectedSection);
                    console.log('\n📊 ===== جدول الحصص الكامل للقسم', selectedSection, '=====');
                    console.log('عدد الحصص:', timetable.length);

                    const daysMap: Record<string, any[]> = {};
                    timetable.forEach((entry: any, index: number) => {
                      const day = entry.day || 'غير محدد';
                      if (!daysMap[day]) daysMap[day] = [];
                      daysMap[day].push(entry);
                      console.log(`${index + 1}. اليوم: "${entry.day}" | المادة: ${entry.subject_arabic} | الوقت: ${entry.start_time}-${entry.end_time} | القاعة: ${entry.room_name} | الأستاذ: ${entry.teacher_name_arabic}`);
                    });

                    console.log('\n📅 الحصص مجمعة حسب الأيام:');
                    Object.entries(daysMap).forEach(([day, entries]) => {
                      console.log(`\n${day}: ${entries.length} حصص`);
                      entries.forEach((e, i) => {
                        console.log(`  ${i+1}. ${e.subject_arabic} (${e.start_time}-${e.end_time})`);
                      });
                    });
                    console.log('===== نهاية الجدول =====\n');
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                >
             .
                </button>

                <button
                  onClick={async () => {
                    await dbManager.initialize();
                    const allTimetable = await dbManager.getAllTimetable();
                    console.log('\n🌍 ===== جميع الحصص في قاعدة البيانات =====');
                    console.log('إجمالي الحصص:', allTimetable.length);

                    const classesMap: Record<string, number> = {};
                    allTimetable.forEach((entry: any) => {
                      const className = entry.class || 'غير محدد';
                      classesMap[className] = (classesMap[className] || 0) + 1;
                    });

                    console.log('\n📚 الحصص موزعة حسب الأقسام:');
                    Object.entries(classesMap).sort((a, b) => a[0].localeCompare(b[0])).forEach(([className, count]) => {
                      console.log(`${className}: ${count} حصص`);
                    });

                    console.log('\n🔍 أمثلة من البيانات (أول 10 حصص):');
                    allTimetable.slice(0, 10).forEach((entry: any, i: number) => {
                      console.log(`${i+1}. القسم: "${entry.class}" | اليوم: "${entry.day}" | المادة: ${entry.subject_arabic}`);
                    });
                    console.log('===== نهاية القائمة =====\n');
                  }}
                  className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                >
          .
                </button>
              </div>
            )}
          </div>

          {selectedSection && selectedSection !== 'الكل' && (
            <div className="p-6 border-b border-gray-200 bg-gradient-to-br from-green-50 to-teal-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-green-600" />
                  الخطوة 2: حدد التاريخ والفترة
                </h3>
                <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-lg shadow-sm border-2 border-green-300 hover:bg-green-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={dateOnlyMode}
                    onChange={(e) => {
                      setDateOnlyMode(e.target.checked);
                      if (e.target.checked) {
                        setSelectedPeriod('');
                        setAvailableSubjects([]);
                        setSelectedSubject(null);
                      }
                    }}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-bold text-gray-700">مسك الغياب بالتاريخ فقط</span>
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    التاريخ
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-green-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 bg-white text-lg font-semibold"
                  />
                </div>

                {!dateOnlyMode && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      الفترة
                    </label>
                    <select
                      value={selectedPeriod}
                      onChange={(e) => setSelectedPeriod(e.target.value as 'صباحية' | 'مسائية' | '')}
                      className="w-full px-4 py-3 border-2 border-green-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 bg-white text-lg font-semibold"
                    >
                      <option value="">اختر الفترة</option>
                      <option value="صباحية">صباحية</option>
                      <option value="مسائية">مسائية</option>
                    </select>
                  </div>
                )}
              </div>
              {dateOnlyMode && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <AlertCircle className="w-4 h-4 inline ml-1" />
                    وضعية مسك الغياب بالتاريخ فقط مفعلة. لن تحتاج لتحديد الفترة أو المادة.
                  </p>
                </div>
              )}
            </div>
          )}

          {!dateOnlyMode && availableSubjects.length > 0 && (
            <div className="p-6 border-b border-gray-200 bg-gradient-to-br from-orange-50 to-yellow-50">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-orange-600" />
                الخطوة 3: اختر المادة
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-bold text-gray-700 mb-2">المادة المتاحة</label>
                  <select
                    value={selectedSubject?.subject_arabic || ''}
                    onChange={(e) => {
                      const selected = availableSubjects.find(s => s.subject_arabic === e.target.value);
                      if (selected) handleSubjectSelection(selected);
                    }}
                    className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 bg-white text-lg font-semibold"
                  >
                    <option value="">اختر المادة</option>
                    {availableSubjects.map((sub, idx) => (
                      <option key={idx} value={sub.subject_arabic}>
                        {sub.subject_arabic} - {sub.teacher_name_arabic} - {sub.room_name} ({sub.start_time} - {sub.end_time})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedSubject && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">القاعة</label>
                      <input
                        type="text"
                        value={room}
                        readOnly
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-100 text-lg font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">من الساعة</label>
                      <input
                        type="time"
                        value={timeFrom}
                        readOnly
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-100 text-lg font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">إلى الساعة</label>
                      <input
                        type="time"
                        value={timeTo}
                        readOnly
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-100 text-lg font-semibold"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {filteredStudents.length > 0 && (dateOnlyMode || selectedSubject) && (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-right font-bold">رت</th>
                  <th className="px-4 py-3 text-right font-bold">الاسم الكامل</th>
                  <th className="px-4 py-3 text-right font-bold">القسم</th>
                  <th className="px-4 py-3 text-center font-bold">الحالة</th>
                  <th className="px-4 py-3 text-center font-bold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      لا توجد نتائج
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student, index) => {
                    const currentStatus = absenceStatuses.get(student.id)?.status || 'حاضر';
                    return (
                      <tr key={student.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-700 font-medium">{index + 1}</td>
                        <td className="px-4 py-3 text-gray-900 font-bold">{student.firstName} {student.lastName}</td>
                        <td className="px-4 py-3 text-gray-700">{student.section}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-2 flex-wrap">
                            <label className={`cursor-pointer px-3 py-1 rounded-lg text-sm font-bold transition-all ${
                              currentStatus === 'حاضر' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}>
                              <input
                                type="radio"
                                name={`status-${student.id}`}
                                value="حاضر"
                                checked={currentStatus === 'حاضر'}
                                onChange={() => handleStatusChange(student.id, 'حاضر')}
                                className="hidden"
                              />
                              حاضر
                            </label>
                            <label className={`cursor-pointer px-3 py-1 rounded-lg text-sm font-bold transition-all ${
                              currentStatus === 'غائب' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}>
                              <input
                                type="radio"
                                name={`status-${student.id}`}
                                value="غائب"
                                checked={currentStatus === 'غائب'}
                                onChange={() => handleStatusChange(student.id, 'غائب')}
                                className="hidden"
                              />
                              غائب
                            </label>
                            <label className={`cursor-pointer px-3 py-1 rounded-lg text-sm font-bold transition-all ${
                              currentStatus === 'متأخر' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}>
                              <input
                                type="radio"
                                name={`status-${student.id}`}
                                value="متأخر"
                                checked={currentStatus === 'متأخر'}
                                onChange={() => handleStatusChange(student.id, 'متأخر')}
                                className="hidden"
                              />
                              متأخر
                            </label>
                            <label className={`cursor-pointer px-3 py-1 rounded-lg text-sm font-bold transition-all ${
                              currentStatus === 'مخالفة' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}>
                              <input
                                type="radio"
                                name={`status-${student.id}`}
                                value="مخالفة"
                                checked={currentStatus === 'مخالفة'}
                                onChange={() => handleStatusChange(student.id, 'مخالفة')}
                                className="hidden"
                              />
                              مخالفة
                            </label>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            {currentStatus && currentStatus !== 'حاضر' ? (
                              <button
                                onClick={() => handlePrintPermitTicket(student)}
                                className="bg-purple-600 text-white px-3 py-1 rounded-lg text-sm font-bold hover:bg-purple-700 transition-colors flex items-center gap-1 shadow-md"
                                title="طباعة ورقة السماح بالدخول للتلميذ"
                              >
                                <FileCheck className="w-4 h-4" />
                                ورقة السماح
                              </button>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </div>
                        </td>                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-6 bg-gray-50 border-t border-gray-200">
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={handleSaveAll}
                disabled={loading || absenceStatuses.size === 0}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg disabled:opacity-50"
              >
                <FileText className="w-5 h-5" />
                حفظ الغيابات ({absenceStatuses.size})
              </button>

              <button
                onClick={handleSendNotifications}
                disabled={loading || absenceStatuses.size === 0}
                className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:from-green-700 hover:to-green-800 transition-all shadow-lg disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
                إرسال الإشعارات
              </button>

              <button
                onClick={handlePrintBulkPermits}
                disabled={loading || absenceStatuses.size === 0}
                className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg disabled:opacity-50"
              >
                <Printer className="w-5 h-5" />
                طباعة أوراق السماح (غائب/متأخر/مخالف)
              </button>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};
