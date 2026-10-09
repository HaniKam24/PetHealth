// Same pattern as onboarding-tutorial-flag.ts: a plain localStorage flag,
// not per-account — there's only one real plan (Free) today, so nothing is
// actually enforced server-side yet. This just remembers "already saw the
// plan picker" so it doesn't interrupt every session. Wrapped in try/catch
// since localStorage can throw (private browsing, disabled site data) —
// worst case it shows the picker again, which is harmless.
const KEY = 'onboarding:planSelected';

export function hasSelectedPlan(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setPlanSelected() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // ignore — picker just shows again next time, not worth surfacing an error for
  }
}
