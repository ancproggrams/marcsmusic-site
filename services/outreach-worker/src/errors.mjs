export class ApplicationError extends Error {
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = options.name ?? "ApplicationError";
    this.code = options.code ?? "APPLICATION_ERROR";
    this.statusCode = options.statusCode ?? 500;
    this.retryable = Boolean(options.retryable);
    this.deliveryUnknown = Boolean(options.deliveryUnknown);
    this.details = options.details;
  }
}

export function errorCode(error) {
  return typeof error?.code === "string" ? error.code.slice(0, 120) : "UNEXPECTED_ERROR";
}
