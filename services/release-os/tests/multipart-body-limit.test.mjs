import assert from "node:assert/strict";
import { Readable } from "node:stream";
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
});
