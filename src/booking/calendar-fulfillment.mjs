const RECONCILE_STATES = new Set(["put_started", "reconciling", "reconciling_required"]);

export function deterministicCalendarIdentity(bookingId, calendarUrl) {
  if (typeof bookingId !== "string" || !/^[A-Za-z0-9-]{1,80}$/.test(bookingId)) {
    throw new Error("CALENDAR_BOOKING_ID_INVALID");
  }
  const uid = `marcsmusic-${bookingId}@marcsmusic.nl`;
  return {
    uid,
    url: new URL(`${encodeURIComponent(uid)}.ics`, calendarUrl).toString()
  };
}

export function claimCalendarFulfillment(booking, identity, { token, now, leaseMs }) {
  const current = normalizeCalendarFulfillment(booking, identity, now);
  if (booking.status === "confirmed" || current.status === "confirmed") {
    return { kind: "confirmed", fulfillment: current };
  }
  if (booking.status === "manual_review" || current.status === "manual_review") {
    return { kind: "manual_review", fulfillment: current };
  }

  const nowMs = new Date(now).getTime();
  if (current.claimToken && Date.parse(current.leaseUntil || "") > nowMs) {
    return { kind: "busy", fulfillment: current };
  }

  const operation = RECONCILE_STATES.has(current.status) ? "reconcile" : "put";
  const version = current.version + 1;
  const fulfillment = {
    ...current,
    status: operation === "reconcile" ? "reconciling" : "claimed",
    version,
    attempt: operation === "put" ? current.attempt + 1 : current.attempt,
    claimToken: token,
    leaseUntil: new Date(nowMs + leaseMs).toISOString(),
    reasonCode: operation === "reconcile" ? "CALENDAR_RECONCILIATION_CLAIMED" : "CALENDAR_PUT_CLAIMED",
    updatedAt: new Date(nowMs).toISOString()
  };
  return { kind: "claimed", operation, token, version, fulfillment };
}

export function markCalendarPutStarted(current, claim, now, leaseMs = null) {
  if (!claimMatches(current, claim) || current.status === "confirmed") {
    return { applied: false, fulfillment: current };
  }
  return {
    applied: true,
    fulfillment: {
      ...current,
      status: "put_started",
      leaseUntil: Number.isSafeInteger(leaseMs)
        ? new Date(new Date(now).getTime() + leaseMs).toISOString()
        : current.leaseUntil,
      reasonCode: "CALENDAR_PUT_STARTED",
      updatedAt: new Date(now).toISOString()
    }
  };
}

export function markCalendarConfirmed(current, claim, now) {
  if (current.status === "confirmed") {
    return { applied: false, fulfillment: current };
  }
  if (!claimMatches(current, claim)) {
    return { applied: false, fulfillment: current };
  }
  return {
    applied: true,
    fulfillment: {
      ...current,
      status: "confirmed",
      claimToken: null,
      leaseUntil: null,
      reasonCode: "CALENDAR_EVENT_CONFIRMED",
      confirmedAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString()
    }
  };
}

export function markCalendarRetryable(current, claim, reasonCode, now, { reconcileFirst = false } = {}) {
  if (current.status === "confirmed" || !claimMatches(current, claim)) {
    return { applied: false, fulfillment: current };
  }
  return {
    applied: true,
    fulfillment: {
      ...current,
      status: reconcileFirst ? "reconciling_required" : "retryable",
      claimToken: null,
      leaseUntil: null,
      reasonCode,
      updatedAt: new Date(now).toISOString()
    }
  };
}

export function markCalendarManualReview(current, claim, reasonCode, now) {
  if (current.status === "confirmed" || !claimMatches(current, claim)) {
    return { applied: false, fulfillment: current };
  }
  return {
    applied: true,
    fulfillment: {
      ...current,
      status: "manual_review",
      claimToken: null,
      leaseUntil: null,
      reasonCode,
      updatedAt: new Date(now).toISOString()
    }
  };
}

export function verifyCalendarEventIdentity(ics, identity, bookingId) {
  const unfolded = String(ics || "").replace(/\r?\n[ \t]/g, "");
  const blocks = [...unfolded.matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)END:VEVENT/gi)];
  if (blocks.length !== 1) return false;
  const lines = blocks[0][1].split(/\r?\n/).filter(Boolean);
  const read = (name) => {
    const line = lines.find((entry) => {
      const separator = entry.indexOf(":");
      if (separator < 0) return false;
      return entry.slice(0, separator).split(";", 1)[0].toUpperCase() === name;
    });
    return line ? line.slice(line.indexOf(":") + 1).trim() : "";
  };
  return read("UID") === identity.uid && read("X-MARCSMUSIC-BOOKING-ID") === bookingId;
}

function normalizeCalendarFulfillment(booking, identity, now) {
  const current = booking.calendarFulfillment && typeof booking.calendarFulfillment === "object"
    ? booking.calendarFulfillment
    : {};
  const confirmed = booking.status === "confirmed" && booking.caldavEventUid === identity.uid;
  return {
    status: confirmed ? "confirmed" : String(current.status || "pending"),
    version: Number.isSafeInteger(current.version) && current.version >= 0 ? current.version : 0,
    attempt: Number.isSafeInteger(current.attempt) && current.attempt >= 0 ? current.attempt : 0,
    claimToken: typeof current.claimToken === "string" ? current.claimToken : null,
    leaseUntil: typeof current.leaseUntil === "string" ? current.leaseUntil : null,
    uid: identity.uid,
    url: identity.url,
    reasonCode: typeof current.reasonCode === "string" ? current.reasonCode : "CALENDAR_PENDING",
    confirmedAt: typeof current.confirmedAt === "string" ? current.confirmedAt : null,
    updatedAt: typeof current.updatedAt === "string" ? current.updatedAt : new Date(now).toISOString()
  };
}

function claimMatches(current, claim) {
  return current.claimToken === claim.token && current.version === claim.version;
}
