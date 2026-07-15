export class HttpError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function publicError(error) {
  if (error instanceof HttpError) {
    return Object.freeze({
      statusCode: error.statusCode,
      code: error.code,
      message: error.message
    });
  }

  if (isFastifyClientError(error)) {
    return Object.freeze({
      statusCode: normalizeClientStatus(error.statusCode),
      code: normalizeFastifyCode(error.code),
      message: "The request could not be processed."
    });
  }

  return Object.freeze({
    statusCode: 500,
    code: "INTERNAL_SERVER_ERROR",
    message: "The request could not be processed."
  });
}

function isFastifyClientError(error) {
  return Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode < 500;
}

function normalizeClientStatus(statusCode) {
  if (statusCode === 413 || statusCode === 415 || statusCode === 429) return statusCode;
  return 400;
}

function normalizeFastifyCode(code) {
  if (code === "FST_ERR_CTP_BODY_TOO_LARGE" || code === "FST_REQ_FILE_TOO_LARGE") {
    return "REQUEST_BODY_TOO_LARGE";
  }
  if (code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") return "UNSUPPORTED_MEDIA_TYPE";
  return "INVALID_REQUEST";
}
