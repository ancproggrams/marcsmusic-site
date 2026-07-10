import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { describe, it } from "node:test";

const html = await readFile(new URL("../booking.html", import.meta.url), "utf8");
const stateSource = html.match(/<script data-booking-readiness-state>([\s\S]*?)<\/script>/u)?.[1];

function createState() {
  assert.ok(stateSource, "booking readiness state script is present");
  const context = {};
  runInNewContext(stateSource, context);
  return context.createBookingReadinessState();
}

describe("booking UI readiness", () => {
  it("allows at most one submission per successful availability check", () => {
    const state = createState();
    state.configure(true);
    const generation = state.beginAvailability();
    assert.equal(state.resolveAvailability(generation, true), true);
    assert.equal(state.beginSubmission(true), true);
    assert.equal(state.canSubmit(true), false);
    assert.equal(state.beginSubmission(true), false);
    state.finishSubmission();
    assert.equal(state.canSubmit(true), false);
  });

  it("does not let an older success overwrite a newer failure", () => {
    const state = createState();
    state.configure(true);
    const older = state.beginAvailability();
    const newer = state.beginAvailability();
    assert.equal(state.resolveAvailability(newer, false), true);
    assert.equal(state.resolveAvailability(older, true), false);
    assert.equal(state.canSubmit(true), false);
  });

  it("wires cancellation and the state gate into the page", () => {
    assert.match(html, /availabilityRequest = new AbortController\(\)/u);
    assert.match(html, /bookingState\.resolveAvailability\(generation, true\)/u);
    assert.match(html, /bookingState\.beginSubmission\(Boolean\(selectedSlot\)\)/u);
    assert.match(html, /bookingSubmit\.disabled = !bookingState\.canSubmit/u);
  });
});
