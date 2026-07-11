import assert from "node:assert/strict";
import { PassThrough, Readable } from "node:stream";
import { describe, it } from "node:test";
import { readMultipartForm } from "../src/infrastructure/http/multipart.mjs";

describe("multipart security limits", () => {
  it("rejects an oversized declaration before consuming request bytes", async () => {
    let consumed = false;
    const request = Readable.from((async function* bodyStream() { consumed = true; yield Buffer.alloc(8); })());
    request.headers = { "content-type": "multipart/form-data; boundary=declared", "content-length": "100" };
    await assert.rejects(
      () => readMultipartForm(request, { maxBytes: 99 }),
      (error) => error.statusCode === 413 && error.code === "PAYLOAD_TOO_LARGE" && error.closeConnection === true
    );
    assert.equal(consumed, false);
  });

  it("rejects an oversized stream and removes listeners after abort", async () => {
    const oversized = Readable.from([Buffer.alloc(64)]);
    oversized.headers = { "content-type": "multipart/form-data; boundary=streamed" };
    await assert.rejects(
      () => readMultipartForm(oversized, { maxBytes: 32 }),
      (error) => error.code === "PAYLOAD_TOO_LARGE" && error.closeConnection === true
    );

    const aborted = new PassThrough();
    aborted.headers = { "content-type": "multipart/form-data; boundary=aborted" };
    const pending = readMultipartForm(aborted, { maxBytes: 64 });
    aborted.emit("aborted");
    await assert.rejects(pending, (error) => error.code === "UPLOAD_ABORTED");
    for (const event of ["data", "end", "error", "aborted", "close"]) assert.equal(aborted.listenerCount(event), 0);
  });

  it("enforces counts and per-part sizes", async () => {
    const boundary = "limits";
    const body = multipart(boundary, [field("title", "Track"), field("genre", "Pop"), file("audio", "track.mp3", "audio/mpeg", "mp3")]);
    await assert.rejects(() => readMultipartForm(requestFor(body, boundary), { maxFields: 1 }), hasCode("MULTIPART_FIELD_LIMIT"));
    await assert.rejects(() => readMultipartForm(requestFor(body, boundary), { maxFiles: 0 }), hasCode("MULTIPART_FILE_LIMIT"));
    await assert.rejects(() => readMultipartForm(requestFor(body, boundary), { maxParts: 2 }), hasCode("MULTIPART_PART_LIMIT"));
    await assert.rejects(() => readMultipartForm(requestFor(body, boundary), { maxFieldBytes: 3 }), hasCode("MULTIPART_FIELD_TOO_LARGE"));
    await assert.rejects(() => readMultipartForm(requestFor(body, boundary), { maxFileBytes: 2 }), hasCode("MULTIPART_FILE_TOO_LARGE"));
  });

  it("uses a prototype-free map and rejects duplicate fields", async () => {
    const boundary = "field-map";
    const parsed = await readMultipartForm(requestFor(multipart(boundary, [field("__proto__", "safe")]), boundary));
    assert.equal(Object.getPrototypeOf(parsed.fields), null);
    assert.equal(parsed.fields.__proto__, "safe");
    const duplicate = multipart(boundary, [field("title", "One"), field("title", "Two")]);
    await assert.rejects(() => readMultipartForm(requestFor(duplicate, boundary)), hasCode("INVALID_MULTIPART"));
  });
});

function hasCode(code) { return (error) => error.code === code; }
function requestFor(body, boundary) {
  const request = Readable.from([body]);
  request.headers = { "content-type": `multipart/form-data; boundary=${boundary}`, "content-length": String(body.byteLength) };
  return request;
}
function multipart(boundary, parts) { return Buffer.from(`${parts.map((part) => `--${boundary}\r\n${part}\r\n`).join("")}--${boundary}--\r\n`); }
function field(name, value) { return `Content-Disposition: form-data; name="${name}"\r\n\r\n${value}`; }
function file(name, filename, contentType, value) { return `Content-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n${value}`; }
