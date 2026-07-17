/**
 * Email validation is a hard deny-by-default gate for outreach.
 *
 * Mailgun's non-valid outcomes remain distinct provider results for
 * operations, but none of them may authorize a send. Unknown or future
 * values also fail closed instead of becoming usable by accident.
 */
export const EMAIL_VALIDATION_NEVER_USE_STATUSES = Object.freeze([
  "Risky",
  "Invalid",
  "Unknown"
]);

export function emailValidationAllowsOutreach(status) {
  return status === "Valid";
}

export function emailValidationDisposition(status) {
  return emailValidationAllowsOutreach(status) ? "usable" : "never_use";
}
