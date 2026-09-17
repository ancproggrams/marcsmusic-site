const DEFAULT_MAX_BODY_BYTES = 80 * 1024 * 1024;
const DEFAULT_MAX_PARTS = 40;
const DEFAULT_MAX_FILES = 4;
const DEFAULT_MAX_FIELDS = 32;
const DEFAULT_MAX_FIELD_BYTES = 64 * 1024;
const DEFAULT_MAX_HEADER_BYTES = 16 * 1024;

export async function readMultipartForm(request, options = {}) {
  const limits = resolveLimits(options);
  const boundary = readBoundary(request.headers["content-type"] ?? "");
  assertContentLength(request.headers["content-length"], limits.maxBytes);
  const body = await readBodyBuffer(request, limits.maxBytes);
  const parts = parseMultipartBuffer(body, boundary, limits);
  const fields = Object.create(null);
  const files = [];
  let fieldCount = 0;

  for (const part of parts) {
    if (part.filename) {
      if (files.length >= limits.maxFiles) {
        throw limitError("Multipart request contains too many files", "MULTIPART_FILE_LIMIT");
      }
      if (part.data.byteLength > limits.maxFileBytes) {
        throw limitError("Multipart file is too large", "MULTIPART_FILE_TOO_LARGE");
      }
      files.push(part);
      continue;
    }

    fieldCount += 1;
    if (fieldCount > limits.maxFields) {
      throw limitError("Multipart request contains too many fields", "MULTIPART_FIELD_LIMIT");
    }
    if (part.data.byteLength > limits.maxFieldBytes) {
      throw limitError("Multipart field is too large", "MULTIPART_FIELD_TOO_LARGE");
    }
    if (Object.hasOwn(fields, part.name)) {
      throw invalidMultipart(`Duplicate multipart field: ${part.name}`);
    }
    fields[part.name] = part.data.toString("utf8");
  }

  return Object.freeze({ fields: Object.freeze(fields), files: Object.freeze(files) });
}

function readBoundary(contentType) {
  if (!/^multipart\/form-data\s*(?:;|$)/iu.test(contentType)) {
    throw invalidMultipart("Expected multipart/form-data content type", 415);
  }

  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/iu);
  const boundary = (match?.[1] ?? match?.[2] ?? "").trim();
  if (!boundary || boundary.length > 70 || /[\r\n]/u.test(boundary)) {
    throw invalidMultipart("Expected a valid multipart/form-data boundary", 415);
  }
  return boundary;
}

function readBodyBuffer(request, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    const chunks = [];

    const cleanup = () => {
      for (const [event, listener] of Object.entries(listeners)) {
        request.removeListener(event, listener);
      }
    };
    const finish = (operation) => {
      if (settled) return;
      settled = true;
      cleanup();
      operation();
    };
    const listeners = {
      data(chunk) {
        size += chunk.byteLength;
        if (size > maxBytes) {
          request.pause?.();
          finish(() => reject(limitError("Multipart body is too large", "PAYLOAD_TOO_LARGE")));
          return;
        }
        chunks.push(chunk);
      },
      end() {
        finish(() => resolve(Buffer.concat(chunks)));
      },
      error(error) {
        finish(() => reject(error));
      },
      aborted() {
        finish(() => reject(connectionError("Upload was aborted", "UPLOAD_ABORTED")));
      },
      close() {
        if (!request.complete && !request.readableEnded) {
          finish(() => reject(connectionError("Upload connection closed early", "UPLOAD_ABORTED")));
        }
      }
    };

    for (const [event, listener] of Object.entries(listeners)) {
      request.on(event, listener);
    }
  });
}

function parseMultipartBuffer(body, boundary, limits) {
  const delimiter = Buffer.from(`--${boundary}`);
  const parts = [];
  let offset = body.indexOf(delimiter);
  let partCount = 0;

  if (offset < 0) throw invalidMultipart("Multipart body does not contain its declared boundary");
  while (offset >= 0) {
    offset += delimiter.length;
    if (body.subarray(offset, offset + 2).toString("latin1") === "--") break;
    if (body.subarray(offset, offset + 2).toString("latin1") === "\r\n") offset += 2;

    const next = body.indexOf(delimiter, offset);
    if (next < 0) throw invalidMultipart("Multipart body is missing its closing boundary");
    partCount += 1;
    if (partCount > limits.maxParts) {
      throw limitError("Multipart request contains too many parts", "MULTIPART_PART_LIMIT");
    }

    let part = body.subarray(offset, next);
    if (part.subarray(part.length - 2).toString("latin1") === "\r\n") part = part.subarray(0, -2);
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd <= 0) throw invalidMultipart("Multipart part has invalid headers");
    if (headerEnd > limits.maxHeaderBytes) {
      throw limitError("Multipart part headers are too large", "MULTIPART_HEADERS_TOO_LARGE");
    }
    parts.push(parsePart(part.subarray(0, headerEnd).toString("utf8"), part.subarray(headerEnd + 4)));
    offset = next;
  }
  return parts;
}

function parsePart(headersText, data) {
  const headers = Object.fromEntries(headersText.split("\r\n").map((line) => {
    const index = line.indexOf(":");
    if (index <= 0) throw invalidMultipart("Multipart part contains an invalid header");
    return [line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim()];
  }));
  const disposition = headers["content-disposition"] ?? "";
  const name = readDispositionValue(disposition, "name");
  if (!name) throw invalidMultipart("Multipart part is missing a field name");
  return Object.freeze({
    name,
    filename: readDispositionValue(disposition, "filename"),
    contentType: headers["content-type"],
    data
  });
}

function readDispositionValue(disposition, key) {
  return disposition.match(new RegExp(`${key}="([^"]*)"`, "iu"))?.[1];
}

function resolveLimits(options) {
  const maxBytes = readLimit(options.maxBytes, DEFAULT_MAX_BODY_BYTES, "maxBytes", false);
  return Object.freeze({
    maxBytes,
    maxParts: readLimit(options.maxParts, DEFAULT_MAX_PARTS, "maxParts"),
    maxFiles: readLimit(options.maxFiles, DEFAULT_MAX_FILES, "maxFiles"),
    maxFields: readLimit(options.maxFields, DEFAULT_MAX_FIELDS, "maxFields"),
    maxFieldBytes: readLimit(options.maxFieldBytes, DEFAULT_MAX_FIELD_BYTES, "maxFieldBytes"),
    maxFileBytes: readLimit(options.maxFileBytes, maxBytes, "maxFileBytes"),
    maxHeaderBytes: readLimit(options.maxHeaderBytes, DEFAULT_MAX_HEADER_BYTES, "maxHeaderBytes")
  });
}

function readLimit(value, fallback, name, allowZero = true) {
  const limit = value ?? fallback;
  const minimum = allowZero ? 0 : 1;
  if (!Number.isSafeInteger(limit) || limit < minimum) {
    throw new TypeError(`${name} must be a safe integer greater than or equal to ${minimum}`);
  }
  return limit;
}

function assertContentLength(value, maxBytes) {
  if (value === undefined) return;
  if (Array.isArray(value) || !/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value))) {
    throw invalidMultipart("Invalid Content-Length header");
  }
  if (Number(value) > maxBytes) {
    throw limitError("Multipart body is too large", "PAYLOAD_TOO_LARGE");
  }
}

function invalidMultipart(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode, code: "INVALID_MULTIPART" });
}

function limitError(message, code) {
  return Object.assign(new Error(message), { statusCode: 413, code, closeConnection: true });
}

function connectionError(message, code) {
  return Object.assign(new Error(message), { statusCode: 400, code, closeConnection: true });
}
