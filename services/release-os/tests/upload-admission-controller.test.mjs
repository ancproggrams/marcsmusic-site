import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UploadAdmissionController } from "../src/infrastructure/http/upload-admission-controller.mjs";

describe("upload admission controller", () => {
  it("fails fast at capacity and releases the slot", async () => {
    const controller = new UploadAdmissionController({ maxConcurrent: 1 });
    let complete;
    const first = controller.run(() => new Promise((resolve) => { complete = resolve; }));
    await assert.rejects(
      () => controller.run(async () => "second"),
      (error) => error.statusCode === 503 && error.code === "UPLOAD_CAPACITY_EXCEEDED" && error.retryAfterSeconds === 30
    );
    complete("first");
    assert.equal(await first, "first");
    assert.equal(controller.active, 0);
  });

  it("releases capacity after errors and rejects unsafe configuration", async () => {
    const controller = new UploadAdmissionController({ maxConcurrent: "2" });
    await assert.rejects(() => controller.run(async () => { throw new Error("operation failed"); }), /operation failed/u);
    assert.equal(controller.active, 0);
    assert.throws(() => new UploadAdmissionController({ maxConcurrent: 0 }), /between 1 and 4/u);
    assert.throws(() => new UploadAdmissionController({ maxConcurrent: 5 }), /between 1 and 4/u);
  });
});
