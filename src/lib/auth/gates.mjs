// The "must do this first" steps a signed-in user can be held on, in ONE place so the screen and the API always agree.
// Order: 1) replace the temporary password  2) accept the Terms & Conditions (Business Owners)  3) use the app.
// (An owner added by PearlSolutions has both: they set their own password first, then read and accept the terms.)

/** 'password' | 'terms' | null  - the one step this user must finish now. */
export const requiredStep = ({ mustChangePassword, termsRequired }) => (mustChangePassword ? 'password' : termsRequired ? 'terms' : null);

/**
 * null = the request may go on. Otherwise [code, message] to refuse it with.
 * While a step is pending, ONLY the API that finishes that step is open:
 * allowPasswordChange = the change-password API, allowTerms = the accept-terms API.
 */
export function gateError(auth, { allowPasswordChange = false, allowTerms = false } = {}) {
  const step = requiredStep(auth);
  if (step === 'password' && !allowPasswordChange) return ['PASSWORD_CHANGE_REQUIRED', 'Please choose your own password first.'];
  if (step === 'terms' && !allowTerms) return ['TERMS_REQUIRED', 'Please accept the Terms & Conditions first.'];
  return null;
}
