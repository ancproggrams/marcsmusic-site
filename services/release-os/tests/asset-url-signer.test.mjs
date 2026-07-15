import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AssetUrlSigner } from "../src/infrastructure/security/asset-url-signer.mjs";

const SECRET = "asset-signing-test-key-that-is-longer-than-32-bytes";

describe("AssetUrlSigner", () => {
  it("binds a short-lived signature to GET and the exact asset path", () => {
    let now = Date.UTC(2026, 6, 15, 10, 0, 0);
    const signer = new AssetUrlSigner({ secret: SECRET, now: () => now, defaultTtlSeconds: 60 });
    const signed = signer.signPath("/assets/audio/release.mp3");
    const url = new URL(signed, "https://release.example");

    assert.equal(signer.verifyRequest({ method: "GET", pathname: url.pathname, searchParams: url.searchParams }), true);
    assert.equal(signer.verifyRequest({ method: "HEAD", pathname: url.pathname, searchParams: url.searchParams }), false);
    assert.equal(
      signer.verifyRequest({ method: "GET", pathname: "/assets/audio/other.mp3", searchParams: url.searchParams }),
      false
    );

    now += 61_000;
    assert.equal(signer.verifyRequest({ method: "GET", pathname: url.pathname, searchParams: url.searchParams }), false);
  });

  it("rejects duplicate, missing, extra, malformed, and excessively distant query evidence", () => {
    const now = Date.UTC(2026, 6, 15, 10, 0, 0);
    const signer = new AssetUrlSigner({
      secret: SECRET,
      now: () => now,
      defaultTtlSeconds: 60,
      maximumTtlSeconds: 120
    });
    const signed = new URL(signer.signPath("/assets/artwork/cover.jpg", { ttlSeconds: 60 }), "https://release.example");

    for (const search of [
      `?expires=${signed.searchParams.get("expires")}`,
      `${signed.search}&extra=1`,
      `${signed.search}&signature=${signed.searchParams.get("signature")}`,
      "?expires=not-a-number&signature=bad",
      `?expires=${Math.floor(now / 1_000) + 121}&signature=${signed.searchParams.get("signature")}`
    ]) {
      assert.equal(
        signer.verifyRequest({
          method: "GET",
          pathname: signed.pathname,
          searchParams: new URLSearchParams(search)
        }),
        false,
        search
      );
    }
  });

  it("fails closed when the signing secret is absent or too weak", () => {
    for (const secret of [undefined, "short-secret"]) {
      const signer = new AssetUrlSigner({ secret, env: {} });
      assert.equal(signer.configured, false);
      assert.throws(
        () => signer.signPath("/assets/audio/release.mp3"),
        (error) => error.code === "ASSET_SIGNING_NOT_CONFIGURED" && error.statusCode === 503
      );
    }
  });

  it("classifies caller TTL errors separately from unsafe server configuration", () => {
    const signer = new AssetUrlSigner({ secret: SECRET, defaultTtlSeconds: 60, maximumTtlSeconds: 120 });
    assert.throws(
      () => signer.signPath("/assets/audio/release.mp3", { ttlSeconds: 121 }),
      (error) => error.code === "ASSET_URL_TTL_INVALID" && error.statusCode === 400
    );
    assert.throws(
      () => new AssetUrlSigner({ secret: SECRET, defaultTtlSeconds: 30 }),
      (error) => error.code === "ASSET_SIGNING_CONFIG_INVALID" && error.statusCode === 503
    );
  });
});
