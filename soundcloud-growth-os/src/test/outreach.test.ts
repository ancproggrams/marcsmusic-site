import { afterEach, describe, expect, it, vi } from "vitest";
import { getMailgunConfig, MailgunConfigurationError, sendMailgunOutreachEmail } from "../lib/outreach/mailgun";
import {
  assertHumanApprovedOutreach,
  assertOutreachRateLimit,
  assertRecipientAllowed,
  OutreachPolicyError,
  requireOutreachMailToken,
  resetOutreachRateLimits
} from "../lib/outreach/policy";
import { defaultOutreachLinks, getOutreachTemplate, outreachTemplates, renderOutreachTemplate } from "../lib/outreach/templates";

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
    vi.unstubAllGlobals();
  });

  it("posts a single plain-text message to Mailgun with tracking disabled", async () => {
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
