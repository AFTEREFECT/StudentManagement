import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Calendar, Users, Download } from 'lucide-react';
import { dbManager } from '../utils/database';
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

  const handleExcelCSVImport = async (file: File, type: 'timetable' | 'teachers') => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (type === 'timetable') {
          await processTimetableData(jsonData);
        } else {
          await processTeacherData(jsonData);
        }
      } catch (error) {
        console.error('خطأ في معالجة الملف:', error);
        setMessage({ type: 'error', text: 'فشل معالجة الملف' });
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleJSONImport = async (file: File, type: 'timetable' | 'teachers') => {
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
      } catch (error) {
        console.error('خطأ في معالجة JSON:', error);
        setMessage({ type: 'error', text: 'فشل معالجة ملف JSON' });
      }
    };

    reader.readAsText(file);
  };

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
        return {
          teacher_name_arabic: row['اسم الأستاذ بالعربية'] || row['nameArabic'] || row['SAIDY KARIMA'] || '',
          teacher_name_french: row['اسم الأستاذ بالفرنسية'] || row['nameFrench'] || row['كريمة السعيدي'] || '',
          teacher_id: row['معرف الأستاذ'] || row['teacherId'] || row['JE191632'] || '',
          ppr: row['رقم التأجير'] || row['ppr'] || row['1545101'] || '',
          subject_code: row['رمز المادة'] || row['subjectCode'] || row['0011'] || '',
          subject_arabic: row['المادة بالعربية'] || row['subjectArabic'] || row['اللغة العربية'] || '',
          class: row['القسم'] || row['class'] || row['3APIC-4'] || '',
          room_code: row['رمز القاعة'] || row['roomCode'] || row['P-A-102'] || '',
          room_name: row['اسم القاعة'] || row['roomName'] || row['P-A-102'] || '',
          day: row['اليوم'] || row['day'] || row['Vendredi_s'] || '',
          day_arabic: row['اليوم بالعربية'] || row['dayArabic'] || row['الجمعة'] || '',
          time_slot: row['الفترة الزمنية'] || row['timeSlot'] || row['14:30 - 15:30'] || '',
          start_time: row['وقت البداية'] || row['startTime'] || row['14:30'] || '',
          end_time: row['وقت النهاية'] || row['endTime'] || row['15:30'] || '',
          activity_id: row['معرف النشاط'] || row['activityId'] || row['127'] || '',
          tags: row['العلامات'] || row['tags'] || ''
        };
      }
    });

    const validData = mappedData.filter(entry => entry.class && entry.day);

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
    const mappedData = data.map((row: any) => ({
      teacher_arabic: row['teacherArabic'] || row['اسم الأستاذ بالعربية'] || row['NEZHA  ZRHAIDI'] || '',
      teacher_french: row['teacherFrench'] || row['اسم الأستاذ بالفرنسية'] || row['نزهة  زغيدي'] || '',
      teacher_id: row['teacherId'] || row['معرف الأستاذ'] || row['JA39397'] || '',
      ppr: row['ppr'] || row['رقم التأجير'] || row['1751480'] || '',
      class: row['class'] || row['القسم'] || row['1APIC-2'] || '',
      subject_code: row['subjectCode'] || row['رمز المادة'] || row['0013'] || '',
      subject_arabic: row['subjectArabic'] || row['المادة بالعربية'] || row['اللغة الإنجليزية'] || ''
    }));

    const validData = mappedData.filter(entry => entry.class && entry.teacher_id);

    console.log('📊 إجمالي التوزيعات المستوردة:', validData.length);

    setFullData(validData);
    setPreviewData(validData.slice(0, 10));
    setShowPreview(true);
    setMessage({
      type: 'info',
      text: `تم تحميل ${validData.length} توزيع. معاينة أول 10 سجلات. انقر "تأكيد الاستيراد" للحفظ.`
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

  const downloadTemplate = () => {
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

          <div className="p-6 border-b border-gray-200 bg-yellow-50">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-yellow-900 mb-2">ملاحظة هامة</h3>
                <p className="text-yellow-800">
                  النظام يعمل بقاعدة بيانات محلية (IndexedDB). جميع البيانات تُحفظ على جهازك فقط ولا يتم إرسالها لأي سيرفر خارجي.
                </p>
                <p className="text-yellow-800 mt-2">
                  قم باستيراد جداول الحصص من برنامج <strong>ProgMawarid</strong> بصيغة CSV أو Excel أو JSON
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex gap-4 items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">اختر نوع الملف للاستيراد</h2>
              <button
                onClick={downloadTemplate}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-300 transition-colors"
              >
                <Download className="w-5 h-5" />
                تحميل نموذج Excel
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
                <p className="text-gray-600 mb-4">رفع ملف توزيع الأساتذة على الأقسام</p>
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

            <div className="bg-gray-50 rounded-lg p-6 mt-6">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                التنسيق المطلوب لملفات ProgMawarid
              </h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-gray-700 mb-2">جداول الحصص (timetable):</h4>
                  <code className="block bg-white p-3 rounded text-sm overflow-x-auto">
                    اسم الأستاذ بالعربية, اسم الأستاذ بالفرنسية, معرف الأستاذ, رقم التأجير,
                    رمز المادة, المادة بالعربية, القسم, رمز القاعة, اسم القاعة,
                    اليوم, اليوم بالعربية, الفترة الزمنية, وقت البداية, وقت النهاية
                  </code>
                </div>
                <div>
                  <h4 className="font-bold text-gray-700 mb-2">توزيع الأساتذة (teacher_assignments):</h4>
                  <code className="block bg-white p-3 rounded text-sm overflow-x-auto">
                    اسم الأستاذ بالعربية, اسم الأستاذ بالفرنسية, معرف الأستاذ, رقم التأجير,
                    القسم, رمز المادة, المادة بالعربية
                  </code>
                </div>
                <div className="bg-blue-50 p-3 rounded">
                  <p className="text-sm text-blue-800">
                    <strong>ملاحظة:</strong> النظام يدعم تلقائياً الأعمدة بالعربية والفرنسية والإنجليزية.
                    يمكنك استخدام ملفات JSON بالهيكلة الموضحة في التعليمات.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
