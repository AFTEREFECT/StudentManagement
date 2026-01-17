import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, MapPin, BookOpen } from 'lucide-react';
import { dbManager } from '../utils/database';

interface TimetableEntry {
  day_arabic: string;
  time_slot: string;
  subject_arabic: string;
  teacher_name_arabic: string;
  room_name: string;
  start_time: string;
  end_time: string;
}

interface StudentScheduleViewProps {
  section: string;
  studentName?: string;
}

interface PeriodTime {
  label: string;
  start: string;
  end: string;
  time_slot: string;
}

const days = ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const normalizeDayName = (day: string): string => {
  return day.trim().replace(/إ/g, 'ا');
};

export const StudentScheduleView: React.FC<StudentScheduleViewProps> = ({ section, studentName }) => {
  const [schedule, setSchedule] = useState<TimetableEntry[]>([]);
  const [periods, setPeriods] = useState<PeriodTime[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedule();
  }, [section]);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      await dbManager.initialize();
      console.log('🔍 جاري تحميل جدول الحصص للقسم:', section);
      const data = await dbManager.getTimetableByClass(section);
      console.log('📊 عدد الحصص المحملة:', data.length);

      if (data.length > 0) {
        console.log('✅ عينة من البيانات المحملة:', data[0]);
        console.log('📋 جميع الأيام الموجودة:', [...new Set(data.map(d => d.day_arabic))]);
        console.log('🕐 جميع الحصص الموجودة:', [...new Set(data.map(d => d.time_slot))]);

        const uniqueTimeslots = Array.from(new Set(data.map(d => d.time_slot))).filter(Boolean);
        const periodsData = uniqueTimeslots.map(slot => {
          const entry = data.find(d => d.time_slot === slot);
          return {
            label: slot,
            start: entry?.start_time || '00:00',
            end: entry?.end_time || '00:00',
            time_slot: slot
          };
        }).sort((a, b) => {
          const timeA = a.start.split(':').map(Number);
          const timeB = b.start.split(':').map(Number);
          const minutesA = timeA[0] * 60 + timeA[1];
          const minutesB = timeB[0] * 60 + timeB[1];
          return minutesA - minutesB;
        });

        setPeriods(periodsData);
      } else {
        console.warn('⚠️ لا توجد حصص للقسم:', section);
        setPeriods([]);
      }

      setSchedule(data);
    } catch (error) {
      console.error('❌ خطأ في تحميل جدول الحصص:', error);
    }
    setLoading(false);
  };

  const getCellContent = (day: string, periodIndex: number) => {
    if (periodIndex >= periods.length) return null;
    const period = periods[periodIndex];

    const entry = schedule.find(s => {
      const normalizedDbDay = normalizeDayName(s.day_arabic || '');
      const normalizedSearchDay = normalizeDayName(day);
      const dayMatches = normalizedDbDay === normalizedSearchDay;
      const timeMatches = s.time_slot === period.time_slot;
      return dayMatches && timeMatches;
    });

    return entry;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (schedule.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden p-8">
        <div className="text-center">
          <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-bold text-gray-700 mb-2">لا توجد حصص مسجلة</h3>
          <p className="text-gray-500 mb-4">
            لم يتم العثور على جدول حصص للقسم: <strong>{section}</strong>
          </p>
          <p className="text-sm text-gray-400">
            يرجى التأكد من استيراد جدول الحصص للقسم من قسم "استيراد جداول الحصص"
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6" />
          <div>
            <h2 className="text-xl font-bold">جدول الحصص</h2>
            {studentName && <p className="text-blue-100 text-sm">{studentName}</p>}
            <p className="text-blue-100 text-sm">القسم: {section}</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-center font-bold">التوقيت</th>
              {days.map(day => (
                <th key={day} className="border border-gray-300 px-3 py-2 text-center font-bold">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period, idx) => (
              <tr key={period.label}>
                <td className="border border-gray-300 px-3 py-3 bg-gray-50 font-bold text-center text-sm">
                  <div>{period.label}</div>
                  <div className="text-xs text-gray-600 font-normal mt-1">
                    {period.start} - {period.end}
                  </div>
                </td>
                {days.map(day => {
                  const cell = getCellContent(day, idx);
                  return (
                    <td key={`${day}-${period.label}`} className="border border-gray-300 px-2 py-2">
                      {cell ? (
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-1 font-bold text-blue-700">
                            <BookOpen className="w-3 h-3" />
                            <span>{cell.subject_arabic}</span>
                          </div>
                          {cell.room_name && (
                            <div className="flex items-center gap-1 text-gray-600">
                              <MapPin className="w-3 h-3" />
                              <span className="text-xs">{cell.room_name}</span>
                            </div>
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
      </div>

      <div className="p-4 bg-gray-50 text-sm text-gray-600 text-center">
        <p>إجمالي الحصص: {schedule.length}</p>
      </div>
    </div>
  );
};
