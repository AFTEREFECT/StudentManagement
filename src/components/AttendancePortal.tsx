import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Upload,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { dbManager } from '../utils/database';
import { getAttendanceErrorMessage } from '../utils/attendanceErrors';
import AttendanceMonthlyExport from './AttendanceMonthlyExport';
import AttendanceTeacherAccess from './AttendanceTeacherAccess';
import AttendanceTestPortal from './AttendanceTestPortal';
import { attendanceTestModeEnabled } from '../utils/attendanceTestConfig';
import AttendanceSyncStatus from './AttendanceSyncStatus';
import type { ReceivedAttendance } from '../utils/attendanceStartupSync';
import {
  attendanceCloud,
  attendanceCloudConfigured,
  changeTestAdminCredentials,
  attendanceSignIn,
  attendanceSignOut,
  AttendanceProfile,
  CloudLesson,
  CloudStudent,
  createTeacherInvite,
  reissueTeacherInvite,
  getAttendanceProfile,
  getAttendanceTeacherDirectory,
  getLessonSubmission,
  getStudentsForLesson,
  getTeacherTimetable,
  redeemAttendanceInvite,
  submitLessonAttendance,
} from '../utils/attendanceCloud';

interface TeacherImportRow {
  displayName: string;
  nationalId: string;
  cloudTeacherId: string;
  username?: string;
  activationCode?: string;
  reactivation?: boolean;
  activationExpired?: boolean;
  activated?: boolean;
  activatedAt?: string | null;
  error?: string;
}

interface LocalStudent {
  id: string;
  firstName?: string;
  lastName?: string;
  section?: string;
  status?: string;
}

interface LocalTimetableEntry {
  id: string;
  ppr?: string;
  room_code?: string;
  activity_id?: string;
  tags?: string;
  teacher_id?: string;
  time_slot?: string;
  start_time?: string;
  end_time?: string;
  day?: string;
  day_arabic?: string;
  class?: string;
  subject_code?: string;
  subject_arabic?: string;
  room_name?: string;
}

interface FetTimetableImportRow extends LocalTimetableEntry {
  sourceRow: number;
  teacherLinked: boolean;
}

interface ReviewRow {
  id: string;
  lesson_date: string;
  submitted_at: string;
  edit_deadline: string;
  status: AttendanceSubmission['status'];
  teacher_id: string;
  timetable_id: string;
  lesson?: Pick<CloudLesson, 'class_name' | 'subject_name' | 'start_time'>;
  teacherName: string;
  absentCount: number;
}

interface ReviewMarkRow {
  markId: string;
  studentId: string;
  studentName: string;
  justification: 'justified' | 'unjustified';
  note: string;
}

interface CloudTimetableRow {
  id: string;
  institution_id: string;
  teacher_id: string;
  class_name: string;
  subject_code: string;
  subject_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string;
  active: boolean;
}

interface AttendancePortalProps {
  onExit?: () => void;
  teacherOnly?: boolean;
}

interface TimeSlotDraft {
  slot: string;
  start: string;
  end: string;
}

interface AttendanceSubmission {
  id: string;
  edit_deadline: string;
  status: 'submitted' | 'confirmed' | 'cancelled';
  submitted_at: string;
  absentStudentIds: string[];
}

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-right text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100';

function localDayOfWeek(day: string, dayArabic: string): number | null {
  const value = `${day} ${dayArabic}`.toLowerCase();
  const days: Array<[RegExp, number]> = [
    [/الأحد|الاحد|sunday|dimanche/, 0],
    [/الاثنين|الإثنين|monday|lundi/, 1],
    [/الثلاثاء|tuesday|mardi/, 2],
    [/الأربعاء|الاربعاء|wednesday|mercredi/, 3],
    [/الخميس|thursday|jeudi/, 4],
    [/الجمعة|friday|vendredi/, 5],
    [/السبت|saturday|samedi/, 6],
  ];
  return days.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}

function weekdayName(day: number): string {
  return ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][day] || 'يوم غير معروف';
}

function normalizeFetHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]/g, '');
}

function normalizeTeacherNationalId(value: string): string {
  return value.replace(/\s+/g, '').toLocaleUpperCase();
}

function arabicDayName(day: string): string {
  const value = day.toLowerCase().split(/[_-]/)[0].trim();
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
  if (dayNames[value]) return dayNames[value];
  if (/الأحد|الاحد/.test(value)) return 'الأحد';
  if (/الاثنين|الإثنين/.test(value)) return 'الاثنين';
  if (/الثلاثاء/.test(value)) return 'الثلاثاء';
  if (/الأربعاء|الاربعاء/.test(value)) return 'الأربعاء';
  if (/الخميس/.test(value)) return 'الخميس';
  if (/الجمعة/.test(value)) return 'الجمعة';
  if (/السبت/.test(value)) return 'السبت';
  return '';
}

function fetTimeSlot(day: string, hour: string): string {
  const session = day.toLowerCase().split(/[_-]/)[1]?.trim();
  const sessionName = session === 'm' || session === 'morning'
    ? 'صباحا'
    : session === 's' || session === 'evening'
      ? 'مساءً'
      : '';
  return sessionName ? `${hour} - ${sessionName}` : hour;
}

function statusText(status: AttendanceSubmission['status']) {
  if (status === 'confirmed') return 'معتمد من الإدارة';
  if (status === 'cancelled') return 'ملغى من الإدارة';
  return 'مرسل بانتظار مراجعة الإدارة';
}

