import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as postLegacyOutreachEmail } from "../app/api/outreach/email/route";
import { getMailgunConfig, MailgunConfigurationError, sendMailgunOutreachEmail } from "../lib/outreach/mailgun";
import {
  assertHumanApprovedOutreach,
  assertLegacyOutreachProviderEnabled,
  assertLegacyOutreachSendEnabled,
  assertOutreachRateLimit,
  assertRecipientAllowed,
  OutreachPolicyError,
  isLegacyOutreachSendEnabled,
  isProductionOrRailwayRuntime,
  requireOutreachMailToken,
  resetOutreachRateLimits
} from "../lib/outreach/policy";
import { defaultOutreachLinks, getOutreachTemplate, outreachTemplates, renderOutreachTemplate } from "../lib/outreach/templates";

const productionRuntimeCases: Array<[string, Record<string, string>]> = [
  ["NODE_ENV=production", { NODE_ENV: "production" }],
  ["mixed-case NODE_ENV=production", { NODE_ENV: "  ProDucTion  " }],
  ["RAILWAY_ENVIRONMENT", { NODE_ENV: "development", RAILWAY_ENVIRONMENT: "production" }],
  ["RAILWAY_ENVIRONMENT_ID", { NODE_ENV: "development", RAILWAY_ENVIRONMENT_ID: "environment-id" }],
  ["RAILWAY_ENVIRONMENT_NAME", { NODE_ENV: "test", RAILWAY_ENVIRONMENT_NAME: "staging" }],
  ["mixed Railway markers", {
    NODE_ENV: "development",
    RAILWAY_ENVIRONMENT: "staging",
    RAILWAY_ENVIRONMENT_ID: "environment-id",
    RAILWAY_ENVIRONMENT_NAME: "staging",
    RAILWAY_PROJECT_ID: "project-id",
    RAILWAY_SERVICE_ID: "service-id"
  }]
];

describe("Mailgun outreach configuration", () => {
  it("requires Mailgun secrets and sender configuration", () => {
    expect(() => getMailgunConfig({})).toThrow(MailgunConfigurationError);
  });

  it("normalizes the Mailgun base URL", () => {
    expect(
      getMailgunConfig({
        MAILGUN_API_KEY: "key-test",
        MAILGUN_DOMAIN: "mg.example.com",
        MAILGUN_BASE_URL: "https://api.eu.mailgun.net/",
        OUTREACH_FROM_EMAIL: "outreach@mg.example.com"
      }).baseUrl
    ).toBe("https://api.eu.mailgun.net");
  });
});

describe("Mailgun outreach sending", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts a single plain-text message to Mailgun with tracking disabled", async () => {
    stubLegacyProviderEnv({ NODE_ENV: "development" });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({ id: "<message-id>", message: "Queued. See you soon!" }));
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await sendMailgunOutreachEmail(
      {
        apiKey: "key-test",
        baseUrl: "https://api.mailgun.net",
        domain: "mg.example.com",
        fromEmail: "outreach@mg.example.com",
        fromName: "MarcsMusic",
        replyTo: "marc@example.com"
      },
      {
        toEmail: "artist@example.org",
        toName: "Artist",
        subject: "SoundCloud collaboration",
        text: "Hi, I listened to your latest track and wanted to reach out with a specific collaboration idea.",
        campaign: "soundcloud-outreach",
        attachments: [
          {
            filename: "Carnival.mp3",
            contentType: "audio/mpeg",
            bytes: new TextEncoder().encode("fake-mp3").buffer as ArrayBuffer,
            size: 8
          }
        ]
      }
    );

    expect(result.id).toBe("<message-id>");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    expect(url).toBe("https://api.mailgun.net/v3/mg.example.com/messages");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      Authorization: `Basic ${Buffer.from("api:key-test").toString("base64")}`
    });

    const form = init?.body as FormData;
    expect(form.get("from")).toBe("\"MarcsMusic\" <outreach@mg.example.com>");
    expect(form.get("to")).toBe("\"Artist\" <artist@example.org>");
    expect(form.get("o:tracking")).toBe("no");
    expect(form.get("o:tracking-clicks")).toBe("no");
    expect(form.get("o:tracking-opens")).toBe("no");
    expect((form.get("attachment") as File).name).toBe("Carnival.mp3");
  });

  it("rejects header injection in subject fields", async () => {
    stubLegacyProviderEnv({ NODE_ENV: "development" });
    await expect(
      sendMailgunOutreachEmail(
        {
          apiKey: "key-test",
          baseUrl: "https://api.mailgun.net",
          domain: "mg.example.com",
          fromEmail: "outreach@mg.example.com",
          fromName: "MarcsMusic"
        },
        {
          toEmail: "artist@example.org",
          subject: "Hello\r\nBcc: victim@example.net",
          text: "This message should be rejected before it reaches Mailgun."
        }
      )
    ).rejects.toThrow(MailgunConfigurationError);
  });
});

