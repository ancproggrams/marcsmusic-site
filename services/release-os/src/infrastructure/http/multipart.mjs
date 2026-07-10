const DEFAULT_MAX_BODY_BYTES = 80 * 1024 * 1024;

export async function readMultipartForm(request, options = {}) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BODY_BYTES;
  assertContentLength(request.headers["content-length"], maxBytes);
  const contentType = request.headers["content-type"] ?? "";
  const boundary = readBoundary(contentType);
  const body = await readBodyBuffer(request, maxBytes);
  const parts = parseMultipartBuffer(body, boundary);
  const fields = {};
  const files = [];

  for (const part of parts) {
    if (part.filename) {
      files.push(part);
      continue;
    }

    fields[part.name] = part.data.toString("utf8");
  }

  return Object.freeze({
    fields: Object.freeze(fields),
    files: Object.freeze(files)
  });
}

function readBoundary(contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/iu);

  if (!match) {
    throw multipartError(415, "Expected multipart/form-data boundary", "INVALID_MULTIPART");
  }

  return match[1] ?? match[2];
}

function readBodyBuffer(request, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let settled = false;

    const cleanup = () => {
      request.removeListener("data", onData);
      request.removeListener("end", onEnd);
      request.removeListener("error", onError);
      request.removeListener("aborted", onAborted);
      request.removeListener("close", onClose);
    };
    const fail = (error) => {
      if (settled) {
        return;
      }

      settled = true;
      request.pause();
      cleanup();
      reject(error);
    };
    const onData = (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;

      if (size > maxBytes) {
        fail(multipartError(413, "Multipart body is too large", "PAYLOAD_TOO_LARGE"));
        return;
      }

      chunks.push(buffer);
    };
    const onEnd = () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks, size));
    };
    const onError = (error) => fail(error);
    const onAborted = () => fail(multipartError(400, "Upload request was aborted", "UPLOAD_ABORTED"));
    const onClose = () => {
      if (!request.complete) {
        onAborted();
      }
    };

    request.on("data", onData);
    request.once("end", onEnd);
    request.once("error", onError);
    request.once("aborted", onAborted);
    request.once("close", onClose);
  });
}

function parseMultipartBuffer(body, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const parts = [];
  let offset = body.indexOf(delimiter);

  while (offset >= 0) {
    offset += delimiter.length;

    if (body.subarray(offset, offset + 2).toString("latin1") === "--") {
      break;
    }

    if (body.subarray(offset, offset + 2).toString("latin1") === "\r\n") {
      offset += 2;
    }

    const next = body.indexOf(delimiter, offset);
    if (next < 0) {
      break;
    }

    let part = body.subarray(offset, next);
    if (part.subarray(part.length - 2).toString("latin1") === "\r\n") {
      part = part.subarray(0, part.length - 2);
    }

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd > 0) {
      parts.push(parsePart(part.subarray(0, headerEnd).toString("utf8"), part.subarray(headerEnd + 4)));
    }

    offset = next;
  }

  return parts;
}

function parsePart(headersText, data) {
  const headers = Object.fromEntries(
    headersText.split("\r\n").map((line) => {
      const index = line.indexOf(":");
      return [line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim()];
    })
  );
  const disposition = headers["content-disposition"] ?? "";
  const name = readDispositionValue(disposition, "name");
  const filename = readDispositionValue(disposition, "filename");

  if (!name) {
    throw Object.assign(new Error("Multipart part is missing a field name"), {
      statusCode: 400,
      code: "INVALID_MULTIPART"
    });
  }

  return Object.freeze({
    name,
    filename,
    contentType: headers["content-type"],
    data
  });
}

function readDispositionValue(disposition, key) {
  const match = disposition.match(new RegExp(`${key}="([^"]*)"`, "iu"));
  return match?.[1];
}

function assertContentLength(value, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("maxBytes must be a positive safe integer");
  }

  if (value === undefined) {
    return;
  }

  if (Array.isArray(value) || !/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value))) {
    throw multipartError(400, "Invalid Content-Length header", "INVALID_MULTIPART");
  }

  if (Number(value) > maxBytes) {
    throw multipartError(413, "Multipart body is too large", "PAYLOAD_TOO_LARGE");
  }
}

function multipartError(statusCode, message, code) {
  return Object.assign(new Error(message), {
    statusCode,
    code,
    closeConnection: true
  });
}
