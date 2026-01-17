import React, { useState, useEffect } from 'react';
import { Printer, Calendar, Download } from 'lucide-react';
import { dbManager } from '../utils/database';

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

export const TimetablePrint: React.FC = () => {
  const [sections, setSections] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [periodsPerSession, setPeriodsPerSession] = useState<number>(8);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSections();
  }, []);

  useEffect(() => {
    if (selectedSection) {
      loadTimetable();
    }
  }, [selectedSection]);

  const loadSections = async () => {
    try {
      await dbManager.initialize();
      const students = await dbManager.getStudents();
      const uniqueSections = Array.from(new Set(students.map(s => s.section))).filter(Boolean);
      const sortedSections = uniqueSections.sort((a, b) => {
        const getNum = (s: string) => {
          const match = s.match(/\d+/);
          return match ? parseInt(match[0], 10) : 0;
        };
        const numA = getNum(a);
        const numB = getNum(b);
        if (numA !== numB) return numA - numB;
        return a.localeCompare(b);
      });
      setSections(sortedSections);
    } catch (error) {
      console.error('خطأ في تحميل الأقسام:', error);
    }
  };

  const loadTimetable = async () => {
    try {
      setLoading(true);
      await dbManager.initialize();
      console.log('جاري تحميل جدول الحصص للقسم:', selectedSection);
      const data = await dbManager.getTimetableByClass(selectedSection);
      console.log('عدد الحصص المحملة:', data.length);
      setTimetable(data);
    } catch (error) {
      console.error('خطأ في تحميل جدول الحصص:', error);
      alert('حدث خطأ في تحميل جدول الحصص. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!selectedSection || timetable.length === 0) {
      alert('يرجى اختيار قسم وتحميل جدول الحصص أولاً');
      return;
    }

    const days = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    const uniquePeriods = Array.from(new Set(timetable.map(t => t.time_slot))).filter(Boolean);

    const periodsWithTime = uniquePeriods.map(period => {
      const entry = timetable.find(t => t.time_slot === period);
      return {
        period,
        start_time: entry?.start_time || '00:00',
        end_time: entry?.end_time || '00:00'
      };
    });

    const sortedPeriods = periodsWithTime.sort((a, b) => {
      const timeA = a.start_time.split(':').map(Number);
      const timeB = b.start_time.split(':').map(Number);
      const minutesA = timeA[0] * 60 + timeA[1];
      const minutesB = timeB[0] * 60 + timeB[1];
      return minutesA - minutesB;
    });

    const morningPeriods = sortedPeriods.filter(p => {
      const hour = parseInt(p.start_time.split(':')[0]);
      return hour < 14;
    }).map(p => p.period);

    const afternoonPeriods = sortedPeriods.filter(p => {
      const hour = parseInt(p.start_time.split(':')[0]);
      return hour >= 14;
    }).map(p => p.period);

    const generateTable = (sessionPeriods: string[], sessionTitle: string) => {
      if (sessionPeriods.length === 0) return '';

      let tableHTML = `
        <div class="session">
          <h3 class="session-title">${sessionTitle}</h3>
          <table class="timetable">
            <thead>
              <tr>
                <th class="day-header">اليوم / الحصة</th>
                ${sessionPeriods.map(period => {
                  const entry = timetable.find(t => t.time_slot === period);
                  const timeRange = entry ? `${entry.start_time} - ${entry.end_time}` : '';
                  return `<th class="period-header">
                    <div class="period-name">${period}</div>
                    <div class="period-time">${timeRange}</div>
                  </th>`;
                }).join('')}
              </tr>
            </thead>
            <tbody>
              ${days.map(day => `
                <tr>
                  <td class="day-cell">${day}</td>
                  ${sessionPeriods.map(period => {
                    const entry = timetable.find(t => t.day_arabic === day && t.time_slot === period);
                    if (entry) {
                      return `<td class="period-cell">
                        <div class="subject">${entry.subject_arabic}</div>
                        <div class="teacher">${entry.teacher_name_arabic}</div>
                        <div class="room">قاعة: ${entry.room_name}</div>
                      </td>`;
                    }
                    return '<td class="period-cell empty">-</td>';
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      return tableHTML;
    };

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>جدول الحصص - ${selectedSection}</title>
        <style>
          @media print {
            @page {
              size: A4 landscape;
              margin: 15mm;
            }
            body {
              margin: 0;
              padding: 0;
            }
            .session {
              page-break-inside: avoid;
              page-break-after: always;
            }
            .session:last-child {
              page-break-after: auto;
            }
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Arial', 'Tahoma', sans-serif;
            background: white;
            color: #000;
            direction: rtl;
          }

          .header {
            text-align: center;
            margin-bottom: 20px;
            padding: 15px;
            border-bottom: 3px solid #2563eb;
          }

          .header h1 {
            font-size: 28pt;
            color: #1e40af;
            margin-bottom: 8px;
            font-weight: bold;
          }

          .header h2 {
            font-size: 20pt;
            color: #3b82f6;
            margin-bottom: 5px;
          }

          .header .date {
            font-size: 12pt;
            color: #64748b;
          }

          .session {
            margin-bottom: 30px;
          }

          .session-title {
            font-size: 18pt;
            color: #1e40af;
            margin-bottom: 15px;
            padding: 10px;
            background: linear-gradient(to right, #dbeafe, #ffffff);
            border-right: 5px solid #2563eb;
            font-weight: bold;
          }

          .timetable {
            width: 100%;
            border-collapse: collapse;
            border: 2px solid #1e40af;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }

          .timetable th,
          .timetable td {
            border: 1px solid #94a3b8;
            padding: 8px;
            text-align: center;
          }

          .day-header,
          .period-header {
            background: linear-gradient(to bottom, #2563eb, #1e40af);
            color: white;
            font-weight: bold;
            font-size: 11pt;
          }

          .period-header {
            min-width: 120px;
          }

          .period-name {
            font-size: 11pt;
            margin-bottom: 3px;
          }

          .period-time {
            font-size: 9pt;
            opacity: 0.9;
          }

          .day-cell {
            background: linear-gradient(to left, #dbeafe, #eff6ff);
            font-weight: bold;
            font-size: 11pt;
            color: #1e40af;
            min-width: 80px;
          }

          .period-cell {
            background: white;
            vertical-align: middle;
            font-size: 10pt;
            min-height: 80px;
            padding: 6px;
          }

          .period-cell.empty {
            background: #f8fafc;
            color: #cbd5e1;
            font-size: 18pt;
          }

          .subject {
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 4px;
            font-size: 11pt;
          }

          .teacher {
            color: #475569;
            font-size: 9pt;
            margin-bottom: 3px;
          }

          .room {
            color: #64748b;
            font-size: 8pt;
            font-style: italic;
          }

          .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 2px solid #cbd5e1;
            color: #64748b;
            font-size: 10pt;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>جدول الحصص</h1>
          <h2>القسم: ${selectedSection}</h2>
          <div class="date">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
        </div>

        ${generateTable(morningPeriods, 'الحصص الصباحية')}
        ${afternoonPeriods.length > 0 ? generateTable(afternoonPeriods, 'الحصص المسائية') : ''}

        <div class="footer">
          <p>تم الإنشاء بواسطة نظام إدارة المؤسسة التعليمية</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 text-white">
            <div className="flex items-center gap-3">
              <Printer className="w-10 h-10" />
              <div>
                <h1 className="text-3xl font-bold">طباعة جداول الحصص</h1>
                <p className="text-blue-100 mt-1">اطبع جداول الحصص بتنسيق احترافي جاهز للطباعة</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  اختر القسم
                </label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-lg"
                >
                  <option value="">-- اختر القسم --</option>
                  {sections.map(section => (
                    <option key={section} value={section}>{section}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  عدد الحصص في الفترة الواحدة
                </label>
                <select
                  value={periodsPerSession}
                  onChange={(e) => setPeriodsPerSession(Number(e.target.value))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-lg"
                >
                  <option value="4">4 حصص (فترتين)</option>
                  <option value="5">5 حصص (فترتين)</option>
                  <option value="6">6 حصص (فترتين)</option>
                  <option value="8">8 حصص (فترتين)</option>
                  <option value="999">جميع الحصص (فترة واحدة)</option>
                </select>
              </div>
            </div>

            {loading && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
                <p className="mt-4 text-gray-600 font-medium">جاري تحميل جدول الحصص...</p>
              </div>
            )}

            {!loading && selectedSection && timetable.length > 0 && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg border-2 border-green-200 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-green-900 mb-2">جدول الحصص جاهز!</h3>
                    <p className="text-green-700">
                      تم تحميل {timetable.length} حصة للقسم <strong>{selectedSection}</strong>
                    </p>
                  </div>
                  <button
                    onClick={handlePrint}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
                  >
                    <Printer className="w-5 h-5" />
                    طباعة جدول الحصص
                  </button>
                </div>
              </div>
            )}

            {!loading && selectedSection && timetable.length === 0 && (
              <div className="bg-yellow-50 p-6 rounded-lg border-2 border-yellow-200">
                <div className="flex items-center gap-3">
                  <Calendar className="w-8 h-8 text-yellow-600" />
                  <div>
                    <h3 className="font-bold text-yellow-900 mb-1">لا توجد بيانات</h3>
                    <p className="text-yellow-800">لم يتم العثور على جدول حصص للقسم المحدد. يرجى التأكد من استيراد جداول الحصص أولاً.</p>
                  </div>
                </div>
              </div>
            )}

            {!selectedSection && (
              <div className="bg-blue-50 p-8 rounded-lg border-2 border-blue-200 text-center">
                <Calendar className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-blue-900 mb-2">ابدأ بطباعة جدول الحصص</h3>
                <p className="text-blue-700 mb-4">
                  اختر القسم من القائمة أعلاه لعرض جدول الحصص وطباعته
                </p>
                <div className="bg-white p-4 rounded-lg mt-6 text-right">
                  <h4 className="font-bold text-gray-900 mb-3">مزايا النظام:</h4>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>تنسيق احترافي جاهز للطباعة</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>الأيام عمودياً والحصص أفقياً</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>تقسيم تلقائي للفترات (صباحية/مسائية)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>عرض المادة، الأستاذ، والقاعة في كل خلية</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>طباعة مباشرة بحجم A4 أفقي</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
