export function normalizeAttendanceUsername(input: string): string {
  const value = input.normalize('NFKC').replace(/[\s\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').toLowerCase();
  const username = value.endsWith('@attendance.progtalamid.invalid')
    ? value.slice(0, -'@attendance.progtalamid.invalid'.length)
    : value;
  if (/^[a-f0-9]{12}$/.test(username)) return `teacher-${username}`;
  return username;
}

export function attendanceLoginEmail(input: string): string {
  const username = normalizeAttendanceUsername(input);
  return username.includes('@') ? username : `${username}@attendance.progtalamid.invalid`;
}
