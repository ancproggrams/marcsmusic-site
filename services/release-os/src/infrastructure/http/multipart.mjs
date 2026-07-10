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
    throw Object.assign(new Error("Expected multipart/form-data boundary"), {
      statusCode: 415,
      code: "INVALID_MULTIPART",
      closeConnection: true
    });
  }

  return match[1] ?? match[2];
}

async function readBodyBuffer(request, maxBytes) {
  let size = 0;
  const chunks = [];

  for await (const chunk of request) {
    size += chunk.byteLength;

    if (size > maxBytes) {
      throw Object.assign(new Error("Multipart body is too large"), {
        statusCode: 413,
        code: "PAYLOAD_TOO_LARGE",
        closeConnection: true
      });
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
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
    throw Object.assign(new Error("Invalid Content-Length header"), {
      statusCode: 400,
      code: "INVALID_MULTIPART",
      closeConnection: true
    });
  }

  if (Number(value) > maxBytes) {
    throw Object.assign(new Error("Multipart body is too large"), {
      statusCode: 413,
      code: "PAYLOAD_TOO_LARGE",
      closeConnection: true
    });
  }
}
