export interface AttendanceTeacherDirectoryEntry {
  teacher_id: string;
  display_name: string;
  username: string | null;
  activated_at: string | null;
}
export interface AttendanceTeacherInvitationState {
  teacher_id: string;
  claimed_at: string | null;
  expires_at: string;
  activation_code: string | null;
}

export function mergeAttendanceTeacherDirectory(
  directory: AttendanceTeacherDirectoryEntry[],
  invitations: AttendanceTeacherInvitationState[],
  now = Date.now()
) {
  const invites = new Map(invitations.map((invite) => [invite.teacher_id, invite]));
  return directory.map((teacher) => {
    const invite = invites.get(teacher.teacher_id);
    // activated_at describes the existing account. A new, unredeemed code has priority
    // when displaying its current recovery workflow, including after a page reload.
    const reactivation = Boolean(teacher.activated_at && invite && (
      !invite.claimed_at || Date.parse(teacher.activated_at) < Date.parse(invite.claimed_at)
    ));
    return {
      ...teacher,
      reactivation,
      activationExpired: Boolean(invite && !invite.claimed_at && Date.parse(invite.expires_at) <= now),
      activationCode: invite && !invite.claimed_at && Date.parse(invite.expires_at) > now
        ? invite.activation_code || undefined
        : undefined,
    };
  });
}
