import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { requireLiveCalendar } from "../src/application/queries/require-live-calendar.mjs";

describe("booking calendar availability policy", () => {
  it("returns busy intervals only for a live calendar result", () => {
    const busy = [{ start: new Date("2030-01-01T10:00:00Z"), end: new Date("2030-01-01T11:00:00Z") }];
    assert.equal(requireLiveCalendar({ status: "connected", busy }), busy);
  });
  for (const result of [
    { status: "error", busy: [], message: "provider details" },
    { status: "not_configured", busy: [] },
    { status: "connected" }
  ]) {
    it(`fails closed for calendar status ${result.status}`, () => {
      assert.throws(
        () => requireLiveCalendar(result),
        (error) =>
          error.statusCode === 503 &&
          error.code === "BOOKING_CALENDAR_UNAVAILABLE" &&
          !error.message.includes("provider details")
      );
    });
  }
});
