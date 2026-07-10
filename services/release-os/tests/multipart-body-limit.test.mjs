import assert from "node:assert/strict";
import { PassThrough, Readable } from "node:stream";
import { describe, it } from "node:test";
import { readMultipartForm } from "../src/infrastructure/http/multipart.mjs";

describe("multipart body limit", () => {
  it("rejects an oversized declaration before consuming request bytes", async () => {
    let consumed = false;
    const request = Readable.from(
      (async function* body() {
        consumed = true;
        yield Buffer.alloc(8);
      })()
    );
    request.headers = {
      "content-type": "multipart/form-data; boundary=declared",
      "content-length": "100"
    };

    await assert.rejects(
      () => readMultipartForm(request, { maxBytes: 99 }),
      (error) => error.code === "PAYLOAD_TOO_LARGE" && error.closeConnection === true
    );
    assert.equal(consumed, false);
  });

  it("rejects actual streamed bytes when Content-Length is absent", async () => {
    const request = Readable.from([Buffer.alloc(64)]);
    request.headers = { "content-type": "multipart/form-data; boundary=streamed" };

    await assert.rejects(
      () => readMultipartForm(request, { maxBytes: 32 }),
      (error) => error.code === "PAYLOAD_TOO_LARGE" && error.closeConnection === true
    );
  });

  it("accepts an actual body exactly at the byte limit", async () => {
    const request = Readable.from([Buffer.alloc(64)]);
    request.headers = { "content-type": "multipart/form-data; boundary=exact" };

    const parsed = await readMultipartForm(request, { maxBytes: 64 });
    assert.deepEqual(parsed, { fields: {}, files: [] });
  });

  it("removes body listeners after a client abort", async () => {
    const request = new PassThrough();
    request.headers = { "content-type": "multipart/form-data; boundary=aborted" };
    const pendingRead = readMultipartForm(request, { maxBytes: 64 });

    request.emit("aborted");
    await assert.rejects(
      pendingRead,
      (error) => error.code === "UPLOAD_ABORTED" && error.closeConnection === true
    );

    for (const event of ["data", "end", "error", "aborted", "close"]) {
      assert.equal(request.listenerCount(event), 0);
    }
  });

  it("enforces the total body deadline despite continuing request data", async () => {
    const request = new PassThrough();
    request.headers = { "content-type": "multipart/form-data; boundary=slow-drip" };
    const pendingRead = readMultipartForm(request, { maxBytes: 1_024, bodyTimeoutMs: 80 });
    const drip = setInterval(() => request.write(Buffer.from("x")), 10);

    try {
      await assert.rejects(
        pendingRead,
        (error) => error.code === "UPLOAD_BODY_TIMEOUT" && error.statusCode === 408
      );
    } finally {
      clearInterval(drip);
      request.destroy();
    }
  });
});
