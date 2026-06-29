export const forbiddenAutomations = [
  "fake_plays",
  "auto_follow",
  "auto_unfollow",
  "auto_like",
  "auto_repost",
  "auto_comment",
  "auto_dm",
  "comment_spam",
  "dm_spam",
  "scraping",
  "stream_ripping",
  "ai_training_on_third_party_soundcloud_content"
] as const;

export type PublicAction =
  | "comment"
  | "follow"
  | "unfollow"
  | "like"
  | "repost"
  | "dm"
  | "upload"
  | "delete"
  | "paid_promotion";

export function requireHumanApproval(action: PublicAction): never {
  throw new Error(
    `Blocked ${action}: public-facing SoundCloud actions must be user-initiated and human-approved. Generate a draft instead.`
  );
}

export function assertReadOnlyResearch(url: string, method = "GET") {
  if (!url.startsWith("https://api.soundcloud.com/")) {
    throw new Error("SoundCloud Growth OS only uses the official SoundCloud API for SoundCloud data access.");
  }

  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod !== "GET" && normalizedMethod !== "HEAD") {
    throw new Error(`Blocked ${normalizedMethod}: SoundCloud API access is read-only in this OS.`);
  }
}
