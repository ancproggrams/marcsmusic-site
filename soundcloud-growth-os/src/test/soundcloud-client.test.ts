import { afterEach, describe, expect, it, vi } from "vitest";
import { SoundCloudApiError, SoundCloudClient } from "../lib/soundcloud/client";

const clientEnv = {
  NODE_ENV: "production",
  SOUNDCLOUD_CLIENT_ID: "client-id",
  SOUNDCLOUD_REDIRECT_URI: "https://growth.example.test/api/auth/soundcloud/callback",
  NEXT_PUBLIC_APP_URL: "https://growth.example.test"
};

function jsonResponse(value: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(value), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers }
  });
}

describe("SoundCloud API client reliability and boundary", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    "https://api.soundcloud.com.evil.example/me",
    "https://api.soundcloud.com@evil.example/me",
    "https://user:password@api.soundcloud.com/me",
    "https://%61pi.soundcloud.com/me",
    "https://api%2Esoundcloud.com.evil.example/me",
    "https://api.soundcloud.com\\@evil.example/me",
    "https://api.soundcloud.com./me",
    "https://api.soundcloud.com:0443/me",
    "https://api.soundcloud.com:444/me",
    "http://api.soundcloud.com/me",
    "https://api.soundcloud.com/me#https://evil.example"
  ])("rejects non-canonical API authority before exposing the OAuth token: %s", async (url) => {
    const fetchImpl = vi.fn();
    const client = new SoundCloudClient({
      accessToken: "never-send-this-token",
      env: clientEnv,
      fetchImpl,
      maxRetries: 0
    });

    await expect(client.request(url)).rejects.toThrow("official SoundCloud API");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends the token only to the exact HTTPS API origin and disallows redirects", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      void url;
      void init;
      return jsonResponse({ id: 1, username: "artist" });
    });
    const client = new SoundCloudClient({ accessToken: "approved-token", env: clientEnv, fetchImpl, maxRetries: 0 });

    await expect(client.request("https://api.soundcloud.com:443/me")).resolves.toMatchObject({ id: 1 });

    const init = fetchImpl.mock.calls[0][1];
    expect(new Headers(init?.headers).get("authorization")).toBe("OAuth approved-token");
    expect(init?.redirect).toBe("error");
  });

  it("aborts a stalled fetch at the bounded overall deadline", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }));
    const client = new SoundCloudClient({
      accessToken: "token",
      env: { ...clientEnv, SOUNDCLOUD_API_DEADLINE_MS: "1000" },
      fetchImpl,
      maxRetries: 0
    });

    const request = client.getMe();
    const assertion = expect(request).rejects.toMatchObject({ code: "DEADLINE_EXCEEDED", retryable: false });
    await vi.advanceTimersByTimeAsync(1_000);

    await assertion;
    expect((fetchImpl.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true);
  });

  it("keeps the abort deadline active while streaming a successful response body", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener(
            "abort",
            () => controller.error(new DOMException("aborted", "AbortError")),
            { once: true }
          );
        }
      });
      return new Response(body, { headers: { "content-type": "application/json" } });
    });
    const client = new SoundCloudClient({
      accessToken: "token",
      env: { ...clientEnv, SOUNDCLOUD_API_DEADLINE_MS: "1000" },
      fetchImpl,
      maxRetries: 0
    });

    const request = client.getMe();
    const assertion = expect(request).rejects.toMatchObject({ code: "DEADLINE_EXCEEDED", retryable: false });
    await vi.advanceTimersByTimeAsync(1_000);

    await assertion;
  });

  it("caps both declared and streamed response sizes without reading diagnostic bodies", async () => {
    const oversized = "x".repeat(1_025);
    const declaredFetch = vi.fn(async () => new Response(oversized, {
      headers: { "content-length": "1025", "content-type": "application/json" }
    }));
    const declaredClient = new SoundCloudClient({
      accessToken: "token",
      env: { ...clientEnv, SOUNDCLOUD_API_MAX_RESPONSE_BYTES: "1024" },
      fetchImpl: declaredFetch,
      maxRetries: 0
    });

    await expect(declaredClient.getMe()).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(700)));
        controller.enqueue(new TextEncoder().encode("sensitive-provider-body".repeat(30)));
        controller.close();
      }
    });
    const streamedClient = new SoundCloudClient({
      accessToken: "token",
      env: { ...clientEnv, SOUNDCLOUD_API_MAX_RESPONSE_BYTES: "1024" },
      fetchImpl: vi.fn(async () => new Response(stream, { headers: { "content-type": "application/json" } })),
      maxRetries: 0
    });

    let message = "";
    try {
      await streamedClient.getMe();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
      expect(error).toMatchObject({ code: "RESPONSE_TOO_LARGE" });
    }
    expect(message).not.toContain("sensitive-provider-body");
  });

  it("honors bounded Retry-After delays with additive jitter", async () => {
    let currentTime = Date.parse("2026-07-15T12:00:00.000Z");
    const sleep = vi.fn(async (milliseconds: number) => {
      currentTime += milliseconds;
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, { status: 429, headers: { "retry-after": "1" } }))
      .mockResolvedValueOnce(jsonResponse({}, { status: 503, headers: { "retry-after": "999999" } }))
      .mockResolvedValueOnce(jsonResponse({ id: 1, username: "artist" }));
    const client = new SoundCloudClient({
      accessToken: "token",
      env: { ...clientEnv, SOUNDCLOUD_API_DEADLINE_MS: "30000" },
      fetchImpl,
      maxRetries: 2,
      random: () => 0.5,
      now: () => currentTime,
      sleep
    });

    await expect(client.getMe()).resolves.toMatchObject({ id: 1 });
    expect(sleep.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([1_125, 5_000]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it.each([400, 401, 403, 404, 501])("does not retry classified terminal HTTP status %s", async (status) => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, { status }));
    const client = new SoundCloudClient({ accessToken: "token", env: clientEnv, fetchImpl });

    await expect(client.getMe()).rejects.toMatchObject({
      code: "HTTP_ERROR",
      status,
      retryable: false
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries classified transient network failure and never includes the token in errors", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network failed with internal detail"))
      .mockResolvedValueOnce(jsonResponse({ id: 1, username: "artist" }));
    const sleep = vi.fn(async () => undefined);
    const client = new SoundCloudClient({
      accessToken: "secret-oauth-token",
      env: clientEnv,
      fetchImpl,
      maxRetries: 1,
      random: () => 0,
      sleep
    });

    await expect(client.getMe()).resolves.toMatchObject({ id: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const terminalClient = new SoundCloudClient({
      accessToken: "secret-oauth-token",
      env: clientEnv,
      fetchImpl: vi.fn(async () => jsonResponse({}, { status: 401 })),
      maxRetries: 0
    });
    let message = "";
    try {
      await terminalClient.getMe();
    } catch (error) {
      expect(error).toBeInstanceOf(SoundCloudApiError);
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toContain("secret-oauth-token");
  });
});
