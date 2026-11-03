import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { attendanceCloud, attendanceSignIn, attendanceSignOut, redeemAttendanceInvite, type AttendanceProfile } from '../src/utils/attendanceCloud';
import { getAttendanceErrorMessage } from '../src/utils/attendanceErrors';
import { entryKey, localDate, newYear, saveDraft, schoolYear, type YearData } from './offline/model';
import { teacherVault } from './offline/vault';
import { refreshTeacherYear, sendPendingTeacherAttendance } from './offline/sync';
import { importInstitutionArchive } from './offline/archive';

export function useTeacherPwa() {
  const [profile, setProfile] = useState<AttendanceProfile | null>(null);
  const [data, setData] = useState<YearData | null>(null);
  const [year, setYear] = useState('');
  const [years, setYears] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(localDate());
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false), baseRevision = useRef('0'), selection = useRef('');
  const [view, setView] = useState<'attendance' | 'stats'>('attendance');
  const [working, setWorking] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [vaultSecret, setVaultSecret] = useState('');
  const [transferSecret, setTransferSecret] = useState('');
  const [activationMode, setActivationMode] = useState(false);
  const [activationCode, setActivationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const activeGeneration = useRef(0);
  const synchronizing = useRef<Promise<void> | null>(null);
  const currentYear = useRef('');
  currentYear.current = year;
  const clearMessages = () => { setError(''); setSuccess(''); };
  const fail = (e: unknown, fallback: string) => setError(getAttendanceErrorMessage(e, fallback));
  const lessons = data?.lessons || [];
  const entry = data?.entries[entryKey(selectedLessonId, selectedDate)];
  const selectedLesson = lessons.find((item) => item.id === selectedLessonId) || entry?.lesson || null;
  const students = useMemo(() => (data?.students || []).filter((student) => student.class_name === selectedLesson?.class_name
    && (selectedDate !== localDate() || data?.activeStudentIds.includes(student.id) || entry?.confirmed?.absentStudentIds.includes(student.id))),
    [data, selectedLesson, selectedDate, entry]);
  const submission = entry?.confirmed ? { ...entry.confirmed, edit_deadline: entry.confirmed.editDeadline } : null;
  const canEdit = Boolean(submission && submission.status === 'submitted' && Date.now() <= new Date(submission.editDeadline).getTime());

  const reloadLocal = useCallback(async (requestedYear?: string) => {
    const generation = activeGeneration.current;
    const available = await teacherVault.years();
    const nextYear = requestedYear || currentYear.current || available[0] || '';
    const cached = nextYear ? await teacherVault.read(nextYear) : null;
    if (generation !== activeGeneration.current) return;
    setYears(available); setYear(nextYear); setData(cached);
    if (cached) {
      setSelectedLessonId((old) => cached.lessons.some((lesson) => lesson.id === old) || Object.values(cached.entries).some((item) => item.lesson.id === old)
        ? old : cached.lessons[0]?.id || Object.values(cached.entries)[0]?.lesson.id || '');
      setSelectedDate((old) => schoolYear(old, cached.startMonth) === cached.year ? old
        : Object.values(cached.entries)[0]?.confirmed?.lessonDate || `${cached.year.slice(0, 4)}-${String(cached.startMonth).padStart(2, '0')}-01`);
    }
  }, []);

  const refreshLessons = useCallback(async () => {
    if (!teacherVault.profile || !navigator.onLine) return;
    if (synchronizing.current) return synchronizing.current;
    const generation = activeGeneration.current;
    const work = (async () => {
      setLoadingData(true);
      try {
        // Retry immutable operation IDs before pulling current state, so a lost
        // successful receipt does not become a spurious edit conflict.
        await sendPendingTeacherAttendance();
        const syncedYear = await refreshTeacherYear(currentYear.current || undefined);
        if (generation === activeGeneration.current) await reloadLocal(syncedYear);
        void navigator.storage?.persist?.().catch(() => {});
      } catch (e) { if (generation === activeGeneration.current) fail(e, 'تعذر الاتصال؛ بقي الأرشيف المحلي متاحًا.'); }
      finally { if (generation === activeGeneration.current) setLoadingData(false); }
    })().finally(() => { if (synchronizing.current === work) synchronizing.current = null; });
    synchronizing.current = work;
    return work;
  }, [reloadLocal]);

  const lock = useCallback(() => {
    activeGeneration.current++; teacherVault.lock(); setProfile(null); setData(null); setYears([]); setYear('');
    currentYear.current = ''; setAbsentIds(new Set()); setSelectedLessonId(''); setPassword(''); setVaultSecret('');
    setTransferSecret(''); setLoadingData(false); synchronizing.current = null;
    setError(''); setSuccess(''); dirtyRef.current = false; setDirty(false);
  }, []);

  useEffect(() => {
    const connected = () => { setOnline(true); if (teacherVault.profile) void refreshLessons(); };
    const disconnected = () => setOnline(false);
    const changed = (event: StorageEvent) => {
      // Supabase auth events handle account changes; local encryption keys never
      // leave this tab. Year documents use transactional CAS for other tabs.
      if (event.key === 'teacher-vault-lock') lock();
    };
    window.addEventListener('online', connected); window.addEventListener('offline', disconnected); window.addEventListener('storage', changed);
    window.addEventListener('pagehide', lock);
    const auth = attendanceCloud?.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (session && teacherVault.profile && session.user.id !== teacherVault.profile.user_id)) lock();
    });
    return () => { window.removeEventListener('online', connected); window.removeEventListener('offline', disconnected);
      window.removeEventListener('storage', changed); window.removeEventListener('pagehide', lock); auth?.data.subscription.unsubscribe(); };
  }, [refreshLessons, lock]);

  useEffect(() => {
    const next = `${year}:${selectedLessonId}:${selectedDate}`;
    if (next !== selection.current) { dirtyRef.current = false; setDirty(false); selection.current = next; }
    if (!dirtyRef.current) {
      baseRevision.current = entry?.confirmed?.revision || '0';
      setAbsentIds(new Set(entry?.draft?.absentStudentIds || entry?.confirmed?.absentStudentIds || []));
    }
  }, [entry, year, selectedLessonId, selectedDate]);
  useEffect(() => {
    const leaving = (event: BeforeUnloadEvent) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', leaving);
    return () => window.removeEventListener('beforeunload', leaving);
  }, []);

  async function openVault(verified?: AttendanceProfile) {
    if (vaultSecret.length < 8) throw new Error('أدخل عبارة فتح الأرشيف المحلي من 8 أحرف على الأقل؛ لا تُحفظ العبارة على الجهاز.');
    const identity = await teacherVault.unlock(username, vaultSecret, verified);
    setProfile(identity); setVaultSecret(''); setPassword('');
    await reloadLocal();
    if (navigator.onLine && verified) await refreshLessons();
  }
  async function handleSignIn(event: FormEvent) {
    event.preventDefault(); setWorking(true); clearMessages();
    try {
      if (vaultSecret.length < 8) throw new Error('أدخل عبارة فتح الأرشيف المحلي (8 أحرف على الأقل).');
      const identity = await attendanceSignIn(username, password);
      if (identity?.role !== 'teacher') { await attendanceSignOut(); throw new Error('هذا الرابط خاص بالأساتذة.'); }
      await openVault(identity);
    } catch (e) { fail(e, 'تعذر تسجيل الدخول.'); }
    finally { setWorking(false); setPassword(''); }
  }
  async function unlockLocal() {
    setWorking(true); clearMessages();
    try { await openVault(); setSuccess('فُتح الأرشيف المحلي. لا تتحول المسودات إلى تسجيلات مستلمة إلا بعد تأكيد الخادم.'); }
    catch (e) { fail(e, 'تعذر فتح الأرشيف المحلي.'); }
    finally { setWorking(false); }
  }
  async function handleActivation(event: FormEvent) {
    event.preventDefault(); setWorking(true); clearMessages();
    try {
      if (!/^\d{6}$/.test(activationCode) || !/^\d{4,}$/.test(newPassword)) throw new Error('أدخل رمز التفعيل من 6 أرقام والرمز السري من 4 أرقام على الأقل.');
      const result = await redeemAttendanceInvite(username, activationCode, newPassword);
      setUsername(result.username); setActivationCode(''); setNewPassword(''); setActivationMode(false); setSuccess('فُعّل الحساب؛ يمكنك تسجيل الدخول.');
    } catch (e) { fail(e, 'تعذر التفعيل.'); }
    finally { setWorking(false); }
  }
  async function handleSignOut() {
    if (dirtyRef.current && !window.confirm('هناك اختيارات لم تحفظ بعد. هل تريد الخروج دون حفظها؟')) return;
    lock(); clearMessages();
    localStorage.setItem('teacher-vault-lock', crypto.randomUUID());
    try { await attendanceCloud?.auth.signOut({ scope: 'local' }); } catch { /* Local vault is already locked. */ }
  }
  async function saveAttendance() {
    if (!profile || !selectedLesson || !data) return;
    setWorking(true); clearMessages();
    try {
      await teacherVault.mutate(year, () => newYear(profile, year), (local) => {
        saveDraft(local, selectedLesson, selectedDate, [...absentIds], entry?.draft?.operationId, dirtyRef.current ? baseRevision.current : undefined);
      });
      dirtyRef.current = false; setDirty(false);
      await reloadLocal(year);
      setSuccess('حُفظت مسودة محلية. ستُرسل عند الاتصال وفتح الأرشيف؛ ليست تسجيلًا رسميًا بعد.');
      if (navigator.onLine) { await sendPendingTeacherAttendance(); await reloadLocal(year); }
    } catch (e) { fail(e, 'تعذر الإرسال؛ تحقق من حالة المسودة المحلية.'); await reloadLocal(year).catch(() => {}); }
    finally { setWorking(false); }
  }
  async function chooseYear(next: string) {
    if (dirtyRef.current && !window.confirm('هناك اختيارات لم تحفظ بعد. هل تريد تغيير السنة دون حفظها؟')) return;
    clearMessages(); await reloadLocal(next).catch((e) => fail(e, 'تعذر فتح السنة.'));
  }
  async function useServerVersion() {
    if (!profile || !entry?.draft) return;
    const operation = entry.draft.operationId;
    try {
      await teacherVault.mutate(year, () => newYear(profile, year), (local) => {
        const item = local.entries[entryKey(selectedLessonId, selectedDate)];
        if (item?.draft?.operationId !== operation) throw new Error('تغيرت المسودة في نافذة أخرى.');
        item.history.push({ at: new Date().toISOString(), kind: 'user-chose-server', draft: item.draft }); delete item.draft;
      });
      await reloadLocal(year);
    } catch (e) { fail(e, 'تعذر اعتماد النسخة المستلمة.'); }
  }
  async function restoreArchive(file: File) {
    if (!data) return;
    setWorking(true); clearMessages();
    try {
      const restoredYear = await importInstitutionArchive(await file.text(), data.archiveKeys, teacherVault, transferSecret);
      setTransferSecret(''); await reloadLocal(restoredYear); setSuccess('استُعيد أرشيف السنة من النسخة الموقّعة للمؤسسة، مع الاحتفاظ بالمسودات وسجل الإصدارات.');
    } catch (e) { fail(e, 'تعذرت الاستعادة؛ لم تُحذف البيانات المحلية.'); }
    finally { setWorking(false); }
  }
  const canLeaveSelection = () => !dirtyRef.current || window.confirm('هناك اختيارات لم تحفظ بعد. هل تريد مغادرة الحصة دون حفظها؟');
  return { profile, data, year, years, chooseYear, selectedDate,
    setSelectedDate: (next: string) => { if (canLeaveSelection()) setSelectedDate(next); }, entry, view, setView, online,
    loadingSession: false, loadingData, working, error, success, username, setUsername, password, setPassword,
    vaultSecret, setVaultSecret, transferSecret, setTransferSecret, activationMode, setActivationMode, activationCode, setActivationCode,
    newPassword, setNewPassword, lessons, selectedLessonId,
    setSelectedLessonId: (next: string) => { if (canLeaveSelection()) setSelectedLessonId(next); }, selectedLesson, students, absentIds,
    setAbsentIds: (change: Set<string> | ((old: Set<string>) => Set<string>)) => { dirtyRef.current = true; setDirty(true); setAbsentIds(change); },
    submission, canEdit, dirty, clearMessages, refreshLessons, handleSignIn, handleActivation, handleSignOut, unlockLocal,
    saveAttendance, useServerVersion, restoreArchive };
}
