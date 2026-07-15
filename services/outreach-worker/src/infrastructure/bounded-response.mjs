export class ResponseSizeLimitError extends Error {
  constructor(maximumBytes) {
    super(`HTTP response exceeded ${maximumBytes} bytes`);
    this.name = "ResponseSizeLimitError";
    this.code = "HTTP_RESPONSE_TOO_LARGE";
    this.maximumBytes = maximumBytes;
  }
}

export async function readBoundedResponseText(response, maximumBytes) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new TypeError("maximumBytes must be a positive safe integer");
  }

  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    await cancelResponseBody(response);
    throw new ResponseSizeLimitError(maximumBytes);
  }

  if (!response.body?.getReader) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maximumBytes) throw new ResponseSizeLimitError(maximumBytes);
    return bytes.toString("utf8");
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new ResponseSizeLimitError(maximumBytes);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks, total).toString("utf8");
}

async function cancelResponseBody(response) {
  try {
    await response.body?.cancel?.();
  } catch {
    // The size violation remains authoritative even when cancellation races
    // with a transport that already closed the body.
  }
}
