/**
 * Provisional referral detection for the local attendance workspace.
 * Server-side multi-tenant authorization and synchronized referral cases
 * must replace this as the source of truth in production.
 */
export type ReferralAbsence = {
  sessionId: string;
  studentId: string;
  date: string;
  subject: string;
  startTime: string;
  endTime: string;
  justified: number | boolean;
  status: string;
};
export type ReferralSession = {
  id: string;
  date: string;
  section: string;
  startTime: string;
  endTime: string;
};
export type ReferralSummary = {
  history: ReferralAbsence[];
  outstanding: ReferralAbsence[];
  totalMinutes: number;
  outstandingMinutes: number;
  occurrences: number;
  immediatelyPreviousAbsence: boolean;
};
export const lessonMinutes = (start: string, end: string) => {
  const a = start.split(':').map(Number), b = end.split(':').map(Number);
  return Math.max(0, (b[0] * 60 + b[1]) - (a[0] * 60 + a[1]));
};
const chronology = (date: string, time: string) => date + 'T' + time;
export function summarizeReferral(
  studentId: string,
  returnDate: string,
  returnStartTime: string,
  section: string,
  absences: ReferralAbsence[],
  confirmedSessions: ReferralSession[]
): ReferralSummary {
  const cutoff = chronology(returnDate, returnStartTime);
  const earlierSessions = confirmedSessions
    .filter(s => s.section === section && chronology(s.date, s.startTime) < cutoff)
    .sort((a,b) => chronology(b.date,b.startTime).localeCompare(chronology(a.date,a.startTime)));
  const history = absences.filter(a => a.studentId === studentId && a.status === 'غائب' &&
    chronology(a.date,a.startTime) < cutoff && earlierSessions.some(s=>s.id === a.sessionId))
    .sort((a,b) => chronology(b.date,b.startTime).localeCompare(chronology(a.date,a.startTime)));
  const outstanding = history.filter(a => !a.justified);
  return {
    history, outstanding,
    totalMinutes: history.reduce((m,a) => m + lessonMinutes(a.startTime,a.endTime),0),
    outstandingMinutes: outstanding.reduce((m,a) => m + lessonMinutes(a.startTime,a.endTime),0),
    occurrences: history.length,
    immediatelyPreviousAbsence: earlierSessions.length > 0 && history.some(a => a.sessionId === earlierSessions[0].id)
  };
}
