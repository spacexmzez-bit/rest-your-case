/* All pages use the same lock and compare the saved snapshot before replacing it. */
const RYCCaseStore = (() => {
  const key = 'rest_your_case_state';
  let queue = Promise.resolve();
  function conflict() {
    const error = new Error('This trial changed in another tab. Reload to use the latest saved case.');
    error.name = 'CaseConflictError';
    return error;
  }
  const read = () => localStorage.getItem(key);
  function check(expected) { if (read() !== expected) throw conflict(); }
  function exclusive(action) {
    const run = () => typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('ryc-active-trial', action) : action();
    const result = queue.then(run);
    queue = result.catch(() => {});
    return result;
  }
  function write(expected, next, options = {}) {
    return exclusive(() => {
      check(expected);
      let previous;
      try { previous = JSON.parse(expected || 'null'); } catch (_) {}
      const revision = Number.isSafeInteger(previous?.revision) ? previous.revision + 1 : 1;
      const saved = { ...next, revision };
      const raw = JSON.stringify(saved);
      if (options.backup != null && !options.clearTrialExtras) localStorage.setItem('rest_your_case_recovery_backup', options.backup);
      // The one snapshot is authoritative; a failed write leaves the old trial intact.
      localStorage.setItem(key, raw);
      if (options.clearTrialExtras) {
        for (const item of ['terminal_draft', 'ryc_visual_room', 'rest_your_case_recovery_backup']) {
          try { localStorage.removeItem(item); } catch (_) {}
        }
        for (const item of ['trigger_engine_handshake', 'trigger_intake_start']) {
          try { sessionStorage.removeItem(item); } catch (_) {}
        }
      }
      for (const [channel, item] of [['court', 'rest_your_case_history'], ['partner', 'rest_your_case_partner_history'], ['diaz', 'rest_your_case_diaz_history']]) {
        try { localStorage.setItem(item, JSON.stringify(saved._histories?.[channel] || [])); } catch (_) {}
      }
      return { state: saved, raw };
    });
  }
  function id() {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID() : 'trial_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  }
  return { key, read, check, write, id, conflict };
})();
