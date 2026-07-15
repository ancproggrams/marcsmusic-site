function intersects(a = [], b = []) {
  const left = Array.isArray(a) ? a : [];
  const right = new Set((Array.isArray(b) ? b : []).map(normalizeSignal).filter(Boolean));
  return left.map(normalizeSignal).filter(Boolean).some((item) => right.has(item));
}

export function calculateMatchScore({ release, contact, outlet, now = new Date() }) {
  let score = 0;
  const reasons = [];
  const add = (code, points, detail) => {
    score += points;
    reasons.push(Object.freeze({ code, points, detail }));
  };

  if (intersects(release.genres, outlet.genres)) add("main_genre_match", 25, "Release and outlet main genres overlap.");
  if (intersects(release.subGenres, outlet.subGenres)) add("subgenre_match", 15, "Release and outlet subgenres overlap.");
  if (intersects([...release.genres, ...release.subGenres], outlet.formatGenres)) add("format_match", 15, "Release fits the outlet format.");
  if (intersects(release.languages, [outlet.language, contact.preferredLanguage])) {
    add("language_match", 10, "Release language fits the contact or outlet.");
  }
  if (intersects(release.territories, [outlet.country])) add("territory_match", 10, "Outlet country is in the campaign territory.");
  if (outlet.submissionPolicy === "Explicit" || contact.contactPurpose === "Explicit Music Submission") {
    add("explicit_submission", 15, "Submission purpose is explicit.");
  }

  const validationAgeDays = daysSince(contact.lastValidatedAt, now);
  if (validationAgeDays !== undefined && validationAgeDays <= 365) add("recent_validation", 5, "Contact was validated within 12 months.");
  if (contact.previousPositiveReply) add("previous_positive_reply", 10, "Contact previously responded positively.");
  if (intersects(release.genres, contact.rejectedGenres)) add("previous_genre_rejection", -25, "Contact previously rejected this genre.");
  if (validationAgeDays === undefined || validationAgeDays > 365) add("stale_validation", -15, "Contact validation is missing or older than 12 months.");

  return Object.freeze({ score: Math.max(-100, Math.min(100, score)), reasons: Object.freeze(reasons) });
}

export function classifyMatch(score, { autoThreshold = 80, waitlistThreshold = 65 } = {}) {
  if (score >= autoThreshold) return "Eligible";
  if (score >= waitlistThreshold) return "Waitlist";
  return "Skipped";
}

function daysSince(value, now) {
  const timestamp = Date.parse(value ?? "");
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.floor((now.getTime() - timestamp) / 86_400_000);
}

function normalizeSignal(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized && !["unknown", "other"].includes(normalized) ? normalized : undefined;
}
