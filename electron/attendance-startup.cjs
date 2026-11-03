const { randomUUID } = require('node:crypto');

// Lives in Electron's main process: renderer reloads, navigation and token refreshes
// must never create another automatic attempt in the same actual login session.
function createAttendanceStartupGate() {
  const attempts = new Map();
  return {
    claim(key) {
      if (typeof key !== 'string' || !key || key.length > 300) throw new Error('Invalid login session');
      if (attempts.has(key)) return { claimed: false, ...attempts.get(key) };
      const state = { token: randomUUID(), phase: 'syncing', error: '' };
      attempts.set(key, state);
      return { claimed: true, ...state };
    },
    finish(key, token, result) {
      const state = attempts.get(key);
      if (!state || state.token !== token || state.phase !== 'syncing') return;
      state.phase = result.phase === 'success' ? 'success' : 'failed';
      state.error = typeof result.error === 'string' ? result.error.slice(0, 500) : '';
    },
    interrupt() {
      for (const state of attempts.values()) {
        if (state.phase === 'syncing') {
          state.phase = 'failed';
          state.error = 'توقفت المزامنة بسبب إعادة تحميل الواجهة؛ ستُستأنف عند تشغيل التطبيق مجددًا.';
        }
      }
    },
  };
}

module.exports = { createAttendanceStartupGate };
