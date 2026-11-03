import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { mergeAttendanceTeacherDirectory } from './attendanceTeacherState';
import { attendanceLoginEmail, normalizeAttendanceUsername } from '../../supabase/functions/_shared/attendanceIdentity';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const attendanceCloudConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const attendanceCloud: SupabaseClient | null = attendanceCloudConfigured
  ? supabase
  : null;

export interface AttendanceProfile {
  user_id: string;
  institution_id: string;
  role: 'admin' | 'teacher';
  display_name: string;
  must_change_password: boolean;
  email?: string;
}

export interface CloudLesson {
  id: string;
  class_name: string;
  subject_code: string;
  subject_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string;
}

export interface CloudStudent {
  id: string;
  display_name: string;
  class_name: string;
}

function casablancaDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Casablanca',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function attendanceSignIn(usernameOrEmail: string, password: string) {
  if (!attendanceCloud) throw new Error('إعدادات المنصة السحابية غير مكتملة.');
  const email = attendanceLoginEmail(usernameOrEmail);
  const { error } = await attendanceCloud.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return getAttendanceProfile();
}

export async function attendanceSignOut() {
  if (!attendanceCloud) return;
  const { error } = await attendanceCloud.auth.signOut();
  if (error) throw error;
}

export async function getAttendanceProfile(): Promise<AttendanceProfile | null> {
  if (!attendanceCloud) return null;
  const { data: authData, error: authError } = await attendanceCloud.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) return null;

  const { data, error } = await attendanceCloud
    .from('attendance_profiles')
    .select('user_id, institution_id, role, display_name, must_change_password')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, email: authData.user.email || '' } as AttendanceProfile;
}

export async function bootstrapTestAttendanceAdmin(email: string, displayName: string) {
  if (!attendanceCloud) throw new Error('إعدادات المنصة السحابية غير مكتملة.');
  const response = await fetch(`${supabaseUrl}/functions/v1/attendance-test-admin-bootstrap`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ email, displayName }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'تعذر إنشاء حساب الإدارة التجريبي.');
  if (typeof result.email !== 'string' || !result.email) {
    throw new Error('تم إنشاء الحساب لكن لم يُرجع الخادم اسم الدخول؛ تحقق من مشروع Supabase.');
  }
  return { email: result.email as string };
}

export async function changeTestAdminCredentials(email: string, password: string) {
  if (!attendanceCloud) throw new Error('إعدادات المنصة السحابية غير مكتملة.');
  const { data, error } = await attendanceCloud.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error('انتهت الجلسة؛ سجّل الدخول مجددًا.');

  const response = await fetch(`${supabaseUrl}/functions/v1/attendance-change-test-admin-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({ email, password }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'تعذر تغيير كلمة المرور.');
  if (typeof result.email !== 'string') throw new Error('لم يؤكد الخادم تحديث البريد الإلكتروني.');
  return result.email as string;
}

export async function redeemAttendanceInvite(
  username: string,
  activationCode: string,
  password: string
) {
  if (!attendanceCloud) throw new Error('إعدادات المنصة السحابية غير مكتملة.');
  const response = await fetch(`${supabaseUrl}/functions/v1/attendance-redeem-invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ username: normalizeAttendanceUsername(username), activationCode, password }),
  });
  const result = await response.json();
  if (!response.ok) {
    const message = typeof result.error === 'string' ? result.error : '';
    if (
      response.status === 409 &&
      /تم.{0,20}تفعيل.{0,20}(مسبق|سابق)|already activated|account already exists/i.test(message)
    ) {
      throw new Error('خدمة التفعيل على الخادم قديمة. يجب تحديث attendance-redeem-invite في Supabase ثم إعادة المحاولة.');
    }
    if (response.status === 409) {
      throw new Error('هذا الرمز استُخدم أو استُبدل. اطلب من الإدارة إصدار رمز جديد.');
    }
    throw new Error(message || 'تعذر تفعيل الحساب.');
  }
  return {
    username: typeof result.username === 'string' ? result.username : normalizeAttendanceUsername(username),
    email: typeof result.email === 'string' ? result.email : attendanceLoginEmail(username),
  };
}

