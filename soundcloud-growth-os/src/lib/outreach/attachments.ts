import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { outreachAttachments } from "./attachmentCatalog";

export type PreparedOutreachAttachment = {
  filename: string;
  contentType: string;
  bytes: ArrayBuffer;
  size: number;
};

// Keep raw MP3 bytes comfortably below Mailgun's total message-size limit after MIME overhead.
const maxAttachmentBytes = 15 * 1024 * 1024;

export class OutreachAttachmentError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "OutreachAttachmentError";
    this.status = status;
  }
}

function attachmentRoot(env: Record<string, string | undefined>) {
  const root = env.OUTREACH_MP3_ROOT?.trim() || "outreach-mp3";
  if (root.startsWith("/") || root.split(/[\\/]/).includes("..")) {
    throw new OutreachAttachmentError("OUTREACH_MP3_ROOT must be a relative directory inside the app bundle.", 503);
  }
  return root;
}

function uniqueAttachmentIds(ids: string[]) {
  return [...new Set(ids)];
}

export async function prepareOutreachAttachments(ids: string[], env: Record<string, string | undefined> = process.env) {
  const selectedIds = uniqueAttachmentIds(ids);
  if (!selectedIds.length) return [];

  const selected = selectedIds.map((id) => {
    const attachment = outreachAttachments.find((candidate) => candidate.id === id);
    if (!attachment) {
      throw new OutreachAttachmentError(`Unknown MP3 attachment: ${id}`);
    }
    return attachment;
  });

  const root = attachmentRoot(env);
  const stats = await Promise.all(
    selected.map(async (attachment) => {
      const filePath = join(/*turbopackIgnore: true*/ process.cwd(), root, attachment.relativePath);
      try {
        const fileStat = await stat(filePath);
        if (!fileStat.isFile()) {
          throw new OutreachAttachmentError(`MP3 attachment is not a file: ${attachment.filename}`);
        }
        return { attachment, filePath, size: fileStat.size };
      } catch (error) {
        if (error instanceof OutreachAttachmentError) throw error;
        throw new OutreachAttachmentError(`MP3 attachment is not available: ${attachment.filename}`, 503);
      }
    })
  );

  const totalBytes = stats.reduce((sum, item) => sum + item.size, 0);
  if (totalBytes > maxAttachmentBytes) {
    throw new OutreachAttachmentError("Selected MP3 attachments are too large for one outreach email. Choose fewer tracks.");
  }

  return Promise.all(
    stats.map(async ({ attachment, filePath, size }): Promise<PreparedOutreachAttachment> => {
      const bytes = await readFile(filePath);
      const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      return {
        filename: attachment.filename,
        contentType: "audio/mpeg",
        bytes: arrayBuffer,
        size
      };
    })
  );
}