describe("outreach policy", () => {
  it.each([undefined, "false", "TRUE", "1", "invalid"])(
    "keeps the legacy direct sender disabled for %s",
    (value) => {
      expect(() =>
        assertLegacyOutreachSendEnabled({
          LEGACY_OUTREACH_SEND_ENABLED: value
        })
      ).toThrow(
        expect.objectContaining({
          code: "LEGACY_OUTREACH_SEND_DISABLED",
          status: 503
        })
      );
    }
  );

  it("enables the legacy direct sender only for the exact reviewed value in development", () => {
    expect(() =>
      assertLegacyOutreachSendEnabled(developmentLegacyEnv())
    ).not.toThrow();
    expect(isLegacyOutreachSendEnabled(developmentLegacyEnv())).toBe(true);
  });

  it.each(productionRuntimeCases)("forces the legacy sender closed for %s", (_name, marker) => {
    const env = { ...developmentLegacyEnv(), ...marker };
    expect(isProductionOrRailwayRuntime(env)).toBe(true);
    expect(isLegacyOutreachSendEnabled(env)).toBe(false);
    expect(() => assertLegacyOutreachSendEnabled(env)).toThrow(
      expect.objectContaining({ code: "LEGACY_OUTREACH_SEND_DISABLED", status: 503 })
    );
    expect(() => assertLegacyOutreachProviderEnabled(env)).toThrow(
      expect.objectContaining({ code: "LEGACY_OUTREACH_SEND_DISABLED", status: 503 })
    );
  });

  it("requires the configured outreach token", () => {
    const headers = new Headers({ authorization: "Bearer secret-token" });

    expect(() => requireOutreachMailToken(headers, { OUTREACH_MAIL_TOKEN: "secret-token" })).not.toThrow();
    expect(() => requireOutreachMailToken(headers, { OUTREACH_MAIL_TOKEN: "different-token" })).toThrow(OutreachPolicyError);
  });

  it("requires human approval and honors recipient domain allowlists", () => {
    expect(() => assertHumanApprovedOutreach(false)).toThrow(OutreachPolicyError);
    expect(() => assertHumanApprovedOutreach(true)).not.toThrow();
    expect(() => assertRecipientAllowed("artist@example.org", "example.org")).not.toThrow();
    expect(() => assertRecipientAllowed("artist@example.net", "example.org")).toThrow(OutreachPolicyError);
  });

  it("limits outreach sends per token per hour", () => {
    resetOutreachRateLimits();

    expect(() => assertOutreachRateLimit("token-a", { OUTREACH_MAX_EMAILS_PER_HOUR: "2" }, 1000)).not.toThrow();
    expect(() => assertOutreachRateLimit("token-a", { OUTREACH_MAX_EMAILS_PER_HOUR: "2" }, 2000)).not.toThrow();
    expect(() => assertOutreachRateLimit("token-a", { OUTREACH_MAX_EMAILS_PER_HOUR: "2" }, 3000)).toThrow(OutreachPolicyError);
    expect(() => assertOutreachRateLimit("token-a", { OUTREACH_MAX_EMAILS_PER_HOUR: "2" }, 60 * 60 * 1000 + 1001)).not.toThrow();

    resetOutreachRateLimits();
  });
});

describe("legacy outreach route gate", () => {
  afterEach(() => {
    resetOutreachRateLimits();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each(["", "false", "TRUE", "1", "invalid"])(
    "does not reach Mailgun when LEGACY_OUTREACH_SEND_ENABLED is %s",
    async (value) => {
      vi.stubEnv("LEGACY_OUTREACH_SEND_ENABLED", value);
      vi.stubEnv("OUTREACH_MAIL_TOKEN", "test-token");
      const providerFetch = vi.fn();
      vi.stubGlobal("fetch", providerFetch);

      const response = await postLegacyOutreachEmail(
        new NextRequest("http://localhost/api/outreach/email", {
          method: "POST",
          headers: {
            authorization: "Bearer test-token",
            "content-type": "application/json"
          },
          body: JSON.stringify({
            toEmail: "reviewer@example.com",
            subject: "Reviewed subject",
            text: "This body is intentionally long enough for the request contract.",
            approved: true
          })
        })
      );

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        code: "LEGACY_OUTREACH_SEND_DISABLED"
      });
      expect(providerFetch).not.toHaveBeenCalled();
    }
  );

  it.each(productionRuntimeCases)(
    "does not reach Mailgun in %s even when every legacy variable is enabled",
    async (_name, marker) => {
      stubLegacyRouteEnv(marker);
      const providerFetch = vi.fn();
      vi.stubGlobal("fetch", providerFetch);

      const response = await postLegacyOutreachEmail(validLegacyRouteRequest());

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({ code: "LEGACY_OUTREACH_SEND_DISABLED" });
      expect(providerFetch).not.toHaveBeenCalled();
    }
  );

  it("allows one explicitly enabled development request through both gates", async () => {
    stubLegacyRouteEnv({ NODE_ENV: "development" });
    const providerFetch = vi.fn(async () => new Response(
      JSON.stringify({ id: "dev-message-id", message: "Queued" }),
      { status: 200, headers: { "content-type": "application/json" } }
    ));
    vi.stubGlobal("fetch", providerFetch);

    const response = await postLegacyOutreachEmail(validLegacyRouteRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "queued", id: "dev-message-id" });
    expect(providerFetch).toHaveBeenCalledTimes(1);
  });
});

