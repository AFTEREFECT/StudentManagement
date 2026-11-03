import { dbManager } from './database';

export interface TestTeacher { id: string; name: string }
export interface TestLesson {
  id: string; teacherId: string; className: string; subject: string; day: string; time: string;
}
export interface TestStudent { id: string; name: string; className: string }
export interface TestData { teachers: TestTeacher[]; lessons: TestLesson[]; students: TestStudent[]; sample: boolean }
export interface TestRecord {
  id: string; lessonId: string; teacherName: string; className: string; subject: string;
  date: string; absentIds: string[]; absentNames: string[]; updatedAt: string;
  status: 'submitted' | 'confirmed' | 'cancelled';
}
interface LocalLesson {
  id: string; teacher_id?: string; teacher_name_arabic?: string; class?: string;
  subject_arabic?: string; subject_code?: string; day_arabic?: string; day?: string;
  start_time?: string; end_time?: string; time_slot?: string;
}
interface LocalStudent { id: string; firstName?: string; lastName?: string; section?: string }
const storageKey = 'progtalamid.attendance-test.records.v1';
type TestStorage = Pick<Storage, 'getItem' | 'setItem'>;
const teacherKey = (value: string) => value.replace(/\s/g, '').toUpperCase();

export function sampleAttendanceData(): TestData {
  return {
    sample: true,
    teachers: [{ id: 'sample-teacher', name: 'أستاذ التجربة' }],
    lessons: [{ id: 'sample-lesson', teacherId: 'sample-teacher', className: 'قسم تجريبي', subject: 'مادة تجريبية', day: 'أي يوم', time: 'وقت مفتوح للتجربة' }],
    students: ['التلميذ الأول', 'التلميذ الثاني', 'التلميذ الثالث'].map((name, index) => ({ id: `sample-${index}`, name, className: 'قسم تجريبي' })),
  };
}

export async function loadAttendanceTestData(): Promise<TestData> {
  await dbManager.initialize();
  const [roster, timetable, students, subjects] = await Promise.all([
    dbManager.getAttendanceTeacherRoster(), dbManager.getAllTimetable(),
    dbManager.getStudents(), dbManager.getAttendanceSubjectMappings(),
  ]);
  if (!timetable.length) return sampleAttendanceData();
  const teachers = new Map<string, TestTeacher>(roster.map((row) => [
    teacherKey(row.nationalId), { id: teacherKey(row.nationalId), name: row.displayName },
  ]));
  const lessons = (timetable as LocalLesson[]).map((row): TestLesson => {
    const id = teacherKey(row.teacher_id || 'unassigned');
    if (!teachers.has(id)) teachers.set(id, { id, name: row.teacher_name_arabic || 'أستاذ غير مسمى' });
    return {
      id: String(row.id), teacherId: id, className: String(row.class || '').trim(),
      subject: subjects[row.subject_code || ''] || row.subject_arabic || row.subject_code || 'المادة',
      day: row.day_arabic || row.day || 'اليوم غير محدد',
      time: row.start_time && row.end_time ? `${row.start_time}–${row.end_time}` : row.time_slot || 'وقت مفتوح للتجربة',
    };
  });
  return {
    sample: false, teachers: [...teachers.values()], lessons,
    students: (students as LocalStudent[]).map((row) => ({
      id: String(row.id), name: `${row.firstName || ''} ${row.lastName || ''}`.trim(), className: String(row.section || '').trim(),
    })),
  };
}

export function readTestRecords(storage: TestStorage = window.localStorage): TestRecord[] {
  const value = storage.getItem(storageKey);
  if (!value) return [];
  const records: unknown = JSON.parse(value);
  if (!Array.isArray(records) || records.some((row) => !row || typeof row.id !== 'string' || !Array.isArray(row.absentIds) || !Array.isArray(row.absentNames))) {
    throw new Error('تعذرت قراءة سجلات الاختبار المحفوظة.');
  }
  return records as TestRecord[];
}

export function saveTestAttendance(data: TestData, lessonId: string, date: string, absentIds: string[], storage: TestStorage = window.localStorage): TestRecord[] {
  const lesson = data.lessons.find((row) => row.id === lessonId);
  if (!lesson) throw new Error('اختر حصة للتجربة.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('اختر تاريخ التسجيل.');
  const students = data.students.filter((row) => row.className === lesson.className);
  const uniqueAbsentIds = [...new Set(absentIds)];
  if (uniqueAbsentIds.some((id) => !students.some((student) => student.id === id))) {
    throw new Error('تضم اللائحة تلميذًا خارج هذا القسم.');
  }
  const record: TestRecord = {
    id: `${lessonId}:${date}`, lessonId, date, className: lesson.className, subject: lesson.subject,
    teacherName: data.teachers.find((row) => row.id === lesson.teacherId)?.name || 'الأستاذ',
    absentIds: uniqueAbsentIds,
    absentNames: students.filter((row) => uniqueAbsentIds.includes(row.id)).map((row) => row.name),
    status: 'submitted', updatedAt: new Date().toISOString(),
  };
  const records = readTestRecords(storage).filter((row) => row.id !== record.id);
  records.unshift(record);
  storage.setItem(storageKey, JSON.stringify(records));
  return records;
}

export function reviewTestAttendance(id: string, status: 'confirmed' | 'cancelled', storage: TestStorage = window.localStorage): TestRecord[] {
  const records = readTestRecords(storage);
  if (!records.some((row) => row.id === id)) throw new Error('لم يُعثر على تسجيل الاختبار.');
  const updated = records.map((row) => row.id === id ? { ...row, status, updatedAt: new Date().toISOString() } : row);
  storage.setItem(storageKey, JSON.stringify(updated));
  return updated;
}
