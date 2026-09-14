// Deliberately a plain localStorage flag, not per-account — this is a
// single-browser "show the tutorial once after onboarding" nudge, not a
// durable cross-device preference. Wrapped in try/catch since localStorage
// can throw (private browsing, disabled site data) and missing the tutorial
// once is harmless.
const KEY = 'onboarding:pendingTutorial';

export function setPendingTutorial() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // ignore — tutorial just won't auto-show, not worth surfacing an error for
  }
}

export function consumePendingTutorial(): boolean {
  try {
    const pending = localStorage.getItem(KEY) === '1';
    if (pending) localStorage.removeItem(KEY);
    return pending;
  } catch {
    return false;
  }
}
