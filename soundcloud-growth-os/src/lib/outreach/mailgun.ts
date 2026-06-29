import { Buffer } from "node:buffer";
import type { PreparedOutreachAttachment } from "./attachments";

export type MailgunConfig = {
  apiKey: string;
  baseUrl: string;
  domain: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
};

type Env = Record<string, string | undefined>;

export type OutreachEmail = {
  toEmail: string;
  toName?: string;
  subject: string;
  text: string;
  campaign?: string;
  attachments?: PreparedOutreachAttachment[];
};

export type MailgunSendResult = {
  id?: string;
  message: string;
};

export class MailgunConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailgunConfigurationError";
  }
}

export class MailgunSendError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(message: string, status: number, detail: string) {
    super(message);
    this.name = "MailgunSendError";
    this.status = status;
    this.detail = detail;
  }
}

function requiredEnv(env: Env, key: string) {
  const value = env[key]?.trim();
  if (!value) {
    throw new MailgunConfigurationError(`${key} is required before outreach email can be sent.`);
  }
  return value;
}

export function getMailgunConfig(env: Env = process.env): MailgunConfig {
  const baseUrl = (env.MAILGUN_BASE_URL?.trim() || "https://api.eu.mailgun.net").replace(/\/+$/, "");

  return {
    apiKey: requiredEnv(env, "MAILGUN_API_KEY"),
    baseUrl,
    domain: requiredEnv(env, "MAILGUN_DOMAIN"),
    fromEmail: requiredEnv(env, "OUTREACH_FROM_EMAIL"),
    fromName: env.OUTREACH_FROM_NAME?.trim() || "MarcsMusic",
    replyTo: env.OUTREACH_REPLY_TO?.trim() || undefined
  };
}

function rejectHeaderInjection(value: string, field: string) {
  if (/[\r\n]/.test(value)) {
    throw new MailgunConfigurationError(`${field} must not contain line breaks.`);
  }
}

function formatMailbox(email: string, name?: string) {
  rejectHeaderInjection(email, "email");
  if (!name?.trim()) return email;

  rejectHeaderInjection(name, "name");
  const escapedName = name.trim().replace(/["\\]/g, "\\$&");
  return `"${escapedName}" <${email}>`;
}

async function readResponseDetail(response: Response) {
  const body = await response.text().catch(() => "");
  return body.slice(0, 1000);
}

export async function sendMailgunOutreachEmail(
  config: MailgunConfig,
  email: OutreachEmail,
  options: { timeoutMs?: number } = {}
): Promise<MailgunSendResult> {
  rejectHeaderInjection(email.subject, "subject");
  const timeoutMs = options.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const form = new FormData();

  form.set("from", formatMailbox(config.fromEmail, config.fromName));
  form.set("to", formatMailbox(email.toEmail, email.toName));
  form.set("subject", email.subject);
  form.set("text", email.text);
  form.set("o:tracking", "no");
  form.set("o:tracking-clicks", "no");
  form.set("o:tracking-opens", "no");

  if (config.replyTo) {
    form.set("h:Reply-To", formatMailbox(config.replyTo));
  }

  if (email.campaign) {
    form.set("o:tag", email.campaign);
  }

  for (const attachment of email.attachments ?? []) {
    form.append("attachment", new Blob([attachment.bytes], { type: attachment.contentType }), attachment.filename);
  }

  try {
    const response = await fetch(`${config.baseUrl}/v3/${encodeURIComponent(config.domain)}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${config.apiKey}`).toString("base64")}`
      },
      body: form,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new MailgunSendError("Mailgun rejected the outreach email.", response.status, await readResponseDetail(response));
    }

    const payload = (await response.json().catch(() => ({}))) as Partial<MailgunSendResult>;
    return {
      id: payload.id,
      message: payload.message || "Queued for delivery by Mailgun."
    };
  } catch (error) {
    if (error instanceof MailgunSendError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new MailgunSendError("Mailgun request timed out.", 504, `No response within ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
