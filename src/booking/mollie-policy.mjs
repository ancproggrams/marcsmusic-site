const PAYMENT_ID_PATTERN = /^tr_[A-Za-z0-9]{8,64}$/;
const PROFILE_ID_PATTERN = /^pfl_[A-Za-z0-9]{8,64}$/;
const PAYMENT_STATUSES = new Set([
  "open",
  "pending",
  "authorized",
  "paid",
  "canceled",
  "expired",
  "failed"
]);

export class MollieIntegrityError extends Error {
  constructor(code, statusCode = 409) {
    super(code);
    this.name = "MollieIntegrityError";
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = false;
  }
}

export function requireMolliePaymentId(value) {
  const paymentId = typeof value === "string" ? value.trim() : "";
  if (!PAYMENT_ID_PATTERN.test(paymentId)) {
    throw new MollieIntegrityError("MOLLIE_PAYMENT_ID_INVALID", 400);
  }
  return paymentId;
}

export function requireMollieProfileId(value) {
  const profileId = typeof value === "string" ? value.trim() : "";
  if (!PROFILE_ID_PATTERN.test(profileId)) {
    throw new MollieIntegrityError("MOLLIE_PROFILE_ID_INVALID", 503);
  }
  return profileId;
}

export function resolveMollieMode(apiKey, configuredMode = "") {
  const explicit = String(configuredMode || "").trim().toLowerCase();
  const keyMode = String(apiKey || "").startsWith("test_")
    ? "test"
    : String(apiKey || "").startsWith("live_")
      ? "live"
      : "";
  if (explicit) {
    if (!new Set(["test", "live"]).has(explicit)) {
      throw new MollieIntegrityError("MOLLIE_MODE_CONFIG_INVALID", 503);
    }
    if (keyMode && keyMode !== explicit) {
      throw new MollieIntegrityError("MOLLIE_MODE_KEY_MISMATCH", 503);
    }
    return explicit;
  }
  if (keyMode) return keyMode;
  throw new MollieIntegrityError("MOLLIE_MODE_CONFIG_MISSING", 503);
}

export function resolveBoundMolliePayment(db, rawPaymentId) {
  const paymentId = requireMolliePaymentId(rawPaymentId);
  const paymentEntries = db.payments.filter((entry) => entry?.molliePaymentId === paymentId);
  if (paymentEntries.length !== 1) {
    throw new MollieIntegrityError(
      paymentEntries.length === 0 ? "MOLLIE_PAYMENT_UNBOUND" : "MOLLIE_PAYMENT_BINDING_AMBIGUOUS"
    );
  }

  const paymentEntry = paymentEntries[0];
  const bookings = db.bookings.filter((entry) => entry?.molliePaymentId === paymentId);
  if (bookings.length !== 1) {
    throw new MollieIntegrityError(
      bookings.length === 0 ? "MOLLIE_BOOKING_BINDING_MISSING" : "MOLLIE_BOOKING_BINDING_AMBIGUOUS"
    );
  }
  if (bookings[0]?.id !== paymentEntry.bookingId) {
    throw new MollieIntegrityError("MOLLIE_BOOKING_BINDING_MISSING");
  }

  const booking = bookings[0];
  if (!Number.isSafeInteger(booking.priceCents) || booking.priceCents < 0) {
    throw new MollieIntegrityError("MOLLIE_BOOKING_AMOUNT_INVALID");
  }
  if (!Number.isSafeInteger(paymentEntry.amountCents) || paymentEntry.amountCents !== booking.priceCents) {
    throw new MollieIntegrityError("MOLLIE_STORED_AMOUNT_MISMATCH");
  }
  if (booking.currency !== "EUR" || paymentEntry.currency !== "EUR") {
    throw new MollieIntegrityError("MOLLIE_STORED_CURRENCY_MISMATCH");
  }
  requireMollieProfileId(paymentEntry.profileId);
  if (!new Set(["test", "live"]).has(paymentEntry.mode)) {
    throw new MollieIntegrityError("MOLLIE_STORED_MODE_INVALID");
  }

  return {
    paymentId,
    booking,
    paymentEntry,
    expected: {
      paymentId,
      bookingId: booking.id,
      amountCents: booking.priceCents,
      currency: "EUR",
      profileId: paymentEntry.profileId,
      mode: paymentEntry.mode
    }
  };
}

export function validateMolliePayment(payment, expected, configured = {}) {
  if (!payment || typeof payment !== "object" || Array.isArray(payment)) {
    throw new MollieIntegrityError("MOLLIE_RESPONSE_INVALID");
  }

  const id = requireMolliePaymentId(payment.id);
  if (id !== expected.paymentId) {
    throw new MollieIntegrityError("MOLLIE_PAYMENT_ID_MISMATCH");
  }
  if (typeof payment.metadata?.bookingId !== "string" || payment.metadata.bookingId !== expected.bookingId) {
    throw new MollieIntegrityError("MOLLIE_METADATA_BOOKING_MISMATCH");
  }

  const currency = payment.amount?.currency;
  if (currency !== "EUR" || currency !== expected.currency) {
    throw new MollieIntegrityError("MOLLIE_CURRENCY_MISMATCH");
  }
  const amountCents = mollieValueToCents(payment.amount?.value);
  if (amountCents !== expected.amountCents) {
    throw new MollieIntegrityError("MOLLIE_AMOUNT_MISMATCH");
  }

  const profileId = requireMollieProfileId(payment.profileId);
  if (profileId !== expected.profileId) {
    throw new MollieIntegrityError("MOLLIE_PROFILE_MISMATCH");
  }
  if (configured.profileId && profileId !== requireMollieProfileId(configured.profileId)) {
    throw new MollieIntegrityError("MOLLIE_CONFIGURED_PROFILE_MISMATCH");
  }

  const mode = String(payment.mode || "").trim().toLowerCase();
  if (mode !== expected.mode || (configured.mode && mode !== configured.mode)) {
    throw new MollieIntegrityError("MOLLIE_MODE_MISMATCH");
  }

  const status = String(payment.status || "").trim().toLowerCase();
  if (!PAYMENT_STATUSES.has(status)) {
    throw new MollieIntegrityError("MOLLIE_STATUS_INVALID");
  }

  return { id, bookingId: expected.bookingId, amountCents, currency, profileId, mode, status };
}