describe("independent legacy Mailgun provider gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each(productionRuntimeCases)("blocks direct provider invocation in %s", async (_name, marker) => {
    stubLegacyProviderEnv(marker);
    const providerFetch = vi.fn();
    vi.stubGlobal("fetch", providerFetch);

    await expect(sendMailgunOutreachEmail(
      validMailgunConfig(),
      validOutreachEmail()
    )).rejects.toMatchObject({ code: "LEGACY_OUTREACH_SEND_DISABLED", status: 503 });
    expect(providerFetch).not.toHaveBeenCalled();
  });
});

describe("outreach templates", () => {
  it("provides multiple approved outreach templates", () => {
    expect(outreachTemplates.map((template) => template.id)).toEqual(["playlist-curator", "blog-channel", "radio-dj", "label-sync", "follow-up"]);
  });

  it("renders the playlist curator template with recipient context", () => {
    const rendered = renderOutreachTemplate(getOutreachTemplate("playlist-curator"), {
      nameOrTeam: "Groove Team",
      relevance: "your latin and reggae playlist"
    });

    expect(rendered.subject).toBe("MarcsMusic playlist submission");
    expect(rendered.campaign).toBe("playlist-outreach");
    expect(rendered.text).toContain("Hello Groove Team,");
    expect(rendered.text).toContain("because of your latin and reggae playlist.");
    expect(rendered.text).toContain(defaultOutreachLinks.playlistUrl);
    expect(rendered.text).toContain("MP3 files:");
    expect(rendered.text).toContain("If this is not relevant for your inbox");
  });

  it("falls back to neutral placeholder values", () => {
    const rendered = renderOutreachTemplate(getOutreachTemplate("follow-up"));

    expect(rendered.text).toContain("Hello there,");
    expect(rendered.text).toContain("your work with independent music");
    expect(defaultOutreachLinks.soundcloudDownloadsUrl).toBe("https://soundcloud.com/artists");
  });
});

function developmentLegacyEnv() {
  return { NODE_ENV: "development", LEGACY_OUTREACH_SEND_ENABLED: "true" };
}

function validMailgunConfig() {
  return {
    apiKey: "key-test",
    baseUrl: "https://api.mailgun.net",
    domain: "mg.example.com",
    fromEmail: "outreach@mg.example.com",
    fromName: "MarcsMusic"
  };
}

function validOutreachEmail() {
  return {
    toEmail: "reviewer@example.com",
    subject: "Reviewed subject",
    text: "This body is intentionally long enough for the request contract."
  };
}

function stubLegacyRouteEnv(marker: Record<string, string>) {
  stubLegacyProviderEnv(marker);
  vi.stubEnv("OUTREACH_MAIL_TOKEN", "test-token");
  vi.stubEnv("MAILGUN_API_KEY", "key-test");
  vi.stubEnv("MAILGUN_DOMAIN", "mg.example.com");
  vi.stubEnv("MAILGUN_BASE_URL", "https://api.mailgun.net");
  vi.stubEnv("OUTREACH_FROM_EMAIL", "outreach@mg.example.com");
}

function stubLegacyProviderEnv(marker: Record<string, string>) {
  for (const name of [
    "NODE_ENV",
    "RAILWAY_ENVIRONMENT",
    "RAILWAY_ENVIRONMENT_ID",
    "RAILWAY_ENVIRONMENT_NAME",
    "RAILWAY_PROJECT_ID",
    "RAILWAY_SERVICE_ID"
  ]) vi.stubEnv(name, "");
  vi.stubEnv("LEGACY_OUTREACH_SEND_ENABLED", "true");
  for (const [name, value] of Object.entries(marker)) vi.stubEnv(name, value);
}

function validLegacyRouteRequest() {
  return new NextRequest("http://localhost/api/outreach/email", {
    method: "POST",
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json"
    },
    body: JSON.stringify({ ...validOutreachEmail(), approved: true })
  });
}