export async function getTeacherTimetable(): Promise<CloudLesson[]> {
  if (!attendanceCloud) throw new Error('إعدادات المنصة السحابية غير مكتملة.');
  const { data, error } = await attendanceCloud
    .from('attendance_timetable')
    .select('id, class_name, subject_code, subject_name, day_of_week, start_time, end_time, room')
    .order('day_of_week')
    .order('start_time');
  if (error) throw error;
  return (data || []) as CloudLesson[];
}

export async function getStudentsForLesson(className: string): Promise<CloudStudent[]> {
  if (!attendanceCloud) throw new Error('إعدادات المنصة السحابية غير مكتملة.');
  const { data, error } = await attendanceCloud
    .from('attendance_students')
    .select('id, display_name, class_name')
    .eq('class_name', className)
    .order('display_name');
  if (error) throw error;
  return (data || []) as CloudStudent[];
}

export async function getLessonSubmission(timetableId: string) {
  if (!attendanceCloud) throw new Error('إعدادات المنصة السحابية غير مكتملة.');
  const today = casablancaDate(new Date());
  const { data: session, error } = await attendanceCloud
    .from('attendance_sessions')
    .select('id, edit_deadline, status, submitted_at')
    .eq('timetable_id', timetableId)
    .eq('lesson_date', today)
    .maybeSingle();
  if (error) throw error;
  if (!session) return null;

  const { data: marks, error: marksError } = await attendanceCloud
    .from('attendance_marks')
    .select('student_id')
    .eq('session_id', session.id);
  if (marksError) throw marksError;
  return {
    ...session,
    absentStudentIds: (marks || []).map((mark) => mark.student_id as string),
  };
}

export async function submitLessonAttendance(timetableId: string, absentStudentIds: string[]) {
  if (!attendanceCloud) throw new Error('إعدادات المنصة السحابية غير مكتملة.');
  const { data, error } = await attendanceCloud.rpc('submit_attendance_for_lesson', {
    p_timetable_id: timetableId,
    p_student_ids: absentStudentIds,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function createTeacherInvite(displayName: string, teacherId: string) {
  if (!attendanceCloud) throw new Error('إعدادات المنصة السحابية غير مكتملة.');
  const { data, error } = await attendanceCloud.rpc('create_attendance_teacher_invite', {
    p_teacher_id: teacherId,
    p_display_name: displayName,
  });
  if (error) throw error;
  const invite = Array.isArray(data) ? data[0] : data;
  if (!invite) throw new Error('لم يُرجع الخادم بيانات التفعيل.');
  return invite as { teacher_id: string; username: string; activation_code: string };
}

export async function reissueTeacherInvite(teacherId: string) {
  if (!attendanceCloud) throw new Error('إعدادات المنصة السحابية غير مكتملة.');
  const { data, error } = await attendanceCloud.rpc('reissue_attendance_teacher_invite', {
    p_teacher_id: teacherId,
  });
  if (error) throw error;
  const invite = Array.isArray(data) ? data[0] : data;
  if (!invite) throw new Error('لم يُرجع الخادم رمز إعادة التفعيل.');
  return invite as { teacher_id: string; username: string; activation_code: string };
}

export async function getAttendanceTeacherDirectory(institutionId: string) {
  if (!attendanceCloud) throw new Error('إعدادات المنصة السحابية غير مكتملة.');
  const [directory, invites] = await Promise.all([
    attendanceCloud.from('attendance_teacher_directory')
      .select('teacher_id, display_name, username, activated_at')
      .eq('institution_id', institutionId).order('display_name'),
    attendanceCloud.from('attendance_teacher_invites')
      .select('teacher_id, claimed_at, expires_at, activation_code').eq('institution_id', institutionId),
  ]);
  if (directory.error) throw directory.error;
  if (invites.error) throw invites.error;
  return mergeAttendanceTeacherDirectory(directory.data || [], invites.data || []);
}
