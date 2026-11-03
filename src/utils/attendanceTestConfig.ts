export const attendanceTestModeEnabled = import.meta.env.VITE_ATTENDANCE_TEST_MODE === 'true' || (
  import.meta.env.VITE_ATTENDANCE_TEST_MODE !== 'false' && (import.meta.env.DEV || window.location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname))
);
