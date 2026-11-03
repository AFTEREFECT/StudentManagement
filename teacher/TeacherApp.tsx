import { useMemo } from 'react';
import { AlertCircle, Check, Clock3, LogOut, RefreshCw, UserRound, Users } from 'lucide-react';
import { attendanceCloudConfigured } from '../src/utils/attendanceCloud';
import { useTeacherPwa } from './useTeacherPwa';
import TeacherStatistics from './TeacherStatistics';
import PwaInstall from './PwaInstall';

const weekdays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const formatTime = (value: string) => value.slice(0, 5);
const eventNames: Record<string, string> = { draft: 'مسودة محلية', 'superseded-draft': 'مسودة سابقة',
  server: 'نسخة أكد الخادم استلامها', institution: 'نسخة من أرشيف المؤسسة', receipt: 'تأكيد الاستلام',
  conflict: 'تعارض في التعديل', rejected: 'رفض الإرسال', 'user-chose-server': 'اختيرت النسخة المستلمة' };

export default function TeacherApp() {
  const { profile, data, year, years, chooseYear, selectedDate, setSelectedDate, entry, view, setView, online,
    loadingSession, loadingData, working, error, success, username, setUsername, password, setPassword,
    vaultSecret, setVaultSecret, transferSecret, setTransferSecret, activationMode, setActivationMode, activationCode, setActivationCode,
    newPassword, setNewPassword, lessons, selectedLessonId, setSelectedLessonId, selectedLesson, students, absentIds, setAbsentIds,
    submission, canEdit, dirty, clearMessages, refreshLessons, handleSignIn, handleActivation, handleSignOut, unlockLocal,
    saveAttendance, useServerVersion, restoreArchive } = useTeacherPwa();
  const groupedLessons = useMemo(() => weekdays.map((day, dayIndex) => ({ day,
    items: lessons.filter((lesson) => lesson.day_of_week === dayIndex) })).filter((group) => group.items.length), [lessons]);
  if (!attendanceCloudConfigured) {
    return (
      <main className="page-shell">
        <section className="panel message-panel" role="alert">
          <AlertCircle className="message-icon warning" />
          <h1>بوابة الأستاذ غير مهيأة</h1>
          <p>لم تُضمّن إعدادات الاتصال الآمنة بقاعدة البيانات في نسخة النشر. أعد البناء بإعدادات Supabase العامة الصحيحة.</p>
        </section>
      </main>
    );
  }

  if (loadingSession) {
    return <main className="page-shell"><div className="panel loading-panel">جارٍ التحقق من جلسة الدخول...</div></main>;
  }

  if (!profile) {
    return (
      <main className="page-shell auth-shell">
        <section className="panel auth-panel">
          <div className="brand-mark"><Users aria-hidden="true" /></div>
          <p className="eyebrow">بوابة الأستاذ</p>
          <h1>الغياب والأرشيف الشخصي</h1>
          <p className="subheading">واجهة مبسطة وآمنة لتسجيل غياب التلاميذ من الهاتف.</p>
          {error && <p className="notice error-notice" role="alert">{error}</p>}
          {success && <p className="notice success-notice" role="status">{success}</p>}
          {activationMode ? (
            <form onSubmit={handleActivation} className="form-stack">
              <h2>تفعيل حساب الأستاذ</h2>
              <label>
                اسم المستخدم
                <input required value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="prof-1234a" />
              </label>
              <label>
                رمز التفعيل (6 أرقام)
                <input required value={activationCode} onChange={(event) => setActivationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} dir="ltr" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" />
              </label>
              <label>
                الرمز السري الجديد (4 أرقام على الأقل)
                <input required type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value.replace(/\D/g, ''))} autoComplete="new-password" inputMode="numeric" pattern="[0-9]{4,}" />
              </label>
              <button className="primary-button" disabled={working}>{working ? 'جارٍ التفعيل...' : 'تفعيل الحساب'}</button>
              <button className="text-button" type="button" onClick={() => { setActivationMode(false); clearMessages(); }}>العودة لتسجيل الدخول</button>
            </form>
          ) : (
            <form onSubmit={handleSignIn} className="form-stack">
              <label>
                اسم المستخدم
                <input required value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
              </label>
              <label>
                الرمز السري
                <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" inputMode="numeric" />
              </label>
              <label>عبارة فتح الأرشيف المحلي (8 أحرف على الأقل)
                <input required type="password" minLength={8} value={vaultSecret} onChange={(event) => setVaultSecret(event.target.value)} autoComplete="off" />
              </label>
              <p className="privacy-note">اختر عبارة محلية واحفظها لديك. لا نُخزنها ولا نرسلها للخادم. استخدم العبارة نفسها لفتح أرشيفك بعد إعادة تشغيل التطبيق.</p>
              <button className="primary-button" disabled={working}>{working ? 'جارٍ الدخول...' : 'تسجيل الدخول وفتح الأرشيف'}</button>
              <button className="secondary-button" type="button" disabled={working} onClick={() => void unlockLocal()}>فتح الأرشيف المحلي دون اتصال</button>
              <button className="text-button" type="button" onClick={() => { setActivationMode(true); clearMessages(); }}>تفعيل حساب برمز الإدارة</button>
            </form>
          )}
          <p className="privacy-note">يعرض الحساب بياناته المصرح بها فقط. عند تغيير رمز الدخول، استخدم عبارة فتح الأرشيف المحلية السابقة. عند فقدان الهاتف اطلب ملف الاستعادة من المؤسسة.</p><PwaInstall />
        </section>
      </main>
    );
  }

  return (
    <main className="teacher-shell">
      <div className="teacher-content">
        <header className="teacher-header">
          <div className="teacher-identity">
            <div className="identity-icon"><UserRound aria-hidden="true" /></div>
            <div>
              <p className="eyebrow">بوابة تسجيل الغياب</p>
              <h1>{profile.display_name}</h1>
            </div>
          </div>
          <button className="icon-button" type="button" onClick={handleSignOut} disabled={working} aria-label="تسجيل الخروج" title="تسجيل الخروج">
            <LogOut aria-hidden="true" />
          </button>
        </header>

        {error && <p className="notice error-notice" role="alert">{error}</p>}
        {success && <p className="notice success-notice" role="status">{success}</p>}

        <PwaInstall />
        <section className="panel pwa-controls">
          <span role="status">{online ? 'متصل بالشبكة' : 'دون اتصال — الأرشيف متاح'}</span>
          <label>السنة الدراسية<select value={year} onChange={(event) => void chooseYear(event.target.value)}>{years.map((item) => <option key={item}>{item}</option>)}</select></label>
          <button className="secondary-button" disabled={!online || loadingData || working} onClick={() => void refreshLessons()}>تحديث البيانات وإرسال المسودات</button>
          <button className="secondary-button" aria-pressed={view === 'attendance'} onClick={() => setView('attendance')}>مسك الغياب</button>
          <button className="secondary-button" aria-pressed={view === 'stats'} onClick={() => setView('stats')}>إحصائياتي وسجل السنة</button>
        </section>
        <p className="privacy-note">قاعدة المؤسسة المحلية هي المصدر الرسمي. تبقى المسودة محلية حتى يؤكد الخادم استلامها. لا يُحذف أرشيف السنة تلقائيًا.</p>
        <details className="panel restore-panel"><summary>استعادة سنة من أرشيف المؤسسة</summary>
          <p>على هاتف جديد: سجّل الدخول لتحديث مفاتيح المؤسسة، ثم اختر ملفك الموقّع الخاص بحسابك. لا تعتمد الاستعادة على بقاء الغياب في السحابة.</p>
          <label>رمز تسليم الملف من المؤسسة<input type="password" autoComplete="off" value={transferSecret} onChange={(event) => setTransferSecret(event.target.value)} /></label>
          <label>ملف أرشيف الأستاذ<input type="file" accept=".json,application/json" disabled={working || !data} onChange={(event) => { const file = event.target.files?.[0]; if (file) void restoreArchive(file); event.target.value = ''; }} /></label>
        </details>
        {view === 'stats' && data && <TeacherStatistics data={data} onOpen={(id, date) => { setSelectedLessonId(id); setSelectedDate(date); setView('attendance'); }} />}
        {loadingData && <p className="notice loading-notice"><RefreshCw className="spin" aria-hidden="true" /> جارٍ تحميل البيانات...</p>}
        {view === 'attendance' && (!loadingData && lessons.length === 0 && !selectedLesson ? (
          <section className="panel empty-panel">
            <Clock3 className="empty-icon" aria-hidden="true" />
            <h2>لم يُنشر جدول حصصك بعد</h2>
            <p>تواصل مع الإدارة للتأكد من ربط حسابك بالأستاذ الصحيح ونشر استعمال الزمن.</p>
            <button type="button" className="secondary-button" onClick={() => void refreshLessons()} disabled={loadingData}>إعادة المحاولة</button>
          </section>
        ) : (lessons.length > 0 || selectedLesson) && (
          <>
            <section className="lesson-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">جدولك الأسبوعي</p>
                  <h2>اختر الحصة</h2>
                </div>
                <span className="count-badge">{lessons.length} حصة</span>
              </div>
              {groupedLessons.map((group) => (
                <div className="day-group" key={group.day}>
                  <h3>{group.day}</h3>
                  <div className="lesson-list">
                    {group.items.map((lesson) => (
                      <button
                        type="button"
                        className={`lesson-card${selectedLessonId === lesson.id ? ' selected' : ''}`}
                        key={lesson.id}
                        aria-pressed={selectedLessonId === lesson.id}
                        onClick={() => setSelectedLessonId(lesson.id)}
                      >
                        <span className="lesson-title">{lesson.class_name} · {lesson.subject_name || lesson.subject_code}</span>
                        <span className="lesson-meta" dir="ltr">{formatTime(lesson.start_time)}–{formatTime(lesson.end_time)}{lesson.room ? ` · ${lesson.room}` : ''}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            {selectedLesson && (
              <section className="panel attendance-panel">
                <div className="attendance-heading">
                  <div>
                    <p className="eyebrow">مسودة الحصة / التسجيل المستلم</p>
                    <label>تاريخ الحصة<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
                    <h2>{selectedLesson.class_name}</h2>
                    <p className="lesson-description">{selectedLesson.subject_name || selectedLesson.subject_code} · {formatTime(selectedLesson.start_time)}–{formatTime(selectedLesson.end_time)}</p>
                  </div>
                  <span className="count-badge">{students.length} تلميذ</span>
                </div>
                {submission && (
                  <p className={`submission-status${canEdit ? ' editable' : ''}`}>
                    {submission.status === 'confirmed' ? 'اعتمدت الإدارة هذا التسجيل.' : submission.status === 'cancelled' ? 'ألغت الإدارة هذا التسجيل.' : canEdit ? `أكد الخادم الاستلام ويمكنك طلب تصحيحه إلى ${new Date(submission.edit_deadline).toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' })}.` : 'انتهت مهلة تعديل التسجيل؛ تواصل مع الإدارة عند الحاجة.'}
                  </p>
                )}
                {dirty && <p className="notice draft-notice">هناك اختيارات لم تُحفظ بعد؛ اضغط حفظ المسودة قبل مغادرة الحصة.</p>}
                {entry?.draft && <div className="notice draft-notice" role="status">
                  <strong>{entry.draft.state === 'pending' ? 'مسودة محلية بانتظار تأكيد الخادم' : entry.draft.state === 'conflict' ? 'تعارض يحتاج اختيارك' : 'رفض الخادم المسودة؛ بقيت محفوظة محليًا'}</strong>
                  <p>{entry.draft.error}</p>
                  {entry.draft.state === 'conflict' && <>
                    <p>نسخة الخادم: {entry.confirmed?.absentStudentIds.map((id) => data?.students.find((student) => student.id === id)?.display_name || id).join('، ') || 'لا يوجد غياب/السجل مؤرشف'}.</p>
                    <p>مسودتك: {entry.draft.absentStudentIds.map((id) => data?.students.find((student) => student.id === id)?.display_name || id).join('، ') || 'الجميع حاضر'}.</p>
                    <button className="secondary-button" disabled={working} onClick={() => void useServerVersion()}>اعتماد النسخة المستلمة والاحتفاظ بالمسودة في التاريخ</button>
                    <p>للاحتفاظ باختيارك عدّل اللائحة ثم اضغط حفظ المسودة؛ ستنشأ عملية جديدة تستند إلى الإصدار المعروض.</p>
                  </>}
                </div>}
                <div className="student-list">
                  {students.map((student) => {
                    const absent = absentIds.has(student.id);
                    return (
                      <button
                        type="button"
                        className={`student-row${absent ? ' absent' : ''}`}
                        key={student.id}
                        aria-pressed={absent}
                        onClick={() => setAbsentIds((current) => {
                          const next = new Set(current);
                          if (next.has(student.id)) next.delete(student.id);
                          else next.add(student.id);
                          return next;
                        })}
                        disabled={(loadingData && !data) || working}
                      >
                        <span className="student-name">{student.display_name}</span>
                        <span className="attendance-choice">{absent ? <><Check aria-hidden="true" /> غائب</> : 'حاضر'}</span>
                      </button>
                    );
                  })}
                  {students.length === 0 && !loadingData && <p className="no-students">لا توجد لائحة تلاميذ منشورة لهذا القسم.</p>}
                </div>
                <details className="version-history"><summary>الإصدارات والأحداث المحفوظة ({entry?.history.length || 0})</summary>
                  {entry?.history.map((item, index) => <details key={index}><summary><time>{new Date(item.at).toLocaleString('ar-MA')}</time> · {eventNames[item.kind] || 'حدث محفوظ'} · عدد الغائبين: {item.record?.absentStudentIds.length ?? item.draft?.absentStudentIds.length ?? '—'}</summary>
                    <p>{(item.record?.absentStudentIds || item.draft?.absentStudentIds || []).map((id) => data?.students.find((student) => student.id === id)?.display_name || id).join('، ') || 'لا توجد أسماء غائبة في هذا الحدث'}</p>
                  </details>)}
                </details>
                <div className="submit-footer">
                  <span>عدد الغائبين: <strong>{absentIds.size}</strong></span>
                  <button type="button" className="primary-button submit-button" onClick={() => void saveAttendance()} disabled={working || (loadingData && !data) || students.length === 0}>
                    {working ? 'جارٍ الحفظ...' : 'حفظ المسودة وإرسالها عند الاتصال'}
                  </button>
                </div>
              </section>
            )}
          </>
        ))}
        <footer className="footer-note">إذا لم يظهر جدولك أو تلاميذك، يرجى التواصل مع الإدارة.</footer>
      </div>
    </main>
  );
}