export function validateCreatedMolliePayment(payment, booking, configured = {}) {
  const paymentId = requireMolliePaymentId(payment?.id);
  const profileId = requireMollieProfileId(payment?.profileId);
  const mode = resolveMollieMode(configured.apiKey, configured.mode);
  return validateMolliePayment(
    payment,
    {
      paymentId,
      bookingId: booking.id,
      amountCents: booking.priceCents,
      currency: "EUR",
      profileId,
      mode
    },
    { profileId: configured.profileId, mode }
  );
}

export function resolveBoundSupportPayment(db, rawPaymentId) {
  const paymentId = requireMolliePaymentId(rawPaymentId);
  const paymentEntries = db.payments.filter((entry) => entry?.molliePaymentId === paymentId);
  if (paymentEntries.length !== 1) {
    throw new MollieIntegrityError(
      paymentEntries.length === 0 ? "MOLLIE_PAYMENT_UNBOUND" : "MOLLIE_PAYMENT_BINDING_AMBIGUOUS"
    );
  }
  const paymentEntry = paymentEntries[0];
  const supports = (db.supports || []).filter((entry) => entry?.molliePaymentId === paymentId);
  if (supports.length !== 1 || supports[0]?.id !== paymentEntry.supportId) {
    throw new MollieIntegrityError("MOLLIE_SUPPORT_BINDING_MISSING");
  }
  const support = supports[0];
  if (!Number.isSafeInteger(support.amountCents) || support.amountCents < 100) {
    throw new MollieIntegrityError("MOLLIE_SUPPORT_AMOUNT_INVALID");
  }
  if (!Number.isSafeInteger(paymentEntry.amountCents) || paymentEntry.amountCents !== support.amountCents) {
    throw new MollieIntegrityError("MOLLIE_STORED_AMOUNT_MISMATCH");
  }
  if (support.currency !== "EUR" || paymentEntry.currency !== "EUR") {
    throw new MollieIntegrityError("MOLLIE_STORED_CURRENCY_MISMATCH");
  }
  requireMollieProfileId(paymentEntry.profileId);
  if (!new Set(["test", "live"]).has(paymentEntry.mode)) {
    throw new MollieIntegrityError("MOLLIE_STORED_MODE_INVALID");
  }
  return {
    paymentId,
    support,
    paymentEntry,
    expected: {
      paymentId,
      supportId: support.id,
      amountCents: support.amountCents,
      currency: "EUR",
      profileId: paymentEntry.profileId,
      mode: paymentEntry.mode
    }
  };
}

export function validateSupportMolliePayment(payment, expected, configured = {}) {
  const supportId = payment?.metadata?.supportId;
  if (typeof supportId !== "string" || supportId !== expected.supportId) {
    throw new MollieIntegrityError("MOLLIE_METADATA_SUPPORT_MISMATCH");
  }
  const compatiblePayment = { ...payment, metadata: { ...payment.metadata, bookingId: supportId } };
  const verified = validateMolliePayment(
    compatiblePayment,
    { ...expected, bookingId: supportId },
    configured
  );
  return { ...verified, supportId };
}

export function validateCreatedSupportMolliePayment(payment, support, configured = {}) {
  const paymentId = requireMolliePaymentId(payment?.id);
  const profileId = requireMollieProfileId(payment?.profileId);
  const mode = resolveMollieMode(configured.apiKey, configured.mode);
  return validateSupportMolliePayment(
    payment,
    {
      paymentId,
      supportId: support.id,
      amountCents: support.amountCents,
      currency: "EUR",
      profileId,
      mode
    },
    { profileId: configured.profileId, mode }
  );
}

export function requireCheckoutUrl(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw new MollieIntegrityError("MOLLIE_CHECKOUT_URL_INVALID");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new MollieIntegrityError("MOLLIE_CHECKOUT_URL_INVALID");
  }
  return url.toString();
}

export function advanceMollieStatus(current, next) {
  if (current === "paid") return "paid";
  if (next === "paid") return "paid";
  if (new Set(["canceled", "expired", "failed"]).has(current)) return current;
  return next;
}

function mollieValueToCents(value) {
  if (typeof value !== "string" || !/^\d+\.\d{2}$/.test(value)) {
    throw new MollieIntegrityError("MOLLIE_AMOUNT_FORMAT_INVALID");
  }
  const [euros, cents] = value.split(".");
  const amount = Number(euros) * 100 + Number(cents);
  if (!Number.isSafeInteger(amount)) {
    throw new MollieIntegrityError("MOLLIE_AMOUNT_FORMAT_INVALID");
  }
  return amount;
}
