import { supabase } from './supabase';

export interface Schedule {
  id?: string;
  section: string;
  day: string;
  period: string;
  subject: string;
  teacher_code: string;
  teacher_name: string;
  time_from: string;
  time_to: string;
  room: string;
}

export interface Teacher {
  id?: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  subjects: string[];
  sections: string[];
}

export const getScheduleForSection = async (
  section: string,
  day: string,
  period: string
): Promise<Schedule | null> => {
  try {
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .eq('section', section)
      .eq('day', day)
      .eq('period', period)
      .maybeSingle();

    return data;
  } catch (error) {
    console.error('خطأ في جلب جدول الحصة:', error);
    return null;
  }
};

export const getTeacherByCode = async (code: string): Promise<Teacher | null> => {
  try {
    const { data } = await supabase
      .from('teachers')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    return data;
  } catch (error) {
    console.error('خطأ في جلب بيانات الأستاذ:', error);
    return null;
  }
};

export const getTeachersForSection = async (section: string): Promise<Teacher[]> => {
  try {
    const { data } = await supabase
      .from('teachers')
      .select('*')
      .contains('sections', [section]);

    return data || [];
  } catch (error) {
    console.error('خطأ في جلب أساتذة القسم:', error);
    return [];
  }
};

export const getScheduleForStudent = async (
  section: string,
  date: string,
  period: string
): Promise<Schedule | null> => {
  const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const dateObj = new Date(date);
  const dayName = dayNames[dateObj.getDay()];

  return getScheduleForSection(section, dayName, period);
};

export const getWeekScheduleForSection = async (section: string): Promise<Schedule[]> => {
  try {
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .eq('section', section)
      .order('day')
      .order('period');

    return data || [];
  } catch (error) {
    console.error('خطأ في جلب جدول الأسبوع:', error);
    return [];
  }
};

export const getAllSchedules = async (): Promise<Schedule[]> => {
  try {
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .order('section')
      .order('day')
      .order('period');

    return data || [];
  } catch (error) {
    console.error('خطأ في جلب كل الجداول:', error);
    return [];
  }
};

export const getAllTeachers = async (): Promise<Teacher[]> => {
  try {
    const { data } = await supabase
      .from('teachers')
      .select('*')
      .order('name');

    return data || [];
  } catch (error) {
    console.error('خطأ في جلب الأساتذة:', error);
    return [];
  }
};
