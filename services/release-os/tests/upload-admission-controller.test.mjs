import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UploadAdmissionController } from "../src/infrastructure/http/upload-admission-controller.mjs";
import { resolveUploadRequestDeadlines } from "../src/infrastructure/http/upload-request-deadline.mjs";

describe("upload admission controller", () => {
  it("fails fast at capacity and releases the slot after completion", async () => {
    const controller = new UploadAdmissionController({ maxConcurrent: 1 });
    let completeFirst;
    const first = controller.run(
      () =>
        new Promise((resolve) => {
          completeFirst = resolve;
        })
    );

    assert.equal(controller.active, 1);
    await assert.rejects(
      () => controller.run(async () => "second"),
      (error) =>
        error.statusCode === 503 &&
        error.code === "UPLOAD_CAPACITY_EXCEEDED" &&
        error.retryAfterSeconds === 30 &&
        error.closeConnection === true
    );

    completeFirst("first");
    assert.equal(await first, "first");
    assert.equal(controller.active, 0);
  });

  it("releases capacity after an operation error and rejects unsafe configuration", async () => {
    const defaultController = new UploadAdmissionController();
    assert.equal(defaultController.maxConcurrent, 1);
    assert.equal(Object.isFrozen(defaultController), true);

    const controller = new UploadAdmissionController({ maxConcurrent: "1" });
    await assert.rejects(
      () =>
        controller.run(async () => {
          throw new Error("operation failed");
        }),
      /operation failed/u
    );
    assert.equal(controller.active, 0);

    assert.throws(() => new UploadAdmissionController({ maxConcurrent: 0 }), /must remain 1/u);
    assert.throws(() => new UploadAdmissionController({ maxConcurrent: 2 }), /must remain 1/u);
  });

  it("validates bounded upload deadlines", () => {
    assert.deepEqual(resolveUploadRequestDeadlines(), {
      bodyTimeoutMs: 120_000,
      idleTimeoutMs: 30_000
    });
    assert.deepEqual(resolveUploadRequestDeadlines({ bodyTimeoutMs: "2000", idleTimeoutMs: "1000" }), {
      bodyTimeoutMs: 2_000,
      idleTimeoutMs: 1_000
    });
    assert.throws(() => resolveUploadRequestDeadlines({ bodyTimeoutMs: 0 }), /bodyTimeoutMs/u);
    assert.throws(
      () => resolveUploadRequestDeadlines({ bodyTimeoutMs: 1_000, idleTimeoutMs: 1_001 }),
      /idleTimeoutMs must not exceed bodyTimeoutMs/u
    );
  });
});
