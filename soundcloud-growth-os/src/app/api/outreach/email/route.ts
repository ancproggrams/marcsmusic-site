import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OutreachAttachmentError, prepareOutreachAttachments } from "@/lib/outreach/attachments";
import { getMailgunConfig, MailgunConfigurationError, MailgunSendError, sendMailgunOutreachEmail } from "@/lib/outreach/mailgun";
import { assertHumanApprovedOutreach, assertOutreachRateLimit, assertRecipientAllowed, OutreachPolicyError, requireOutreachMailToken } from "@/lib/outreach/policy";

export const runtime = "nodejs";

const outreachEmailSchema = z.object({
  toEmail: z.string().trim().email().max(254),
  toName: z.string().trim().max(120).optional(),
  subject: z.string().trim().min(3).max(160),
  text: z.string().trim().min(20).max(4000),
  campaign: z.string().trim().max(80).optional(),
  attachmentIds: z.array(z.string().trim().min(1).max(80)).max(6).optional(),
  approved: z.literal(true)
});

export async function POST(request: NextRequest) {
  let tokenFingerprint: string;

  try {
    tokenFingerprint = requireOutreachMailToken(request.headers);
  } catch (error) {
    if (error instanceof OutreachPolicyError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = outreachEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid outreach email request.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    assertHumanApprovedOutreach(parsed.data.approved);
    assertRecipientAllowed(parsed.data.toEmail);
    const attachments = await prepareOutreachAttachments(parsed.data.attachmentIds ?? []);
    const rateLimit = assertOutreachRateLimit(tokenFingerprint);

    const result = await sendMailgunOutreachEmail(getMailgunConfig(), {
      toEmail: parsed.data.toEmail,
      toName: parsed.data.toName,
      subject: parsed.data.subject,
      text: parsed.data.text,
      campaign: parsed.data.campaign,
      attachments
    });

    return NextResponse.json({
      status: "queued",
      id: result.id,
      message: result.message,
      rateLimit,
      attachments: attachments.map((attachment) => ({
        filename: attachment.filename,
        size: attachment.size
      }))
    });
  } catch (error) {
    if (error instanceof OutreachPolicyError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    if (error instanceof MailgunConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (error instanceof OutreachAttachmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof MailgunSendError) {
      return NextResponse.json({ error: error.message, detail: error.detail }, { status: error.status });
    }

    throw error;
  }
}
