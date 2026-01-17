import React, { useState, useEffect } from 'react';
import { Printer, Calendar, Download } from 'lucide-react';
import { dbManager } from '../utils/database';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface TimetableEntry {
  class: string;
  day_arabic: string;
  time_slot: string;
  subject_arabic: string;
  teacher_name_arabic: string;
  room_name: string;
  start_time: string;
  end_time: string;
}

interface PeriodTime {
  label: string;
  start: string;
  end: string;
}

const periods: PeriodTime[] = [
  { label: "الأولى", start: "08:30", end: "09:30" },
  { label: "الثانية", start: "09:30", end: "10:30" },
  { label: "الثالثة", start: "10:30", end: "11:30" },
  { label: "الرابعة", start: "11:30", end: "12:30" },
  { label: "الخامسة", start: "14:30", end: "15:30" },
  { label: "السادسة", start: "15:30", end: "16:30" },
  { label: "السابعة", start: "16:30", end: "17:30" },
  { label: "الثامنة", start: "17:30", end: "18:30" },
];

const days = ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export const TimetablePrintManager: React.FC = () => {
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical');
  const [schedule, setSchedule] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [institutionName, setInstitutionName] = useState<string>('');

  useEffect(() => {
    loadClasses();
    loadInstitutionName();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadSchedule();
    }
  }, [selectedClass]);

  const loadInstitutionName = async () => {
    try {
      await dbManager.initialize();
      const settings = await dbManager.getInstitutionSettings();
      setInstitutionName(settings.name || 'المؤسسة التعليمية');
    } catch (error) {
      console.error('خطأ في تحميل اسم المؤسسة:', error);
      setInstitutionName('المؤسسة التعليمية');
    }
  };

  const loadClasses = async () => {
    try {
      await dbManager.initialize();
      const allStudents = await dbManager.getStudents();
      const uniqueSections = [...new Set(allStudents.map(s => s.section).filter(Boolean))];
      setClasses(uniqueSections.sort() as string[]);
    } catch (error) {
      console.error('خطأ في تحميل الأقسام:', error);
    }
  };

  const loadSchedule = async () => {
    setLoading(true);
    try {
      await dbManager.initialize();
      const data = await dbManager.getTimetableByClass(selectedClass);
      setSchedule(data);
    } catch (error) {
      console.error('خطأ في تحميل جدول الحصص:', error);
    }
    setLoading(false);
  };

  const getCellContent = (day: string, periodIndex: number) => {
    const period = periods[periodIndex];

    const entry = schedule.find(s => {
      // تطبيع دالة التطبيع للأيام
      const normalizeDay = (d: string) => {
        if (!d) return '';
        return d.trim().replace(/إ/g, 'ا').replace(/أ/g, 'ا').toLowerCase();
      };

      const normalizedDay = normalizeDay(s.day_arabic);
      const normalizedSearchDay = normalizeDay(day);

      const timeMatches = s.time_slot?.includes(period.start) ||
                          (s.start_time === period.start && s.end_time === period.end) ||
                          s.time_slot?.includes(period.label);

      const dayMatches = normalizedDay === normalizedSearchDay;

      return dayMatches && timeMatches;
    });

    return entry;
  };

  const handlePrint = async () => {
    if (!selectedClass) {
      alert('⚠️ يرجى اختيار قسم أولاً');
      return;
    }

    if (schedule.length === 0) {
      alert('⚠️ لا توجد حصص لهذا القسم');
      return;
    }

    setLoading(true);

    try {
      const printElement = document.getElementById('timetable-print-area');
      if (!printElement) {
        alert('❌ خطأ في إنشاء الجدول');
        return;
      }

      const canvas = await html2canvas(printElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: layout === 'horizontal' ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10;

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`جدول_الحصص_${selectedClass}_${new Date().toLocaleDateString('ar-EG')}.pdf`);
      alert('✅ تم إنشاء ملف PDF بنجاح');
    } catch (error) {
      console.error('خطأ في الطباعة:', error);
      alert('❌ حدث خطأ أثناء إنشاء ملف PDF');
    }

    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <Printer className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">طباعة جداول الحصص</h2>
            <p className="text-gray-600">اختر القسم والتنسيق المطلوب</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              اختر القسم
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- اختر قسماً --</option>
              {classes.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              نوع التنسيق
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setLayout('vertical')}
                className={`flex-1 px-4 py-2 rounded-lg font-bold transition-all ${
                  layout === 'vertical'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                عمودي
              </button>
              <button
                onClick={() => setLayout('horizontal')}
                className={`flex-1 px-4 py-2 rounded-lg font-bold transition-all ${
                  layout === 'horizontal'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                أفقي
              </button>
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={handlePrint}
              disabled={!selectedClass || loading || schedule.length === 0}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              تحميل PDF
            </button>
          </div>
        </div>

        {selectedClass && schedule.length > 0 && (
          <div className="text-sm text-gray-600 mb-4">
            عدد الحصص: {schedule.length} حصة
          </div>
        )}
      </div>

      {selectedClass && schedule.length > 0 && (
        <div id="timetable-print-area" className="bg-white rounded-lg shadow-md p-8" dir="rtl">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{institutionName}</h1>
            <h2 className="text-xl font-bold text-blue-700 mb-1">جدول الحصص</h2>
            <p className="text-lg text-gray-700">القسم: {selectedClass}</p>
            <p className="text-sm text-gray-600">السنة الدراسية {new Date().getFullYear()}/{new Date().getFullYear() + 1}</p>
          </div>

          {layout === 'vertical' ? (
            <table className="w-full border-collapse border-2 border-gray-800">
              <thead>
                <tr className="bg-blue-100">
                  <th className="border-2 border-gray-800 px-3 py-3 text-center font-bold">التوقيت</th>
                  {days.map(day => (
                    <th key={day} className="border-2 border-gray-800 px-3 py-3 text-center font-bold">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((period, idx) => (
                  <tr key={period.label}>
                    <td className="border-2 border-gray-800 px-2 py-3 bg-gray-50 font-bold text-center text-sm">
                      <div>{period.label}</div>
                      <div className="text-xs text-gray-600 font-normal mt-1">
                        {period.start} - {period.end}
                      </div>
                    </td>
                    {days.map(day => {
                      const cell = getCellContent(day, idx);
                      return (
                        <td key={`${day}-${period.label}`} className="border-2 border-gray-800 px-2 py-2">
                          {cell ? (
                            <div className="text-sm space-y-1">
                              <div className="font-bold text-blue-700">{cell.subject_arabic}</div>
                              {cell.room_name && (
                                <div className="text-gray-600 text-xs">{cell.room_name}</div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center text-gray-400 text-sm">-</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full border-collapse border-2 border-gray-800">
              <thead>
                <tr className="bg-green-100">
                  <th className="border-2 border-gray-800 px-3 py-3 text-center font-bold">اليوم</th>
                  {periods.map(period => (
                    <th key={period.label} className="border-2 border-gray-800 px-2 py-3 text-center font-bold text-sm">
                      <div>{period.label}</div>
                      <div className="text-xs text-gray-600 font-normal mt-1">
                        {period.start} - {period.end}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map(day => (
                  <tr key={day}>
                    <td className="border-2 border-gray-800 px-3 py-3 bg-gray-50 font-bold text-center">
                      {day}
                    </td>
                    {periods.map((period, idx) => {
                      const cell = getCellContent(day, idx);
                      return (
                        <td key={`${day}-${period.label}`} className="border-2 border-gray-800 px-2 py-2">
                          {cell ? (
                            <div className="text-sm space-y-1">
                              <div className="font-bold text-blue-700">{cell.subject_arabic}</div>
                              {cell.room_name && (
                                <div className="text-gray-600 text-xs">{cell.room_name}</div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center text-gray-400 text-sm">-</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <p className="text-lg font-bold text-gray-900">جاري إنشاء ملف PDF...</p>
          </div>
        </div>
      )}
    </div>
  );
};