const CloudAttendancePortal: React.FC<AttendancePortalProps> = ({ onExit, teacherOnly = false }) => {
  const [profile, setProfile] = useState<AttendanceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [activationMode, setActivationMode] = useState(false);
  const [activationCode, setActivationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [testAdminEmail, setTestAdminEmail] = useState('afterefectss@gmail.com');
  const [testAdminNewPassword, setTestAdminNewPassword] = useState('');
  const [testAdminPasswordConfirmation, setTestAdminPasswordConfirmation] = useState('');
  const [lessons, setLessons] = useState<CloudLesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [students, setStudents] = useState<CloudStudent[]>([]);
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());
  const [submission, setSubmission] = useState<AttendanceSubmission | null>(null);
  const [teacherRows, setTeacherRows] = useState<TeacherImportRow[]>([]);
  const [fetImportRows, setFetImportRows] = useState<FetTimetableImportRow[]>([]);
  const [fetImportName, setFetImportName] = useState('');
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [correctionHours, setCorrectionHours] = useState(6);
  const [correctionFrom, setCorrectionFrom] = useState<'lesson_end' | 'submission'>('lesson_end');
  const [syncMessage, setSyncMessage] = useState('');
  const [timeSlotDrafts, setTimeSlotDrafts] = useState<TimeSlotDraft[]>([]);
  const [editingReviewId, setEditingReviewId] = useState('');
  const [reviewStudents, setReviewStudents] = useState<CloudStudent[]>([]);
  const [reviewAbsentIds, setReviewAbsentIds] = useState<Set<string>>(new Set());
  const [reviewMarks, setReviewMarks] = useState<ReviewMarkRow[]>([]);
  const [subjectMappings, setSubjectMappings] = useState<Record<string, string>>({});
  const [subjectCodeDraft, setSubjectCodeDraft] = useState('');
  const [subjectNameDraft, setSubjectNameDraft] = useState('');

  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) || null;
  const canTeacherEdit = Boolean(
    submission &&
    submission.status === 'submitted' &&
    Date.now() <= new Date(submission.edit_deadline).getTime()
  );

  const loadSignedInProfile = useCallback(async () => {
    const nextProfile = await getAttendanceProfile();
    if (teacherOnly && nextProfile?.role !== 'teacher') {
      await attendanceSignOut();
      setError('هذا الرابط مخصص لحسابات الأساتذة فقط.');
      return null;
    }
    return nextProfile;
  }, [teacherOnly]);

  useEffect(() => {
    if (profile?.role === 'admin' && profile.must_change_password && profile.email) {
      setTestAdminEmail(profile.email);
    }
  }, [profile]);

  useEffect(() => {
    if (profile?.role !== 'admin' || !attendanceCloud) return;
    let mounted = true;
    const loadTeacherDirectory = async () => {
      if (!attendanceCloud) return;
      let localRoster: Array<{ nationalId: string; displayName: string; username?: string }> = [];
      let localLinks: Record<string, string> = {};
      try {
        [localRoster, localLinks] = await Promise.all([
          dbManager.getAttendanceTeacherRoster(),
          dbManager.getAttendanceCloudLinks('teacher'),
        ]);
        localRoster = localRoster.map((teacher) => ({
          ...teacher,
          nationalId: normalizeTeacherNationalId(teacher.nationalId),
        }));
        localLinks = Object.fromEntries(Object.entries(localLinks).map(([nationalId, cloudId]) => [
          normalizeTeacherNationalId(nationalId),
          cloudId,
        ]));
        if (mounted) {
          setTeacherRows(localRoster.map((teacher) => ({
            ...teacher,
            cloudTeacherId: localLinks[teacher.nationalId] || crypto.randomUUID(),
          })));
        }
        const directoryRows = await getAttendanceTeacherDirectory(profile.institution_id);
        const localIdByCloudId = new Map(
          Object.entries(localLinks).map(([nationalId, cloudId]) => [cloudId, normalizeTeacherNationalId(nationalId)])
        );
        const directoryByName = new Map<string, typeof directoryRows>();
        directoryRows.forEach((row) => {
          const key = row.display_name.trim().toLocaleLowerCase();
          directoryByName.set(key, [...(directoryByName.get(key) || []), row]);
        });
        const localCountByName = new Map<string, number>();
        localRoster.forEach((row) => {
          const key = row.displayName.trim().toLocaleLowerCase();
          localCountByName.set(key, (localCountByName.get(key) || 0) + 1);
        });
        const claimedCloudIds = new Set<string>();
        const teacherByNationalId = new Map<string, TeacherImportRow>();
        for (const row of localRoster) {
          const nameKey = row.displayName.trim().toLocaleLowerCase();
          const linkedCloudId = localLinks[row.nationalId];
          const candidates = (directoryByName.get(nameKey) || [])
            .filter((candidate) => !claimedCloudIds.has(candidate.teacher_id))
            .sort((left, right) => {
              const activationOrder = Number(Boolean(right.activated_at)) - Number(Boolean(left.activated_at));
              if (activationOrder) return activationOrder;
              return Number(right.teacher_id === linkedCloudId) - Number(left.teacher_id === linkedCloudId);
            });
          const matched = directoryRows.find((candidate) => candidate.teacher_id === linkedCloudId && !claimedCloudIds.has(candidate.teacher_id)) || candidates[0];
          const cloudTeacherId = matched?.teacher_id || linkedCloudId || crypto.randomUUID();
          claimedCloudIds.add(cloudTeacherId);
          teacherByNationalId.set(row.nationalId, {
            ...row,
            cloudTeacherId,
            ...(matched?.username ? { username: matched.username } : {}),
            activated: Boolean(matched?.activated_at),
            reactivation: matched?.reactivation || false,
            activationExpired: matched?.activationExpired || false,
            activationCode: matched?.activationCode,
            activatedAt: matched?.activated_at || null,
          });
        }

        const teachersByCloudId = new Map<string, TeacherImportRow>();
        directoryRows.forEach((row) => {
          const nationalId = localIdByCloudId.get(row.teacher_id) || '';
          const localTeacher = nationalId ? teacherByNationalId.get(nationalId) : undefined;
          if (localTeacher) {
            if (localTeacher.cloudTeacherId !== row.teacher_id) return;
            teachersByCloudId.set(row.teacher_id, localTeacher);
            return;
          }
          const nameKey = row.display_name.trim().toLocaleLowerCase();
          const localNameCount = localCountByName.get(nameKey) || 0;
          const sameNameRows = directoryByName.get(nameKey) || [];
          if (localNameCount === 1 || (localNameCount === 0 && sameNameRows.length > 1)) {
            const canonical = sameNameRows.find((candidate) => candidate.activated_at) || sameNameRows[0];
            if (canonical.teacher_id !== row.teacher_id) return;
          }
          if (claimedCloudIds.has(row.teacher_id)) return;
          teachersByCloudId.set(row.teacher_id, {
            displayName: row.display_name,
            nationalId: '',
            cloudTeacherId: row.teacher_id,
            ...(row.username ? { username: row.username } : {}),
            activated: Boolean(row.activated_at),
            reactivation: row.reactivation,
            activationExpired: row.activationExpired,
            activationCode: row.activationCode,
            activatedAt: row.activated_at,
          });
        });
        teacherByNationalId.forEach((teacher) => teachersByCloudId.set(teacher.cloudTeacherId, teacher));
        const teachers = [...teachersByCloudId.values()];
        if (!mounted) return;
        setTeacherRows(teachers);
        await dbManager.saveAttendanceCloudLinks(
          'teacher',
          [...teacherByNationalId.values()].map((teacher) => ({
            localRef: teacher.nationalId,
            cloudId: teacher.cloudTeacherId,
          }))
        );
        await dbManager.saveAttendanceTeacherRoster(
          [...teacherByNationalId.values()].map(({ nationalId, displayName, username }) => ({
            nationalId,
            displayName,
            ...(username ? { username } : {}),
          }))
        );
        const rowsToSync = [...teacherByNationalId.values()].filter((teacher) => !teacher.activated);
        if (rowsToSync.length) {
          const { error: syncError } = await attendanceCloud
            .from('attendance_teacher_directory')
            .upsert(rowsToSync.map((teacher) => ({
              institution_id: profile.institution_id,
              teacher_id: teacher.cloudTeacherId,
              display_name: teacher.displayName,
              username: teacher.username || null,
            })), { onConflict: 'institution_id,teacher_id' });
          if (syncError) throw syncError;
        }
      } catch (rosterError) {
        if (mounted) {
          if (!localRoster.length) setError(getAttendanceErrorMessage(rosterError, 'تعذر تحميل قائمة الأساتذة المحفوظة.'));
          else setSuccess('عُرضت قائمة الأساتذة المحفوظة محليًا، لكن تعذرت مزامنتها مع السحابة.');
        }
      }
    };
    void loadTeacherDirectory();
    return () => { mounted = false; };
  }, [profile]);

  useEffect(() => {
    let mounted = true;
    if (!attendanceCloudConfigured || !attendanceCloud) {
      setLoading(false);
      return;
    }

    attendanceCloud.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);
      if (data.session) {
        try {
          setProfile(await loadSignedInProfile());
        } catch (profileError) {
          setError(getAttendanceErrorMessage(profileError, 'تعذر تحميل صلاحيات الحساب.'));
        }
      }
      setLoading(false);
    });

    const { data: listener } = attendanceCloud.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setProfile(null);
        return;
      }
      window.setTimeout(() => {
        loadSignedInProfile()
          .then((nextProfile) => {
            if (mounted) setProfile(nextProfile);
          })
          .catch((profileError: unknown) => {
            if (mounted) setError(getAttendanceErrorMessage(profileError, 'تعذر تحميل الحساب.'));
          });
      }, 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadSignedInProfile]);

  useEffect(() => {
    if (profile?.role !== 'teacher') return;
    setLoading(true);
    getTeacherTimetable()
      .then((items) => {
        setLessons(items);
        setSelectedLessonId(items[0]?.id || '');
      })
      .catch((loadError: unknown) => setError(getAttendanceErrorMessage(loadError, 'تعذر تحميل جدول حصصك.')))
      .finally(() => setLoading(false));
  }, [profile]);

  useEffect(() => {
    if (!selectedLesson || profile?.role !== 'teacher') {
      setStudents([]);
      setSubmission(null);
      setAbsentIds(new Set());
      return;
    }
    setLoading(true);
    Promise.all([
      getStudentsForLesson(selectedLesson.class_name),
      getLessonSubmission(selectedLesson.id),
    ])
      .then(([classStudents, saved]) => {
        setStudents(classStudents);
        setSubmission(saved as AttendanceSubmission | null);
        setAbsentIds(new Set(saved?.absentStudentIds || []));
      })
      .catch((loadError: unknown) => setError(getAttendanceErrorMessage(loadError, 'تعذر تحميل لائحة الحصة.')))
      .finally(() => setLoading(false));
  }, [selectedLessonId, profile, selectedLesson]);

  useEffect(() => {
    if (profile?.role !== 'admin' || !attendanceCloud) return;
    attendanceCloud
      .from('attendance_settings')
      .select('correction_window_hours, correction_window_from')
      .eq('institution_id', profile.institution_id)
      .maybeSingle()
      .then(({ data, error: settingsError }) => {
        if (settingsError) setError(settingsError.message);
        if (data) {
          setCorrectionHours(data.correction_window_hours);
          setCorrectionFrom(data.correction_window_from);
        }
      });
    loadReviewRows();
    dbManager.initialize()
      .then(async () => {
        const [rows, mappings] = await Promise.all([
          dbManager.getAllTimetable(),
          dbManager.getAttendanceSubjectMappings(),
        ]);
        setSubjectMappings(mappings);
        const slots = new Map<string, TimeSlotDraft>();
        (rows as LocalTimetableEntry[]).forEach((row) => {
          const slot = String(row.time_slot || '').trim();
          if (!slot) return;
          const previous = slots.get(slot);
          slots.set(slot, {
            slot,
            start: previous?.start || String(row.start_time || ''),
            end: previous?.end || String(row.end_time || ''),
          });
        });
        setTimeSlotDrafts([...slots.values()].sort((a, b) => a.slot.localeCompare(b.slot, 'ar')));
      })
      .catch((scheduleError: unknown) => {
        setError(getAttendanceErrorMessage(scheduleError, 'تعذر تحميل أوقات الحصص.'));
      });
  }, [profile]);

  const announceError = (message: string) => {
    setSuccess('');
    setError(message);
  };

  const runSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setWorking(true);
    setError('');
    setSuccess('');
    try {
      const nextProfile = await attendanceSignIn(username, password);
      if (!nextProfile) throw new Error('هذا الحساب غير مربوط بملف صلاحيات الغياب.');
      if (teacherOnly && nextProfile.role !== 'teacher') {
        await attendanceSignOut();
        throw new Error('هذا الرابط مخصص لحسابات الأساتذة فقط.');
      }
      setProfile(nextProfile);
      setPassword('');
    } catch (loginError) {
      announceError(getAttendanceErrorMessage(loginError, 'تعذر تسجيل الدخول.'));
    } finally {
      setWorking(false);
    }
  };

  const updateTestAdminPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (testAdminNewPassword.length < 12) {
      announceError('اختر كلمة مرور من 12 حرفًا على الأقل.');
      return;
    }
    if (testAdminNewPassword !== testAdminPasswordConfirmation) {
      announceError('تأكيد كلمة المرور غير مطابق.');
      return;
    }
    setWorking(true);
    setError('');
    setSuccess('');
    try {
      const email = await changeTestAdminCredentials(testAdminEmail, testAdminNewPassword);
      setUsername(email);
      setProfile((current) => current ? { ...current, must_change_password: false } : current);
      setTestAdminNewPassword('');
      setTestAdminPasswordConfirmation('');
      setSuccess(`تم حفظ بريد الدخول ${email} وتغيير كلمة المرور. يمكنك الآن استخدام بوابة الإدارة.`);
    } catch (passwordError) {
      announceError(getAttendanceErrorMessage(passwordError, 'تعذر تغيير كلمة المرور.'));
    } finally {
      setWorking(false);
    }
  };

  const activateAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setWorking(true);
    setError('');
    setSuccess('');
    try {
      const result = await redeemAttendanceInvite(username, activationCode, newPassword);
      setUsername(result.username);
      setPassword('');
      setSuccess('تم التفعيل وحفظ كلمة المرور الجديدة. سجّل الدخول بالكلمة التي اخترتها.');
      setActivationMode(false);
      setActivationCode('');
      setNewPassword('');
    } catch (activationError) {
      announceError(getAttendanceErrorMessage(activationError, 'تعذر تفعيل الحساب.'));
    } finally {
      setWorking(false);
    }
  };

  const signOut = async () => {
    try {
      await attendanceSignOut();
      setProfile(null);
      setLessons([]);
      setStudents([]);
      setSubmission(null);
    } catch (signOutError) {
      announceError(getAttendanceErrorMessage(signOutError, 'تعذر تسجيل الخروج.'));
    }
  };

  const submitAttendance = async () => {
    if (!selectedLesson) return;
    const absent = students.filter((student) => absentIds.has(student.id));
    if (!window.confirm(`إرسال غياب ${absent.length} تلميذ(ة) في ${selectedLesson.class_name}؟`)) return;
    setWorking(true);
    setError('');
    setSuccess('');
    try {
      const saved = await submitLessonAttendance(selectedLesson.id, [...absentIds]);
      setSubmission({
        id: saved.session_id,
        edit_deadline: saved.edit_deadline,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        absentStudentIds: [...absentIds],
      });
      setSuccess('تم إرسال تسجيل الغياب إلى الإدارة.');
    } catch (saveError) {
      announceError(getAttendanceErrorMessage(saveError, 'تعذر إرسال تسجيل الغياب.'));
    } finally {
      setWorking(false);
    }
  };

  async function loadReviewRows() {
    if (!attendanceCloud) return;
    if (window.desktopAttendance && profile) {
      const rows = await dbManager.getReceivedAttendance(profile.institution_id);
      setReviewRows(rows.map((row) => ({ ...row, absentCount: row.marks.length })));
      return;
    }
    const { data, error: reviewError } = await attendanceCloud
      .from('attendance_sessions')
      .select('id, lesson_date, submitted_at, edit_deadline, status, teacher_id, timetable_id')
      .order('submitted_at', { ascending: false })
      .limit(100);
    if (reviewError) {
      setError(reviewError.message);
      return;
    }
    const sessionRows = data || [];
    if (sessionRows.length === 0) {
      setReviewRows([]);
      return;
    }
    const lessonIds = [...new Set(sessionRows.map((row) => row.timetable_id))];
    const teacherIds = [...new Set(sessionRows.map((row) => row.teacher_id))];
    const [lessonResult, teacherResult] = await Promise.all([
      attendanceCloud.from('attendance_timetable').select('id, class_name, subject_name, start_time').in('id', lessonIds),
      attendanceCloud.from('attendance_profiles').select('user_id, display_name').in('user_id', teacherIds),
    ]);
    if (lessonResult.error) {
      setError(lessonResult.error.message);
      return;
    }
    if (teacherResult.error) {
      setError(teacherResult.error.message);
      return;
    }
    const lessonData = lessonResult.data;
    const teacherData = teacherResult.data;
    const lessonMap = new Map((lessonData || []).map((item) => [item.id, item]));
    const teacherMap = new Map((teacherData || []).map((item) => [item.user_id, item.display_name]));
    const sessionIds = sessionRows.map((row) => row.id);
    const { data: marks, error: marksError } = await attendanceCloud
      .from('attendance_marks')
      .select('session_id, student_id')
      .in('session_id', sessionIds);
    if (marksError) {
      setError(marksError.message);
      return;
    }
    const markCounts = new Map<string, number>();
    (marks || []).forEach((mark) => markCounts.set(mark.session_id, (markCounts.get(mark.session_id) || 0) + 1));
    setReviewRows(sessionRows.map((row) => ({
      ...row,
      lesson: lessonMap.get(row.timetable_id),
      teacherName: teacherMap.get(row.teacher_id) || 'أستاذ',
      absentCount: markCounts.get(row.id) || 0,
    })) as ReviewRow[]);
  }

  useEffect(() => {
    if (!window.desktopAttendance || profile?.role !== 'admin') return;
    const received = () => { void loadReviewRows().catch((loadError) => {
      setError(getAttendanceErrorMessage(loadError, 'تعذر تحميل الأرشيف المحلي.'));
    }); };
    window.addEventListener('attendance-received', received);
    return () => window.removeEventListener('attendance-received', received);
  }, [profile]);

  const saveTimetableTimes = async () => {
    setWorking(true);
    setError('');
    setSuccess('');
    try {
      const missing = timeSlotDrafts.find((slot) => !/^\d{2}:\d{2}$/.test(slot.start) || !/^\d{2}:\d{2}$/.test(slot.end) || slot.end <= slot.start);
      if (missing) throw new Error(`أدخل وقت بداية ونهاية صحيحين للحصة ${missing.slot}.`);
      await dbManager.initialize();
      const timetable = await dbManager.getAllTimetable();
      const slots = new Map(timeSlotDrafts.map((slot) => [slot.slot, slot]));
      await dbManager.updateTimetableTimes((timetable as LocalTimetableEntry[]).flatMap((lesson) => {
        const slot = slots.get(String(lesson.time_slot || '').trim());
        return slot ? [{ id: String(lesson.id), start_time: slot.start, end_time: slot.end }] : [];
      }));
      setSuccess('حُفظت أوقات الحصص محليًا، ويمكن الآن نشر استعمال الزمن.');
    } catch (timeError) {
      announceError(getAttendanceErrorMessage(timeError, 'تعذر حفظ أوقات الحصص.'));
    } finally {
      setWorking(false);
    }
  };

  const saveSubjectMapping = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await dbManager.saveAttendanceSubjectMapping(subjectCodeDraft, subjectNameDraft);
      const mappings = await dbManager.getAttendanceSubjectMappings();
      setSubjectMappings(mappings);
      setSubjectCodeDraft('');
      setSubjectNameDraft('');
      setSuccess(`تم حفظ ربط الرمز ${subjectCodeDraft.trim()} بالمادة.`);
    } catch (mappingError) {
      announceError(getAttendanceErrorMessage(mappingError, 'تعذر حفظ ربط المادة.'));
    }
  };

  const beginReviewCorrection = async (row: ReviewRow) => {
    if (!attendanceCloud) return;
    setWorking(true);
    setError('');
    try {
      if (window.desktopAttendance && profile) {
        const cached = (await dbManager.getReceivedAttendance(profile.institution_id)).find((item) => item.id === row.id);
        if (cached) {
          const [roster, links, localReviews] = await Promise.all([
            dbManager.getStudents(), dbManager.getAttendanceCloudLinks('student'),
            dbManager.getAttendanceLocalJustifications(cached.marks.map((mark) => mark.id)),
          ]);
          const classStudents = new Map<string, CloudStudent>();
          roster.filter((student) => student.section === cached.lesson.class_name && links[student.id])
            .forEach((student) => classStudents.set(links[student.id], { id: links[student.id],
              display_name: `${student.firstName || ''} ${student.lastName || ''}`.trim(), class_name: cached.lesson.class_name }));
          cached.marks.forEach((mark) => classStudents.set(mark.student_id, { id: mark.student_id,
            display_name: mark.display_name, class_name: cached.lesson.class_name }));
          setReviewStudents([...classStudents.values()]);
          setReviewAbsentIds(new Set(cached.marks.map((mark) => mark.student_id)));
          setReviewMarks(cached.marks.map((mark) => ({ markId: mark.id, studentId: mark.student_id,
            studentName: mark.display_name, justification: localReviews[mark.id]?.status || 'unjustified',
            note: localReviews[mark.id]?.note || '' })));
          setEditingReviewId(row.id);
          return;
        }
      }
      const { data: classStudents, error: studentsError } = await attendanceCloud
        .from('attendance_students')
        .select('id, display_name, class_name')
        .eq('class_name', row.lesson?.class_name || '')
        .order('display_name');
      if (studentsError) throw studentsError;
      const { data: marks, error: marksError } = await attendanceCloud
        .from('attendance_marks')
        .select('id, student_id')
        .eq('session_id', row.id);
      if (marksError) throw marksError;
      const studentsForClass = (classStudents || []) as CloudStudent[];
      const markRows = marks || [];
      const localReviews = await dbManager.getAttendanceLocalJustifications(markRows.map((mark) => mark.id));
      const studentNames = new Map(studentsForClass.map((student) => [student.id, student.display_name]));
      setReviewStudents(studentsForClass);
      setReviewAbsentIds(new Set(markRows.map((mark) => mark.student_id)));
      setReviewMarks(markRows.map((mark) => ({
        markId: mark.id,
        studentId: mark.student_id,
        studentName: studentNames.get(mark.student_id) || 'تلميذ غير معروف',
        justification: localReviews[mark.id]?.status || 'unjustified',
        note: localReviews[mark.id]?.note || '',
      })));
      setEditingReviewId(row.id);
    } catch (correctionError) {
      announceError(getAttendanceErrorMessage(correctionError, 'تعذر تحميل بيانات التصحيح.'));
    } finally {
      setWorking(false);
    }
  };

  const saveReviewCorrection = async () => {
    if (!attendanceCloud || !editingReviewId) return;
    setWorking(true);
    setError('');
    try {
      const archived = profile && window.desktopAttendance
        ? (await dbManager.getReceivedAttendance(profile.institution_id)).find((row) => row.id === editingReviewId) : undefined;
      if (archived) {
        const { data: remote, error: lookupError } = await attendanceCloud.from('attendance_sessions')
          .select('id').eq('id', editingReviewId).maybeSingle();
        if (lookupError) throw lookupError;
        let marks: ReceivedAttendance['marks'];
        if (remote) {
          const { error: correctionError } = await attendanceCloud.rpc('admin_correct_attendance', {
            p_session_id: editingReviewId, p_student_ids: [...reviewAbsentIds],
          });
          if (correctionError) throw correctionError;
          const result = await attendanceCloud.from('attendance_marks').select('id, student_id').eq('session_id', editingReviewId);
          if (result.error) throw result.error;
          marks = (result.data || []).map((mark) => ({ ...mark,
            display_name: reviewStudents.find((student) => student.id === mark.student_id)?.display_name || '' }));
        } else {
          marks = [...reviewAbsentIds].map((studentId) => ({
            id: archived.marks.find((mark) => mark.student_id === studentId)?.id || crypto.randomUUID(),
            student_id: studentId, display_name: reviewStudents.find((student) => student.id === studentId)?.display_name || '',
          }));
        }
        await dbManager.saveReceivedAttendance(archived.institution_id, [{ ...archived, marks }]);
        setEditingReviewId('');
        setReviewStudents([]);
        setReviewAbsentIds(new Set());
        await loadReviewRows();
        setSuccess('تم حفظ التصحيح في الأرشيف المحلي.');
        return;
      }
      const { error: correctionError } = await attendanceCloud.rpc('admin_correct_attendance', {
        p_session_id: editingReviewId,
        p_student_ids: [...reviewAbsentIds],
      });
      if (correctionError) throw correctionError;
      setEditingReviewId('');
      setReviewStudents([]);
      setReviewAbsentIds(new Set());
      await loadReviewRows();
      setSuccess('تم حفظ التصحيح وتسجيله في سجل التدقيق.');
    } catch (correctionError) {
      announceError(getAttendanceErrorMessage(correctionError, 'تعذر حفظ التصحيح.'));
    } finally {
      setWorking(false);
    }
  };

  const saveLocalJustifications = async () => {
    if (!profile) return;
    setWorking(true);
    setError('');
    try {
      for (const mark of reviewMarks) {
        await dbManager.saveAttendanceLocalJustification(
          mark.markId,
          mark.justification,
          mark.note,
          profile.display_name
        );
      }
      setSuccess('حُفظت قرارات التبرير محليًا فقط؛ لم تُرفع المبررات أو ملاحظاتها للسحابة.');
    } catch (justificationError) {
      announceError(getAttendanceErrorMessage(justificationError, 'تعذر حفظ قرارات التبرير محليًا.'));
    } finally {
      setWorking(false);
    }
  };

  const reviewSession = async (sessionId: string, status: 'confirmed' | 'cancelled') => {
    if (!attendanceCloud) return;
    setWorking(true);
    setError('');
    try {
      const archived = profile && window.desktopAttendance
        ? (await dbManager.getReceivedAttendance(profile.institution_id)).find((row) => row.id === sessionId) : undefined;
      if (archived) {
        const { data: remote, error: lookupError } = await attendanceCloud.from('attendance_sessions')
          .select('id').eq('id', sessionId).maybeSingle();
        if (lookupError) throw lookupError;
        if (remote) {
          const { error: updateError } = await attendanceCloud.rpc('admin_review_attendance', { p_session_id: sessionId, p_status: status });
          if (updateError) throw updateError;
        }
        await dbManager.saveReceivedAttendance(archived.institution_id, [{ ...archived, status }]);
        await loadReviewRows();
        return;
      }
      const { error: updateError } = await attendanceCloud.rpc('admin_review_attendance', {
        p_session_id: sessionId,
        p_status: status,
      });
      if (updateError) throw updateError;
      await loadReviewRows();
    } catch (reviewError) {
      announceError(getAttendanceErrorMessage(reviewError, 'تعذرت مراجعة التسجيل.'));
    } finally {
      setWorking(false);
    }
  };

  const importTeachers = async (file?: File) => {
    if (!file) return;
    setError('');
    setSuccess('');
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: false, cellText: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const mapped = rows.map((row) => {
        const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [
          key.trim().toLowerCase(),
          String(value ?? '').trim(),
        ]));
        const nameKey = Object.keys(normalized).find((key) => /اسم|name/.test(key));
        const idKey = Object.keys(normalized).find((key) => /بطاق|وطني|معرف|teacher.?id|cnie|cin/.test(key));
        return {
          displayName: nameKey ? normalized[nameKey] : '',
          nationalId: idKey ? normalizeTeacherNationalId(normalized[idKey]) : '',
        };
      }).filter((row) => row.displayName && row.nationalId);
      if (!mapped.length) throw new Error('لم أجد أسطرًا فيها اسم الأستاذ ورقم البطاقة الوطنية.');
      if (!attendanceCloud || !profile) throw new Error('يلزم اتصال الإدارة بالسحابة لمزامنة قائمة الأساتذة.');
      const [savedTeachers, savedTeacherLinks, directory] = await Promise.all([
        dbManager.getAttendanceTeacherRoster(),
        dbManager.getAttendanceCloudLinks('teacher'),
        getAttendanceTeacherDirectory(profile.institution_id),
      ]);
      const teacherLinks = Object.fromEntries(Object.entries(savedTeacherLinks).map(([nationalId, cloudId]) => [
        normalizeTeacherNationalId(nationalId),
        cloudId,
      ]));
      const savedById = new Map(savedTeachers.map((teacher) => [
        normalizeTeacherNationalId(teacher.nationalId),
        teacher,
      ]));
      const usedCloudIds = new Set<string>();
      const teachersById = new Map<string, TeacherImportRow>();
      mapped.forEach((teacher) => {
        const saved = savedById.get(teacher.nationalId);
        const linkedId = teacherLinks[teacher.nationalId];
        const directoryMatch = directory.find((row) =>
          (linkedId ? row.teacher_id === linkedId : !usedCloudIds.has(row.teacher_id)) &&
          row.display_name.trim().toLocaleLowerCase() === teacher.displayName.trim().toLocaleLowerCase()
        );
        const cloudTeacherId = linkedId || directoryMatch?.teacher_id || crypto.randomUUID();
        usedCloudIds.add(cloudTeacherId);
        teachersById.set(teacher.nationalId, {
          ...saved,
          ...teacher,
          cloudTeacherId,
          activated: Boolean(directoryMatch?.activated_at),
          reactivation: directoryMatch?.reactivation || false,
          activationExpired: directoryMatch?.activationExpired || false,
          activationCode: directoryMatch?.activationCode,
          activatedAt: directoryMatch?.activated_at || null,
          ...(saved?.username ? { username: saved.username } : {}),
          ...(directoryMatch?.username ? { username: directoryMatch.username } : {}),
        });
      });
      savedTeachers.forEach((teacher) => {
        const nationalId = normalizeTeacherNationalId(teacher.nationalId);
        if (teachersById.has(nationalId)) return;
        const cloudTeacherId = teacherLinks[nationalId] || crypto.randomUUID();
        const directoryMatch = directory.find((row) => row.teacher_id === cloudTeacherId);
        teachersById.set(nationalId, {
          ...teacher,
          nationalId,
          cloudTeacherId,
          activated: Boolean(directoryMatch?.activated_at),
          reactivation: directoryMatch?.reactivation || false,
          activationExpired: directoryMatch?.activationExpired || false,
          activatedAt: directoryMatch?.activated_at || null,
          ...(directoryMatch?.username ? { username: directoryMatch.username } : {}),
        });
      });
      const mergedTeachers = [...teachersById.values()];
      await dbManager.saveAttendanceTeacherRoster(mergedTeachers.map(({ nationalId, displayName, username }) => ({
        nationalId,
        displayName,
        ...(username ? { username } : {}),
      })));
      await dbManager.saveAttendanceCloudLinks('teacher', mergedTeachers.map((teacher) => ({
        localRef: teacher.nationalId,
        cloudId: teacher.cloudTeacherId,
      })));
      const { error: directorySyncError } = await attendanceCloud
        .from('attendance_teacher_directory')
        .upsert(mergedTeachers.map((teacher) => ({
          institution_id: profile.institution_id,
          teacher_id: teacher.cloudTeacherId,
          display_name: teacher.displayName,
          username: teacher.username || null,
        })), { onConflict: 'institution_id,teacher_id' });
      if (directorySyncError) throw directorySyncError;
      setTeacherRows(mergedTeachers);
      setSuccess(`تمت مزامنة ${mergedTeachers.length} أستاذًا. أسماء الأساتذة وحالة الدخول متاحة عبر المتصفحات، بينما تبقى أرقام البطاقات محفوظة محليًا فقط.`);
    } catch (importError) {
      announceError(getAttendanceErrorMessage(importError, 'تعذرت قراءة ملف الأساتذة.'));
    }
  };

  const importFetTimetable = async (file?: File) => {
    if (!file) return;
    setError('');
    setSuccess('');
    setSyncMessage('');
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), {
        type: 'array',
        raw: false,
        cellText: true,
        cellDates: false,
      });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('لم أجد ورقة بيانات في الملف.');
      const sourceRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
        raw: false,
      });
      if (!sourceRows.length) throw new Error('الورقة الأولى فارغة؛ اختر ملف FET الذي يحتوي على الأنشطة.');

      const firstRow = sourceRows[0];
      const headerKeys = Object.keys(firstRow);
      const column = (aliases: string[]) => {
        const normalizedAliases = aliases.map(normalizeFetHeader);
        return headerKeys.find((header) => normalizedAliases.includes(normalizeFetHeader(header)));
      };
      const columns = {
        className: column(['Students Sets', 'Students Set', 'القسم', 'الفوج']),
        subject: column(['Subject', 'المادة']),
        teacher: column(['Teachers', 'Teacher', 'الأستاذ', 'معرف الأستاذ']),
        day: column(['Day', 'اليوم']),
        hour: column(['Hour', 'الحصة', 'الفترة']),
        room: column(['Room', 'قاعة']),
        activityId: column(['Activity Id', 'Activity ID', 'معرف النشاط']),
        activityTags: column(['Activity Tags', 'Tags', 'العلامات']),
      };
      const missingColumns = [
        ['Students Sets', columns.className],
        ['Subject', columns.subject],
        ['Teachers', columns.teacher],
        ['Day', columns.day],
        ['Hour', columns.hour],
      ].filter(([, key]) => !key).map(([label]) => label);
      if (missingColumns.length) {
        throw new Error(`أعمدة FET المطلوبة غير موجودة: ${missingColumns.join('، ')}. المطلوب: Students Sets, Subject, Teachers, Day, Hour.`);
      }

      await dbManager.initialize();
      const savedTeacherLinks = await dbManager.getAttendanceCloudLinks('teacher');
      const teacherLinks = Object.fromEntries(Object.entries(savedTeacherLinks).map(([nationalId, cloudId]) => [
        normalizeTeacherNationalId(nationalId),
        cloudId,
      ]));
      const parsed = sourceRows.map((row, index): FetTimetableImportRow => {
        const value = (key?: string) => key ? String(row[key] ?? '').trim() : '';
        const day = value(columns.day);
        const hour = value(columns.hour);
        const teacherId = normalizeTeacherNationalId(value(columns.teacher));
        return {
          id: crypto.randomUUID(),
          sourceRow: index + 2,
          teacher_id: teacherId,
          ppr: '',
          subject_code: value(columns.subject),
          subject_arabic: '',
          class: value(columns.className),
          room_code: value(columns.room),
          room_name: value(columns.room),
          day,
          day_arabic: arabicDayName(day),
          time_slot: fetTimeSlot(day, hour),
          start_time: '',
          end_time: '',
          activity_id: value(columns.activityId),
          tags: value(columns.activityTags),
          teacherLinked: Boolean(teacherId && teacherLinks[teacherId]),
        };
      }).filter((row) => row.class || row.teacher_id || row.day || row.time_slot);

      if (!parsed.length) throw new Error('لم أجد صفوف حصص قابلة للقراءة.');
      const incomplete = parsed.filter((row) => !row.class || !row.teacher_id || !row.day || !row.time_slot);
      if (incomplete.length) {
        throw new Error(`يوجد ${incomplete.length} صفًا ناقصًا من بيانات أساسية. تحقق من قيم Students Sets وTeachers وDay وHour قبل الاستيراد.`);
      }
      setFetImportRows(parsed);
      setFetImportName(file.name);
      const unlinked = new Set(parsed.filter((row) => !row.teacherLinked).map((row) => row.teacher_id)).size;
      const slots = [...new Set(parsed.map((row) => row.time_slot || '').filter(Boolean))];
      setSuccess(`قُرئ ${parsed.length} نشاطًا من ${file.name}. رموز الأساتذة غير المربوطة: ${unlinked}، والفترات الزمنية: ${slots.length}. راجع المعاينة ثم استورد الجدول محليًا.`);
    } catch (importError) {
      setFetImportRows([]);
      setFetImportName('');
      announceError(getAttendanceErrorMessage(importError, 'تعذرت قراءة ملف FET.'));
    }
  };

  const saveFetTimetableImport = async () => {
    if (!fetImportRows.length) return;
    if (!window.confirm(`سيتم استبدال جدول الحصص المحلي الحالي بـ ${fetImportRows.length} حصة من الملف ${fetImportName}. هل تريد المتابعة؟`)) return;
    setWorking(true);
    setError('');
    setSuccess('');
    setSyncMessage('');
    try {
      await dbManager.initialize();
      await dbManager.replaceTimetable(fetImportRows.map((row) => ({
        teacher_name_arabic: '',
        teacher_name_french: '',
        teacher_id: row.teacher_id || '',
        ppr: '',
        subject_code: row.subject_code || '',
        subject_arabic: '',
        class: row.class || '',
        room_code: row.room_code || '',
        room_name: row.room_name || '',
        day: row.day || '',
        day_arabic: row.day_arabic || '',
        time_slot: row.time_slot || '',
        start_time: '',
        end_time: '',
        activity_id: row.activity_id || '',
        tags: row.tags || '',
      })));
      await dbManager.extractSubjectsFromTimetable();
      const times = new Map<string, TimeSlotDraft>();
      fetImportRows.forEach((row) => {
        const slot = row.time_slot || '';
        if (slot && !times.has(slot)) times.set(slot, { slot, start: '', end: '' });
      });
      setTimeSlotDrafts([...times.values()].sort((a, b) => a.slot.localeCompare(b.slot, 'ar')));
      setFetImportRows([]);
      setFetImportName('');
      setSuccess(`تم استبدال الجدول المحلي واستيراد ${fetImportRows.length} حصة. أتمم أوقات الفترات، ثم اربط الأستاذ ورموز المواد وانشر الجدول.`);
    } catch (importError) {
      announceError(getAttendanceErrorMessage(importError, 'تعذر حفظ جدول FET محليًا.'));
    } finally {
      setWorking(false);
    }
  };

  const issueInvite = async (index: number, reactivate = false) => {
    const teacher = teacherRows[index];
    if (!teacher) return;
    setWorking(true);
    setError('');
    try {
      const invite = reactivate
        ? await reissueTeacherInvite(teacher.cloudTeacherId)
        : await createTeacherInvite(teacher.displayName, teacher.cloudTeacherId);
      setTeacherRows((rows) => rows.map((row, rowIndex) =>
        rowIndex === index
          ? { ...row, username: invite.username, activationCode: invite.activation_code, activated: teacher.activated, reactivation: reactivate, activationExpired: false }
          : row
      ));
      if (teacher.nationalId) {
        await dbManager.saveAttendanceCloudLinks('teacher', [
          { localRef: teacher.nationalId, cloudId: invite.teacher_id },
        ]);
      }
      const updatedTeachers = teacherRows.map((row, rowIndex) =>
        rowIndex === index
          ? { ...row, username: invite.username, activationCode: invite.activation_code, activated: teacher.activated, reactivation: reactivate, activationExpired: false }
          : row
      );
      await dbManager.saveAttendanceTeacherRoster(updatedTeachers.filter((row) => row.nationalId).map((row) => ({
        nationalId: row.nationalId,
        displayName: row.displayName,
        username: row.username,
      })));
      setTeacherRows(updatedTeachers);
    } catch (inviteError) {
      announceError(getAttendanceErrorMessage(inviteError, 'تعذر إنشاء دعوة الأستاذ.'));
    } finally {
      setWorking(false);
    }
  };

  const publishStudents = async () => {
    if (!attendanceCloud) return;
    setWorking(true);
    setError('');
    setSyncMessage('');
    try {
      await dbManager.initialize();
      const localStudents = await dbManager.getStudents();
      const eligible = (localStudents as LocalStudent[]).filter((student) =>
        student.id &&
        student.section &&
        ['متمدرس', 'نشط'].includes(student.status || '') &&
        `${student.firstName || ''} ${student.lastName || ''}`.trim()
      );
      if (!eligible.length) throw new Error('لا توجد لائحة محلية قابلة للمزامنة.');
      const { data: previousStudents, error: readError } = await attendanceCloud
        .from('attendance_students')
        .select('id')
        .eq('institution_id', profile?.institution_id);
      if (readError) throw readError;
      const links = await dbManager.getAttendanceCloudLinks('student');
      const linkRows = eligible.map((student) => ({
        localRef: String(student.id),
        cloudId: links[String(student.id)] || crypto.randomUUID(),
      }));
      await dbManager.saveAttendanceCloudLinks('student', linkRows);
      const cloudRows = eligible.map((student, index) => ({
        id: linkRows[index].cloudId,
        institution_id: profile?.institution_id,
        class_name: String(student.section).trim(),
        display_name: `${String(student.firstName).trim()} ${String(student.lastName).trim()}`.trim(),
        active: true,
      }));
      for (let index = 0; index < cloudRows.length; index += 500) {
        const { error: upsertError } = await attendanceCloud
          .from('attendance_students')
          .upsert(cloudRows.slice(index, index + 500), { onConflict: 'id' });
        if (upsertError) throw upsertError;
      }
      const activeIds = new Set(cloudRows.map((row) => row.id));
      for (const oldStudent of previousStudents || []) {
        if (activeIds.has(oldStudent.id)) continue;
        const { error: deactivateError } = await attendanceCloud
          .from('attendance_students')
          .update({ active: false })
          .eq('id', oldStudent.id);
        if (deactivateError) throw deactivateError;
      }
      setSyncMessage(`تمت مزامنة أسماء ${cloudRows.length} تلميذًا ومعرّفات عشوائية فقط. لم تُرفع أرقام مسار أو بيانات الأسر.`);
    } catch (syncError) {
      announceError(getAttendanceErrorMessage(syncError, 'تعذرت مزامنة لائحة التلاميذ.'));
    } finally {
      setWorking(false);
    }
  };

  const publishTimetable = async () => {
    if (!attendanceCloud || !profile) return;
    setWorking(true);
    setError('');
    setSyncMessage('');
    try {
      await dbManager.initialize();
      const [localLessons, teacherLinks, savedLinks, subjects] = await Promise.all([
        dbManager.getAllTimetable(),
        dbManager.getAttendanceCloudLinks('teacher'),
        dbManager.getAttendanceCloudLinks('schedule'),
        dbManager.getAttendanceSubjectMappings(),
      ]);
      const normalizedTeacherLinks = Object.fromEntries(Object.entries(teacherLinks).map(([nationalId, cloudId]) => [
        normalizeTeacherNationalId(nationalId),
        cloudId,
      ]));
      const newLinks: Array<{ localRef: string; cloudId: string }> = [];
      const rows: CloudTimetableRow[] = [];
      let missingTeacher = 0;
      let missingTime = 0;
      let missingDay = 0;
      for (const lesson of localLessons as LocalTimetableEntry[]) {
        const teacherId = normalizedTeacherLinks[normalizeTeacherNationalId(String(lesson.teacher_id || ''))];
        const day = localDayOfWeek(String(lesson.day || ''), String(lesson.day_arabic || ''));
        if (!teacherId) { missingTeacher++; continue; }
        if (day === null) { missingDay++; continue; }
        if (!lesson.start_time || !lesson.end_time) { missingTime++; continue; }
        const localRef = String(lesson.id);
        const cloudId = savedLinks[localRef] || crypto.randomUUID();
        newLinks.push({ localRef, cloudId });
        rows.push({
          id: cloudId,
          institution_id: profile.institution_id,
          teacher_id: teacherId,
          class_name: String(lesson.class || '').trim(),
          subject_code: String(lesson.subject_code || ''),
          subject_name: subjects[String(lesson.subject_code || '').trim()] || String(lesson.subject_arabic || ''),
          day_of_week: day,
          start_time: String(lesson.start_time).slice(0, 5),
          end_time: String(lesson.end_time).slice(0, 5),
          room: String(lesson.room_name || ''),
          active: true,
        });
      }
      if (!rows.length) {
        throw new Error(`لا توجد حصص جاهزة. الأستاذ غير مربوط: ${missingTeacher}، اليوم غير معروف: ${missingDay}، الوقت ناقص: ${missingTime}. أتمّ استيراد الأساتذة وأوقات الحصص أولًا.`);
      }
      // Persist IDs before cloud writes so retries update the same lessons.
      await dbManager.saveAttendanceCloudLinks('schedule', newLinks);
      const teacherIds = [...new Set(rows.map((row) => row.teacher_id))];
      const { data: activeTeachers, error: teacherReadError } = await attendanceCloud
        .from('attendance_profiles')
        .select('teacher_id')
        .in('teacher_id', teacherIds);
      if (teacherReadError) throw teacherReadError;
      const activatedTeacherIds = new Set((activeTeachers || []).map((teacher) => teacher.teacher_id));
      const notActivatedCount = teacherIds.filter((id) => !activatedTeacherIds.has(id)).length;
      const { data: existingLessons, error: readLessonsError } = await attendanceCloud
        .from('attendance_timetable')
        .select('id')
        .eq('institution_id', profile?.institution_id);
      if (readLessonsError) throw readLessonsError;
      for (let index = 0; index < rows.length; index += 500) {
        const { error: upsertError } = await attendanceCloud
          .from('attendance_timetable')
          .upsert(rows.slice(index, index + 500), { onConflict: 'id' });
        if (upsertError) throw upsertError;
      }
      const activeLessonIds = new Set(rows.map((row) => row.id));
      for (const oldLesson of existingLessons || []) {
        if (activeLessonIds.has(oldLesson.id)) continue;
        const { error: deactivateError } = await attendanceCloud
          .from('attendance_timetable')
          .update({ active: false })
          .eq('id', oldLesson.id);
        if (deactivateError) throw deactivateError;
      }
      setSyncMessage(`نُشرت ${rows.length} حصة. ${notActivatedCount ? `${notActivatedCount} أستاذ(ة) لم يفعّل(وا) الحساب بعد ولن يتمكنوا من الدخول حتى التفعيل. ` : ''}تم تجاوز ${missingTeacher} لغياب ربط الأستاذ، و${missingTime} لنقص الوقت، و${missingDay} لتعذر تحديد اليوم.`);
    } catch (syncError) {
      announceError(getAttendanceErrorMessage(syncError, 'تعذر نشر استعمال الزمن.'));
    } finally {
      setWorking(false);
    }
  };

  const saveCorrectionSettings = async () => {
    if (!attendanceCloud || !profile) return;
    setWorking(true);
    setError('');
    try {
      const { error: settingsError } = await attendanceCloud.from('attendance_settings').upsert({
        institution_id: profile.institution_id,
        correction_window_hours: correctionHours,
        correction_window_from: correctionFrom,
      }, { onConflict: 'institution_id' });
      if (settingsError) throw settingsError;
      setSuccess('تم حفظ مهلة التصحيح.');
    } catch (settingsError) {
      announceError(getAttendanceErrorMessage(settingsError, 'تعذر حفظ الإعدادات.'));
    } finally {
      setWorking(false);
    }
  };

  const displayMessage = useMemo(() => {
    if (error) return (
      <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <p>{error}</p>
      </div>
    );
    if (success || syncMessage) return (
      <div role="status" className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
        <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <p>{success || syncMessage}</p>
      </div>
    );
    return null;
  }, [error, success, syncMessage]);

  if (loading && !profile) {
    return <div className="p-10 text-center text-slate-600">جاري تحميل بوابة الغياب...</div>;
  }

  if (!attendanceCloudConfigured) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-100 p-6">
        <section className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
          <AlertCircle className="mb-4 h-8 w-8 text-amber-600" />
          <h1 className="mb-3 text-2xl font-bold text-slate-900">بوابة الغياب السحابية غير مهيأة</h1>
          <p className="text-slate-700">أضف VITE_SUPABASE_URL وVITE_SUPABASE_ANON_KEY إلى إعدادات البيئة، ثم طبّق ترحيل قاعدة البيانات ونشر وظيفة تفعيل الأستاذ.</p>
        </section>
      </main>
    );
  }

  if (profile?.role === 'admin' && profile.must_change_password) {
    return (
      <main dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
          <h1 className="mb-2 text-2xl font-bold text-slate-900">غيّر كلمة المرور التجريبية</h1>
          <p className="mb-5 text-sm leading-6 text-amber-800">أكمل بريد الدخول واختر كلمة مرور جديدة من 12 حرفًا على الأقل. إذا كان البريد مستخدمًا في Supabase لحساب آخر، اختر بريدًا مختلفًا لهذا الحساب.</p>
          {displayMessage}
          <form onSubmit={updateTestAdminPassword} className="space-y-4">
            <label className="block text-sm font-semibold">بريدك الإلكتروني للولوج إلى بوابة الإدارة
              <input required type="email" value={testAdminEmail} onChange={(event) => setTestAdminEmail(event.target.value)} className={`${inputClass} mt-1`} autoComplete="email" />
            </label>
            <label className="block text-sm font-semibold">كلمة المرور الجديدة
              <input required minLength={12} maxLength={72} type="password" value={testAdminNewPassword} onChange={(event) => setTestAdminNewPassword(event.target.value)} className={`${inputClass} mt-1`} autoComplete="new-password" />
            </label>
            <label className="block text-sm font-semibold">تأكيد كلمة المرور
              <input required minLength={12} maxLength={72} type="password" value={testAdminPasswordConfirmation} onChange={(event) => setTestAdminPasswordConfirmation(event.target.value)} className={`${inputClass} mt-1`} autoComplete="new-password" />
            </label>
            <button disabled={working} className="w-full rounded-xl bg-cyan-700 px-4 py-3 font-bold text-white disabled:opacity-50">{working ? 'جارٍ تغيير كلمة المرور...' : 'حفظ ومتابعة'}</button>
          </form>
        </section>
      </main>
    );
  }

  if (profile?.role === 'teacher') {
    const isLocked = submission && !canTeacherEdit;
    return (
      <main dir="rtl" className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-8">
        <div className="mx-auto max-w-4xl">
          <header className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-cyan-300">واجهة تسجيل الغياب</p>
              <h1 className="mt-1 text-2xl font-bold">{profile.display_name}</h1>
            </div>
            <button onClick={signOut} className="rounded-lg border border-slate-700 p-3 text-slate-300 hover:bg-slate-800" aria-label="تسجيل الخروج">
              <LogOut className="h-5 w-5" />
            </button>
          </header>
          {displayMessage}
          {!lessons.length ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
              <Clock className="mx-auto mb-3 h-8 w-8 text-cyan-300" />
              <h2 className="text-xl font-semibold">لم يُنشر جدول حصصك بعد</h2>
              <p className="mt-2 text-slate-400">تواصل مع الإدارة للتأكد من ربط حسابك بالأستاذ الصحيح ونشر استعمال الزمن.</p>
            </div>
          ) : (
            <>
              <section className="mb-5 rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <h2 className="mb-3 text-lg font-bold">جدول حصصك الأسبوعي كاملًا</h2>
                <p className="mb-4 text-sm text-slate-400">اختر الحصة التي تريد تسجيل الغياب لها. تظهر هنا جميع حصصك المنشورة مرتبة حسب اليوم والوقت.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                    const dayLessons = lessons.filter((lesson) => lesson.day_of_week === day);
                    if (!dayLessons.length) return null;
                    return (
                      <div key={day}>
                        <h3 className="mb-2 font-semibold text-cyan-300">{weekdayName(day)}</h3>
                        <div className="space-y-2">
                          {dayLessons.map((lesson) => (
                            <button
                              key={lesson.id}
                              type="button"
                              aria-pressed={selectedLessonId === lesson.id}
                              onClick={() => setSelectedLessonId(lesson.id)}
                              className={`w-full rounded-xl border p-3 text-right transition ${
                                selectedLessonId === lesson.id
                                  ? 'border-cyan-500 bg-cyan-950/60'
                                  : 'border-slate-700 bg-slate-950 hover:border-slate-500'
                              }`}
                            >
                              <span className="block font-semibold">{lesson.class_name} · {lesson.subject_name || lesson.subject_code}</span>
                              <span className="mt-1 block text-sm text-slate-400" dir="ltr">{lesson.start_time.slice(0, 5)}–{lesson.end_time.slice(0, 5)}{lesson.room ? ` · ${lesson.room}` : ''}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
              {selectedLesson && (
                <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                  <header className="border-b border-slate-800 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-bold">{selectedLesson.class_name}</h2>
                        <p className="mt-1 text-slate-300">{weekdayName(selectedLesson.day_of_week)} · {selectedLesson.subject_name || selectedLesson.subject_code} · {selectedLesson.start_time.slice(0, 5)}–{selectedLesson.end_time.slice(0, 5)} {selectedLesson.room && `· ${selectedLesson.room}`}</p>
                      </div>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-sm">{students.length} تلميذ(ة)</span>
                    </div>
                    {submission && (
                      <div className={`mt-4 rounded-lg p-3 text-sm ${canTeacherEdit ? 'bg-amber-950 text-amber-200' : 'bg-slate-800 text-slate-300'}`}>
                        {statusText(submission.status)}. {canTeacherEdit
                          ? `يمكنك التصحيح إلى ${new Date(submission.edit_deadline).toLocaleString('ar-MA')}.`
                          : 'انتهت مهلة الأستاذ؛ يرجى التواصل مع الإدارة لأي تصحيح.'}
                      </div>
                    )}
                  </header>
                  <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
                    {students.map((student) => {
                      const absent = absentIds.has(student.id);
                      return (
                        <button
                          type="button"
                          key={student.id}
                          disabled={Boolean(isLocked) || working}
                          onClick={() => setAbsentIds((current) => {
                            const next = new Set(current);
                            if (next.has(student.id)) next.delete(student.id);
                            else next.add(student.id);
                            return next;
                          })}
                          aria-pressed={absent}
                          className={`min-h-24 rounded-xl border p-4 text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            absent ? 'border-red-800 bg-red-950/60 text-red-100' : 'border-slate-800 bg-slate-950 hover:border-emerald-700'
                          }`}
                        >
                          {absent ? <UserX className="mx-auto mb-2 h-6 w-6 text-red-400" /> : <UserCheck className="mx-auto mb-2 h-6 w-6 text-emerald-400" />}
                          <span className="block font-semibold">{student.display_name}</span>
                          <span className={`mt-1 block text-sm ${absent ? 'text-red-300' : 'text-emerald-300'}`}>{absent ? 'غائب' : 'حاضر'}</span>
                        </button>
                      );
                    })}
                  </div>
                  {students.length === 0 && <p className="p-6 text-center text-slate-400">لم تُنشر لائحة هذا القسم بعد. يرجى مراجعة الإدارة.</p>}
                  <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 p-4">
                    <button type="button" disabled={Boolean(isLocked) || working || students.length === 0} onClick={() => setAbsentIds(new Set())} className="rounded-lg border border-slate-700 px-4 py-2 text-slate-200 disabled:opacity-50">
                      تعيين الجميع حاضرين
                    </button>
                    <button type="button" disabled={Boolean(isLocked) || working || students.length === 0} onClick={submitAttendance} className="rounded-lg bg-cyan-600 px-6 py-3 font-bold text-white hover:bg-cyan-500 disabled:opacity-50">
                      {working ? 'جارٍ الإرسال...' : submission ? 'إرسال التصحيح' : 'إرسال الغياب'} · {absentIds.size}
                    </button>
                  </footer>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    );
  }

  if (profile?.role === 'admin') {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-cyan-700">إدارة المؤسسة · بيانات الغياب</p>
              <h1 className="mt-1 text-2xl font-bold">إعداد ومراجعة الغياب</h1>
            </div>
            <button onClick={signOut} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2">
              <LogOut className="h-4 w-4" /> خروج
            </button>
          </header>
          {displayMessage}
          <AttendanceSyncStatus />
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><Users className="h-5 w-5 text-cyan-700" /> استيراد الأساتذة وإنشاء الدخول</h2>
              <p className="mb-4 text-sm text-slate-600">ارفع ملف الأساتذة مرة واحدة. تُحفظ الأسماء وحالة الدخول سحابيًا لتظهر في المتصفحات الأخرى، وتبقى أرقام البطاقات محلية للمطابقة مع عمود Teachers في جدول FET.</p>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-4 hover:border-cyan-500">
                <Upload className="h-5 w-5" />
                <span>اختيار ملف Excel / CSV</span>
                <input className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { void importTeachers(event.target.files?.[0]); event.target.value = ''; }} />
              </label>
              {teacherRows.length > 0 && (
                <div className="mt-4 max-h-80 space-y-2 overflow-auto">
                  {teacherRows.map((teacher, index) => (
                    <div key={`${teacher.nationalId}-${index}`} className="rounded-xl border border-slate-200 p-3">
                      <AttendanceTeacherAccess teacher={teacher} working={working} onIssue={(reactivate) => void issueInvite(index, reactivate)} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-5 w-5 text-cyan-700" /> نشر بيانات الحصص</h2>
              <p className="mb-4 text-sm text-slate-600">تُرسل أسماء التلاميذ والقسم ومعرّفات عشوائية، ثم استعمال الزمن اللازم لتقييد عرض كل أستاذ بحصصه اليوم. لا ترفع أرقام مسار.</p>
              <div className="mb-5 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                <h3 className="mb-2 font-bold">استيراد جدول الحصص من FET</h3>
                <p className="mb-3 text-sm text-slate-700">اختر ملف TIMETABLES بصيغة CSV أو Excel. يُربط كل أستاذ تلقائيًا بمطابقة رقم البطاقة المحلية مع قيمة عمود Teachers، ثم يُستورد الجدول للمراجعة وإكمال التوقيت.</p>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-cyan-300 bg-white p-3 hover:border-cyan-600">
                  <Upload className="h-5 w-5" />
                  <span>اختيار ملف TIMETABLES.csv / Excel</span>
                  <input className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { void importFetTimetable(event.target.files?.[0]); event.target.value = ''; }} />
                </label>
                {fetImportRows.length > 0 && (
                  <div className="mt-3 rounded-lg border border-cyan-200 bg-white p-3">
                    <p className="font-semibold">{fetImportName}: {fetImportRows.length} حصة</p>
                    <p className="my-1 text-sm text-slate-600">
                      الأساتذة غير المربوطين: {new Set(fetImportRows.filter((row) => !row.teacherLinked).map((row) => row.teacher_id)).size}
                      {' · '}الأيام غير المعروفة: {fetImportRows.filter((row) => localDayOfWeek(row.day || '', row.day_arabic || '') === null).length}
                      {' · '}الفترات: {new Set(fetImportRows.map((row) => row.time_slot)).size}
                    </p>
                    <div className="max-h-48 overflow-auto">
                      <table className="w-full text-right text-xs">
                        <thead><tr className="border-b"><th className="p-2">السطر</th><th className="p-2">القسم</th><th className="p-2">المادة</th><th className="p-2">الأستاذ / البطاقة</th><th className="p-2">اليوم</th><th className="p-2">الفترة</th></tr></thead>
                        <tbody>
                          {fetImportRows.slice(0, 8).map((row) => (
                            <tr key={`${row.activity_id || row.sourceRow}-${row.sourceRow}`} className="border-b last:border-0">
                              <td className="p-2">{row.sourceRow}</td>
                              <td className="p-2">{row.class}</td>
                              <td className="p-2">{row.subject_code}</td>
                              <td className={`p-2 ${row.teacherLinked ? '' : 'font-semibold text-amber-700'}`}>{row.teacher_id}</td>
                              <td className="p-2">{row.day}</td>
                              <td className="p-2">{row.time_slot}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {fetImportRows.length > 8 && <p className="p-2 text-slate-500">تُعرض أول 8 حصص فقط في المعاينة.</p>}
                    </div>
                    <p className="mt-2 text-xs text-amber-800">استيراد الملف سيستبدل جدول الحصص المحلي بعد تأكيدك، لكنه لا ينشر أي بيانات إلى السحابة. إذا كانت Hour مثل H1 أو H2، فسيُطلب إدخال وقت البداية والنهاية يدويًا.</p>
                    <button disabled={working} onClick={() => void saveFetTimetableImport()} className="mt-3 rounded-lg bg-cyan-700 px-4 py-2 font-semibold text-white disabled:opacity-50">استبدال الجدول المحلي بهذا الملف</button>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button disabled={working} onClick={publishStudents} className="rounded-xl bg-cyan-700 px-4 py-3 font-semibold text-white disabled:opacity-50">
                  مزامنة أسماء التلاميذ
                </button>
                <button disabled={working} onClick={publishTimetable} className="rounded-xl bg-slate-800 px-4 py-3 font-semibold text-white disabled:opacity-50">
                  نشر استعمال الزمن
                </button>
              </div>
              <div className="mt-5 border-t border-slate-200 pt-4">
                <h3 className="mb-2 font-bold">توقيت الحصص المستورد من FET</h3>
                <p className="mb-3 text-sm text-slate-600">إذا كان الملف يحتوي H1 / H2 دون أوقات، أدخل البداية والنهاية الفعليتين هنا. تُحفظ الأوقات محليًا ثم تُنشر مع الجدول.</p>
                <div className="max-h-64 space-y-2 overflow-auto">
                  {timeSlotDrafts.map((slot, index) => (
                    <div key={slot.slot} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2">
                      <span className="truncate text-sm font-medium">{slot.slot}</span>
                      <input aria-label={`بداية ${slot.slot}`} type="time" value={slot.start} onChange={(event) => setTimeSlotDrafts((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, start: event.target.value } : row))} className="rounded-lg border border-slate-300 p-2" />
                      <input aria-label={`نهاية ${slot.slot}`} type="time" value={slot.end} onChange={(event) => setTimeSlotDrafts((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, end: event.target.value } : row))} className="rounded-lg border border-slate-300 p-2" />
                    </div>
                  ))}
                  {!timeSlotDrafts.length && <p className="text-sm text-slate-500">استورد جدول الحصص محليًا أولًا لعرض توقيتاته هنا.</p>}
                </div>
                {timeSlotDrafts.length > 0 && <button disabled={working} onClick={saveTimetableTimes} className="mt-3 rounded-lg border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50">حفظ الأوقات محليًا</button>}
              </div>
              {syncMessage && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{syncMessage}</p>}
              <div className="mt-5 border-t border-slate-200 pt-4">
                <h3 className="mb-2 font-bold">ربط رموز المواد</h3>
                <p className="mb-3 text-sm text-slate-600">أدخل كل رمز كما ورد في الملف النصي. مثلًا يمكن ربط 0011 و11 باسم اللغة العربية، مع الحفاظ على الرمز دون تحويله إلى رقم.</p>
                <form onSubmit={(event) => void saveSubjectMapping(event)} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                  <input required value={subjectCodeDraft} onChange={(event) => setSubjectCodeDraft(event.target.value)} placeholder="رمز المادة" className="rounded-lg border border-slate-300 px-3 py-2" dir="ltr" />
                  <input required value={subjectNameDraft} onChange={(event) => setSubjectNameDraft(event.target.value)} placeholder="اسم المادة بالعربية" className="rounded-lg border border-slate-300 px-3 py-2" />
                  <button className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white">حفظ الرمز</button>
                </form>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(subjectMappings).map(([code, name]) => (
                    <span key={code} className="rounded-full bg-slate-100 px-3 py-1 text-sm">{code} · {name}</span>
                  ))}
                </div>
              </div>
              <div className="mt-6 border-t border-slate-200 pt-5">
                <h3 className="mb-3 font-bold">مهلة التصحيح للأستاذ</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">الساعات بعد نقطة البداية
                    <input type="number" min="0" max="168" value={correctionHours} onChange={(event) => setCorrectionHours(Number(event.target.value))} className={`${inputClass} mt-1`} />
                  </label>
                  <label className="text-sm">بداية المهلة
                    <select value={correctionFrom} onChange={(event) => setCorrectionFrom(event.target.value as 'lesson_end' | 'submission')} className={`${inputClass} mt-1`}>
                      <option value="lesson_end">نهاية الحصة (افتراضي)</option>
                      <option value="submission">وقت الإرسال</option>
                    </select>
                  </label>
                </div>
                <button disabled={working} onClick={saveCorrectionSettings} className="mt-3 rounded-lg border border-slate-300 px-4 py-2 font-semibold">حفظ المهلة</button>
              </div>
            </section>
          </div>

          <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-bold">مراجعة تسجيلات الأساتذة</h2><p className="text-sm text-slate-600">اعتماد التسجيل أو إلغاؤه. جميع الإجراءات تسجل في سجل تدقيق.</p></div>
              <button onClick={() => void loadReviewRows()} className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2"><RefreshCw className="h-4 w-4" /> تحديث</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-right text-sm">
                <thead className="bg-slate-100"><tr><th className="p-3">التاريخ</th><th className="p-3">الأستاذ</th><th className="p-3">القسم والحصة</th><th className="p-3">عدد الغائبين</th><th className="p-3">الحالة</th><th className="p-3">الإجراء</th></tr></thead>
                <tbody>
                  {reviewRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="p-3">{row.lesson_date}</td>
                      <td className="p-3">{row.teacherName}</td>
                      <td className="p-3">{row.lesson?.class_name || '—'} · {row.lesson?.subject_name || '—'}</td>
                      <td className="p-3">{row.absentCount}</td>
                      <td className="p-3">{statusText(row.status)}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button disabled={working || row.status === 'confirmed'} onClick={() => void reviewSession(row.id, 'confirmed')} className="rounded bg-emerald-100 px-3 py-1 text-emerald-800 disabled:opacity-50">تأكيد</button>
                          <button disabled={working || row.status === 'cancelled'} onClick={() => void reviewSession(row.id, 'cancelled')} className="rounded bg-red-100 px-3 py-1 text-red-800 disabled:opacity-50">إلغاء</button>
                          <button disabled={working} onClick={() => void beginReviewCorrection(row)} className="rounded bg-sky-100 px-3 py-1 text-sky-800 disabled:opacity-50">تصحيح</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!reviewRows.length && <tr><td colSpan={6} className="p-8 text-center text-slate-500">لا توجد تسجيلات بعد.</td></tr>}
                </tbody>
              </table>
            </div>
            {editingReviewId && (
              <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-bold text-sky-950">تصحيح الغائبين</h3>
                  <button onClick={() => setEditingReviewId('')} className="text-sm text-slate-600">إغلاق</button>
                </div>
                <div className="grid max-h-72 gap-2 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
                  {reviewStudents.map((student) => {
                    const absent = reviewAbsentIds.has(student.id);
                    return (
                      <button key={student.id} type="button" aria-pressed={absent} onClick={() => setReviewAbsentIds((current) => {
                        const next = new Set(current);
                        if (next.has(student.id)) next.delete(student.id);
                        else next.add(student.id);
                        return next;
                      })} className={`rounded-lg border p-3 text-right ${absent ? 'border-red-300 bg-red-50 text-red-900' : 'border-slate-200 bg-white'}`}>
                        {student.display_name} · {absent ? 'غائب' : 'حاضر'}
                      </button>
                    );
                  })}
                </div>
                <button disabled={working} onClick={() => void saveReviewCorrection()} className="mt-4 rounded-lg bg-sky-700 px-5 py-2 font-semibold text-white disabled:opacity-50">حفظ التصحيح الإداري</button>
                <div className="mt-5 border-t border-sky-200 pt-4">
                  <h4 className="font-bold text-sky-950">اعتماد مبررات الغياب (محلي فقط)</h4>
                  <p className="mb-3 text-sm text-slate-600">هذه القرارات والملاحظات لا تخرج من قاعدة بيانات المؤسسة؛ الغياب غير المعتمد يُحسب غير مبرر عند التصدير.</p>
                  <div className="space-y-2">
                    {reviewMarks.map((mark) => (
                      <div key={mark.markId} className="grid gap-2 rounded-lg bg-white p-3 sm:grid-cols-[1fr_180px_2fr] sm:items-center">
                        <span className="font-medium">{mark.studentName}</span>
                        <select value={mark.justification} onChange={(event) => setReviewMarks((rows) => rows.map((row) => row.markId === mark.markId ? { ...row, justification: event.target.value as ReviewMarkRow['justification'] } : row))} className="rounded-lg border border-slate-300 p-2">
                          <option value="unjustified">غير مبرر</option>
                          <option value="justified">مبرر معتمد</option>
                        </select>
                        <input value={mark.note} onChange={(event) => setReviewMarks((rows) => rows.map((row) => row.markId === mark.markId ? { ...row, note: event.target.value } : row))} placeholder="ملاحظة داخلية اختيارية (محلية)" className="rounded-lg border border-slate-300 p-2" />
                      </div>
                    ))}
                    {!reviewMarks.length && <p className="rounded-lg bg-white p-3 text-sm text-slate-500">لا توجد غيابات في هذا التسجيل لاعتماد مبرراتها.</p>}
                  </div>
                  {!!reviewMarks.length && <button disabled={working} onClick={() => void saveLocalJustifications()} className="mt-3 rounded-lg border border-sky-400 px-4 py-2 font-semibold text-sky-900 disabled:opacity-50">حفظ قرارات التبرير محليًا</button>}
                </div>
              </div>
            )}
          </section>
          <AttendanceMonthlyExport institutionId={profile.institution_id} />
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-800"><Users className="h-7 w-7" /></div>
          <h1 className="text-2xl font-bold text-slate-900">{teacherOnly ? 'تسجيل الغياب' : 'بوابة الغياب'}</h1>
          <p className="mt-2 text-sm text-slate-600">{teacherOnly ? 'واجهة الأساتذة لتسجيل الغياب من الهاتف أو الحاسوب.' : 'واجهة الأستاذ لتسجيل غياب حصص اليوم، وإدارة المؤسسة للإعداد والمراجعة.'}</p>
        </div>
        {displayMessage}
        {activationMode ? (
          <form onSubmit={activateAccount} className="space-y-4">
            <h2 className="font-bold">تفعيل حساب الأستاذ</h2>
            <label className="block text-sm font-semibold">اسم المستخدم
              <input required value={username} onChange={(event) => setUsername(event.target.value)} className={`${inputClass} mt-1`} autoComplete="username" placeholder="prof-1234a" />
            </label>
            <label className="block text-sm font-semibold">رمز التفعيل
              <input required value={activationCode} onChange={(event) => setActivationCode(event.target.value)} className={`${inputClass} mt-1`} dir="ltr" autoComplete="one-time-code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" title="أدخل رمز التفعيل المكوّن من 6 أرقام" />
            </label>
            <label className="block text-sm font-semibold">الرمز السري الجديد (4 أرقام على الأقل)
              <input required minLength={4} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={`${inputClass} mt-1`} autoComplete="new-password" inputMode="numeric" pattern="[0-9]{4,}" title="أدخل 4 أرقام على الأقل" />
            </label>
            <button disabled={working} className="w-full rounded-xl bg-cyan-700 px-4 py-3 font-bold text-white disabled:opacity-50">{working ? 'جارٍ التفعيل...' : 'تفعيل الحساب'}</button>
            <button type="button" onClick={() => setActivationMode(false)} className="w-full py-2 text-sm text-slate-600">العودة لتسجيل الدخول</button>
          </form>
        ) : (
          <form onSubmit={runSignIn} className="space-y-4">
            <label className="block text-sm font-semibold">{teacherOnly ? 'اسم المستخدم' : 'اسم المستخدم أو البريد الإداري'}
              <input required value={username} onChange={(event) => setUsername(event.target.value)} className={`${inputClass} mt-1`} autoComplete="username" />
            </label>
            <label className="block text-sm font-semibold">كلمة المرور
              <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={`${inputClass} mt-1`} autoComplete="current-password" inputMode={teacherOnly ? 'numeric' : undefined} />
            </label>
            <button disabled={working} className="w-full rounded-xl bg-cyan-700 px-4 py-3 font-bold text-white disabled:opacity-50">{working ? 'جارٍ الدخول...' : 'تسجيل الدخول'}</button>
            <button type="button" onClick={() => setActivationMode(true)} className="w-full py-2 text-sm font-semibold text-cyan-800">تفعيل حساب برمز الإدارة</button>
            {!teacherOnly && <p className="text-center text-xs leading-6 text-slate-500">هذا دخول البوابة السحابية. استعادة رمز المؤسسة تخص دخول الإدارة المحلية فقط.</p>}
            {!teacherOnly && <p className="text-center text-xs leading-5 text-slate-500">يلزم تسجيل الدخول السحابي مرة واحدة لعرض غيابات الأساتذة الحقيقية. سيتذكر هذا المتصفح جلسة الإدارة حتى تختار «خروج» أو تمسح بياناته؛ دخول الإدارة المحلية لا يستبدل حساب المنصة.</p>}
          </form>
        )}
        {!profile && !teacherOnly && onExit && <button type="button" onClick={onExit} className="mt-2 w-full py-2 text-sm text-slate-500">العودة إلى البرنامج الإداري</button>}
        <p className="mt-6 border-t border-slate-200 pt-4 text-xs leading-6 text-slate-500">الأستاذ يرى الجدول الأسبوعي والتلاميذ المرتبطين بحصصه فقط. رقم مسار والبيانات الرسمية لا تُرسل إلى السحابة.</p>
      </section>
    </main>
  );
};

export const AttendancePortal: React.FC<AttendancePortalProps> = ({ onExit, teacherOnly = false }) => {
  const [testing, setTesting] = useState(() => attendanceTestModeEnabled && new URLSearchParams(window.location.search).get('test') === '1');
  if (testing && attendanceTestModeEnabled) return <AttendanceTestPortal onExit={() => setTesting(false)} />;
  return <>
    {attendanceTestModeEnabled && <div dir="rtl" className="flex flex-wrap items-center justify-center gap-3 border-b border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <span>مرحلة التجريب · دخول محلي مباشر لواجهتَي الأستاذ والإدارة</span>
      <button type="button" onClick={() => setTesting(true)} className="rounded-lg bg-amber-800 px-4 py-2 font-bold text-white">دخول الاختبار دون كلمة مرور</button>
    </div>}
    <CloudAttendancePortal onExit={onExit} teacherOnly={teacherOnly} />
  </>;
};

export default AttendancePortal;
