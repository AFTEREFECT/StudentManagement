import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Calendar, Users, Download } from 'lucide-react';
import { dbManager } from '../utils/database';
import {
  mapTeacherAssignmentRows,
  teacherAssignmentTemplateHeaders,
  teacherAssignmentTemplateInstructions,
} from '../utils/teacherAssignmentImport';
import * as XLSX from 'xlsx';

export const ScheduleImport: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [fullData, setFullData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importType, setImportType] = useState<'timetable' | 'teachers'>('timetable');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'timetable' | 'teachers') => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage(null);
    setImportType(type);

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'json') {
        await handleJSONImport(file, type);
      } else if (fileExtension === 'csv' || fileExtension === 'xlsx' || fileExtension === 'xls') {
        await handleExcelCSVImport(file, type);
      } else {
        throw new Error('نوع الملف غير مدعوم. يرجى استخدام CSV أو Excel أو JSON');
      }
    } catch (error) {
      console.error('خطأ في استيراد الملف:', error);
      setMessage({ type: 'error', text: `فشل استيراد الملف: ${error instanceof Error ? error.message : 'خطأ غير معروف'}` });
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const handleExcelCSVImport = (file: File, type: 'timetable' | 'teachers'): Promise<void> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, {
            type: 'array',
            raw: file.name.toLowerCase().endsWith('.csv'),
          });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (type === 'timetable') {
            await processTimetableData(jsonData);
          } else {
            await processTeacherData(jsonData);
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(reader.error || new Error('تعذرت قراءة الملف'));
      reader.readAsArrayBuffer(file);
    });

  const handleJSONImport = (file: File, type: 'timetable' | 'teachers'): Promise<void> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const jsonText = e.target?.result as string;
          const data = JSON.parse(jsonText);

          if (type === 'timetable') {
            await processTimetableData(data);
          } else {
            await processTeacherData(data);
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(reader.error || new Error('تعذرت قراءة ملف JSON'));
      reader.readAsText(file);
    });

  const processTimetableData = async (data: any[]) => {
    const mappedData = data.map((row: any) => {
      if (row.teacher && row.class && row.subject && row.schedule) {
        return {
          teacher_name_arabic: row.teacher.nameArabic || '',
          teacher_name_french: row.teacher.nameFrench || '',
          teacher_id: row.teacher.id || '',
          ppr: row.teacher.ppr || '',
          subject_code: row.subject.code || '',
          subject_arabic: row.subject.nameArabic || '',
          class: row.class.name || '',
          room_code: row.class.roomCode || '',
          room_name: row.class.roomName || '',
          day: row.schedule.day || '',
          day_arabic: row.schedule.dayArabic || '',
          time_slot: row.schedule.timeSlot || '',
          start_time: row.schedule.startTime || '',
          end_time: row.schedule.endTime || '',
          activity_id: row.metadata?.activityId || '',
          tags: row.metadata?.tags || ''
        };
      } else {
        const columns = Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key.replace(/^\uFEFF/, '').trim().toLowerCase(),
            value,
          ])
        );
        const progMawaridClass = String(columns['students sets'] ?? '').trim();
        const progMawaridDay = String(columns.day ?? '').trim();
        const progMawaridHour = String(columns.hour ?? '').trim();

        if (progMawaridClass && progMawaridDay && progMawaridHour) {
          const [sourceDay, sourceSession] = progMawaridDay.toLowerCase().split(/[_-]/);
          const dayNames: Record<string, string> = {
            lundi: 'الاثنين',
            monday: 'الاثنين',
            mardi: 'الثلاثاء',
            tuesday: 'الثلاثاء',
            mercredi: 'الأربعاء',
            wednesday: 'الأربعاء',
            jeudi: 'الخميس',
            thursday: 'الخميس',
            vendredi: 'الجمعة',
            friday: 'الجمعة',
            samedi: 'السبت',
            saturday: 'السبت',
            dimanche: 'الأحد',
            sunday: 'الأحد',
          };
          const dayArabic = dayNames[sourceDay] || sourceDay;
          const session = sourceSession === 'm' || sourceSession === 'morning'
            ? 'صباحا'
            : sourceSession === 's' || sourceSession === 'evening'
              ? 'مساءً'
              : '';
          const subjectCode = String(columns.subject ?? '').trim();
          const teacherId = String(columns.teachers ?? '').trim();
          const room = String(columns.room ?? '').trim();

          return {
            teacher_name_arabic: '',
            teacher_name_french: '',
            teacher_id: teacherId,
            ppr: '',
            subject_code: subjectCode,
            subject_arabic: subjectCode ? `المادة ${subjectCode}` : '',
            class: progMawaridClass,
            room_code: room,
            room_name: room,
            day: progMawaridDay,
            day_arabic: dayArabic,
            time_slot: session ? `${progMawaridHour} - ${session}` : progMawaridHour,
            start_time: '',
            end_time: '',
            activity_id: String(columns['activity id'] ?? ''),
            tags: String(columns['activity tags'] ?? ''),
          };
        }

        return {
          teacher_name_arabic: columns['اسم الأستاذ بالعربية'] || columns.namearabic || '',
          teacher_name_french: columns['اسم الأستاذ بالفرنسية'] || columns.namefrench || '',
          teacher_id: columns['معرف الأستاذ'] || columns.teacherid || '',
          ppr: columns['رقم التأجير'] || columns.ppr || '',
          subject_code: columns['رمز المادة'] || columns.subjectcode || '',
          subject_arabic: columns['المادة بالعربية'] || columns.subjectarabic || '',
          class: columns['القسم'] || columns.class || '',
          room_code: columns['رمز القاعة'] || columns.roomcode || '',
          room_name: columns['اسم القاعة'] || columns.roomname || columns.roomcode || '',
          day: columns['اليوم'] || columns.day || '',
          day_arabic: columns['اليوم بالعربية'] || columns.dayarabic || columns['اليوم'] || columns.day || '',
          time_slot: columns['الفترة الزمنية'] || columns.timeslot || '',
          start_time: columns['وقت البداية'] || columns.starttime || '',
          end_time: columns['وقت النهاية'] || columns.endtime || '',
          activity_id: columns['معرف النشاط'] || columns.activityid || '',
          tags: columns['العلامات'] || columns.tags || ''
        };
      }
    });

    const validData = mappedData.filter(entry => entry.class && entry.day);
    if (validData.length === 0) {
      throw new Error('لم يتم العثور على حصص صالحة. تأكد من أن الملف يحتوي على بيانات جداول الحصص من ProgMawarid.');
    }

    console.log('📊 إجمالي الحصص المستوردة:', validData.length);
    console.log('📝 عينة من البيانات:', validData.slice(0, 5));

    setFullData(validData);
    setPreviewData(validData.slice(0, 10));
    setShowPreview(true);
    setMessage({
      type: 'info',
      text: `تم تحميل ${validData.length} حصة. معاينة أول 10 سجلات. انقر "تأكيد الاستيراد" للحفظ.`
    });
  };

  const processTeacherData = async (data: any[]) => {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('الملف لا يحتوي على صفوف بيانات. نزّل نموذج توزيع الأساتذة واملأه ثم أعد المحاولة.');
    }
    const { assignments, skippedRows } = mapTeacherAssignmentRows(data);

    console.log('📊 إجمالي التوزيعات المستوردة:', assignments.length);

    setFullData(assignments);
    setPreviewData(assignments.slice(0, 10));
    setShowPreview(true);
    setMessage({
      type: 'info',
      text: `تم تحميل ${assignments.length} توزيع. معاينة أول 10 سجلات.${skippedRows ? ` تم تجاهل ${skippedRows} صفوف لغياب معرف الأستاذ أو القسم.` : ''} انقر "تأكيد الاستيراد" للحفظ.`
    });
  };

  const confirmImport = async () => {
    if (fullData.length === 0) return;

    setLoading(true);
    setProgress(0);
    try {
      await dbManager.initialize();

      if (importType === 'timetable') {
        setProgressMessage('مسح جدول الحصص القديم...');
        setProgress(5);
        await dbManager.clearTimetable();

        setProgressMessage(`استيراد ${fullData.length} حصة...`);
        let imported = 0;
        for (const entry of fullData) {
          await dbManager.addTimetableEntry(entry);
          imported++;
          const progressPercent = Math.round((imported / fullData.length) * 85) + 10;
          setProgress(progressPercent);
          setProgressMessage(`تم استيراد ${imported}/${fullData.length} حصة...`);
        }

        setProgressMessage('استخراج المواد الدراسية...');
        setProgress(95);
        const subjectsCount = await dbManager.extractSubjectsFromTimetable();

        setProgress(100);
        setProgressMessage('اكتمل الاستيراد بنجاح!');

        setMessage({
          type: 'success',
          text: `✅ تم استيراد ${fullData.length} حصة و ${subjectsCount} مادة دراسية بنجاح إلى قاعدة البيانات المحلية`
        });
      } else {
        setProgressMessage('مسح توزيع الأساتذة القديم...');
        setProgress(5);
        await dbManager.clearTeacherAssignments();

        setProgressMessage(`استيراد ${fullData.length} توزيع...`);
        let imported = 0;
        for (const assignment of fullData) {
          await dbManager.addTeacherAssignment(assignment);
          imported++;
          const progressPercent = Math.round((imported / fullData.length) * 90) + 5;
          setProgress(progressPercent);
          setProgressMessage(`تم استيراد ${imported}/${fullData.length} توزيع...`);
        }

        setProgress(100);
        setProgressMessage('اكتمل الاستيراد بنجاح!');

        setMessage({
          type: 'success',
          text: `✅ تم استيراد ${fullData.length} توزيع بنجاح إلى قاعدة البيانات المحلية`
        });
      }

      setTimeout(() => {
        setProgress(0);
        setProgressMessage('');
      }, 2000);

      setFullData([]);
      setPreviewData([]);
      setShowPreview(false);
    } catch (error) {
      console.error('خطأ في الحفظ:', error);
      setProgress(0);
      setProgressMessage('');
      setMessage({ type: 'error', text: 'فشل حفظ البيانات في قاعدة البيانات المحلية' });
    } finally {
      setLoading(false);
    }
  };

  const downloadTimetableTemplate = () => {
    const timetableTemplate = [
      {
        'اسم الأستاذ بالعربية': 'أحمد محمد',
        'اسم الأستاذ بالفرنسية': 'Ahmed Mohamed',
        'معرف الأستاذ': 'JA12345',
        'رقم التأجير': '123456',
        'رمز المادة': '0001',
        'المادة بالعربية': 'رياضيات',
        'القسم': '1APIC-1',
        'رمز القاعة': 'A13',
        'اسم القاعة': 'A13',
        'اليوم': 'Lundi_m',
        'اليوم بالعربية': 'الإثنين',
        'الفترة الزمنية': '08:00 - 09:00',
        'وقت البداية': '08:00',
        'وقت النهاية': '09:00',
        'معرف النشاط': '1',
        'العلامات': ''
      }
    ];

    const ws = XLSX.utils.json_to_sheet(timetableTemplate);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'نموذج');
    XLSX.writeFile(wb, 'نموذج_جدول_الحصص.xlsx');
  };

  const downloadTeacherTemplate = () => {
    const workbook = XLSX.utils.book_new();
    const distributionSheet = XLSX.utils.aoa_to_sheet([teacherAssignmentTemplateHeaders]);
    distributionSheet['!cols'] = [
      { wch: 28 }, { wch: 28 }, { wch: 20 }, { wch: 18 },
      { wch: 18 }, { wch: 16 }, { wch: 24 },
    ];
    const instructionsSheet = XLSX.utils.aoa_to_sheet(teacherAssignmentTemplateInstructions);
    instructionsSheet['!cols'] = [{ wch: 24 }, { wch: 90 }];
    XLSX.utils.book_append_sheet(workbook, distributionSheet, 'التوزيع');
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'التعليمات');
    XLSX.writeFile(workbook, 'نموذج_استيراد_توزيع_الأساتذة.xlsx');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white">
            <div className="flex items-center gap-3">
              <Calendar className="w-10 h-10" />
              <div>
                <h1 className="text-3xl font-bold">استيراد جداول الحصص</h1>
                <p className="text-blue-100 mt-1">استيراد جداول الحصص من ProgMawarid (CSV / Excel / JSON)</p>
              </div>
            </div>
          </div>

          {message && (
            <div className={`m-6 p-4 rounded-lg flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : message.type === 'error'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="font-medium">{message.text}</span>
            </div>
          )}

          {loading && progress > 0 && (
            <div className="m-6 p-6 bg-blue-50 rounded-lg border border-blue-200">
              <div className="mb-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-blue-800">{progressMessage}</span>
                  <span className="text-sm font-bold text-blue-900">{progress}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          <div className="p-6 space-y-6">
            <div className="flex gap-4 items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">اختر نوع الملف للاستيراد</h2>
              <button
                onClick={downloadTimetableTemplate}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-300 transition-colors"
              >
                <Download className="w-5 h-5" />
                تحميل نموذج جدول الحصص
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                <Calendar className="w-16 h-16 mx-auto text-blue-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-800 mb-2">استيراد جداول الحصص</h3>
                <p className="text-gray-600 mb-4">رفع ملف جداول الحصص من ProgMawarid</p>
                <label className="cursor-pointer inline-block">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,.json"
                    onChange={(e) => handleFileUpload(e, 'timetable')}
                    disabled={loading}
                    className="hidden"
                  />
                  <div className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors inline-flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    اختر الملف
                  </div>
                </label>
                <p className="text-sm text-gray-500 mt-3">CSV, Excel, JSON</p>
              </div>

              <div className="border-2 border-dashed border-green-300 rounded-lg p-8 text-center hover:border-green-500 transition-colors">
                <Users className="w-16 h-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-800 mb-2">استيراد توزيع الأساتذة</h3>
                <p className="text-gray-600 mb-4">رفع ملف توزيع الأساتذة على الأقسام. يلزم معرف الأستاذ والقسم في كل صف.</p>
                <button
                  type="button"
                  onClick={downloadTeacherTemplate}
                  disabled={loading}
                  className="mb-4 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold inline-flex items-center gap-2 hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  <Download className="w-5 h-5" />
                  تحميل نموذج توزيع الأساتذة
                </button>
                <label className="cursor-pointer inline-block">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,.json"
                    onChange={(e) => handleFileUpload(e, 'teachers')}
                    disabled={loading}
                    className="hidden"
                  />
                  <div className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 transition-colors inline-flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    اختر الملف
                  </div>
                </label>
                <p className="text-sm text-gray-500 mt-3">CSV, Excel, JSON</p>
              </div>
            </div>

            {showPreview && previewData.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800">معاينة البيانات</h3>
                  <button
                    onClick={confirmImport}
                    disabled={loading}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    تأكيد الاستيراد
                  </button>
                </div>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        {importType === 'timetable' ? (
                          <>
                            <th className="px-4 py-2 text-right font-bold">القسم</th>
                            <th className="px-4 py-2 text-right font-bold">اليوم</th>
                            <th className="px-4 py-2 text-right font-bold">التوقيت</th>
                            <th className="px-4 py-2 text-right font-bold">المادة</th>
                            <th className="px-4 py-2 text-right font-bold">الأستاذ</th>
                            <th className="px-4 py-2 text-right font-bold">القاعة</th>
                          </>
                        ) : (
                          <>
                            <th className="px-4 py-2 text-right font-bold">الأستاذ</th>
                            <th className="px-4 py-2 text-right font-bold">القسم</th>
                            <th className="px-4 py-2 text-right font-bold">المادة</th>
                            <th className="px-4 py-2 text-right font-bold">معرف الأستاذ</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((item, index) => (
                        <tr key={index} className="border-t hover:bg-gray-50">
                          {importType === 'timetable' ? (
                            <>
                              <td className="px-4 py-2">{item.class}</td>
                              <td className="px-4 py-2">{item.day_arabic}</td>
                              <td className="px-4 py-2">{item.time_slot}</td>
                              <td className="px-4 py-2">{item.subject_arabic}</td>
                              <td className="px-4 py-2">{item.teacher_name_arabic}</td>
                              <td className="px-4 py-2">{item.room_name}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-2">{item.teacher_arabic}</td>
                              <td className="px-4 py-2">{item.class}</td>
                              <td className="px-4 py-2">{item.subject_arabic}</td>
                              <td className="px-4 py-2">{item.teacher_id}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <details className="bg-gray-50 rounded-lg p-6 mt-6">
              <summary className="font-bold text-gray-800 cursor-pointer flex items-center gap-2">
                <FileText className="w-5 h-5" />
                تفاصيل الملفات المدعومة
              </summary>
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-gray-700 mb-2">جداول الحصص (timetable):</h4>
                  <code className="block bg-white p-3 rounded text-sm overflow-x-auto">
                    Activity Id, Day, Hour, Students Sets, Subject, Teachers, Activity Tags, Room
                  </code>
                </div>
                <div>
                  <h4 className="font-bold text-gray-700 mb-2">توزيع الأساتذة (teacher_assignments):</h4>
                  <code className="block bg-white p-3 rounded text-sm overflow-x-auto">
                    اسم الأستاذ بالعربية, اسم الأستاذ بالفرنسية, معرف الأستاذ, رقم التأجير,
                    القسم, رمز المادة, المادة بالعربية
                  </code>
                  <p className="mt-2 text-sm text-gray-600">
                    يلزم وجود معرف الأستاذ والقسم. يمكن استخدام عناوين القالب العربية أو المقابلة الإنجليزية، ويظهر خطأ يوضح العناوين المطلوبة إذا لم يتعرف البرنامج على الملف.
                  </p>
                </div>
                <div className="bg-blue-50 p-3 rounded">
                  <p className="text-sm text-blue-800">
                    تُحوّل رموز الأيام والفترات تلقائياً. إذا لم يتضمن الملف أسماء المواد أو الأساتذة وأوقات الحصص، فستظهر الرموز المتاحة دون تخمين بيانات غير موجودة في الملف.
                  </p>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
};
