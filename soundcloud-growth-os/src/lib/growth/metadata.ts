export type TrackMetadataDraft = {
  title: string;
  artistName: string;
  genre?: string | null;
  tags: string[];
  description?: string | null;
  permalinkUrl?: string | null;
};

export type MetadataIssue = {
  severity: "info" | "warning" | "error";
  field: keyof TrackMetadataDraft;
  message: string;
};

const misleadingTagPatterns = [/viral/i, /guaranteed/i, /free\s*plays/i, /follow\s*for\s*follow/i];

export function lintTrackMetadata(track: TrackMetadataDraft): MetadataIssue[] {
  const issues: MetadataIssue[] = [];

  if (!track.title.trim()) {
    issues.push({ severity: "error", field: "title", message: "Track title is required." });
  }

  if (!track.artistName.trim()) {
    issues.push({ severity: "error", field: "artistName", message: "Artist name must be consistent and present." });
  }

  if (!track.genre?.trim()) {
    issues.push({ severity: "warning", field: "genre", message: "A primary genre improves search and related-track context." });
  }

  if (track.tags.length < 3) {
    issues.push({ severity: "warning", field: "tags", message: "Use at least 3 specific, truthful tags for genre, mood, and scene." });
  }

  for (const tag of track.tags) {
    if (misleadingTagPatterns.some((pattern) => pattern.test(tag))) {
      issues.push({ severity: "error", field: "tags", message: `Misleading or spam-like tag detected: ${tag}` });
    }
  }

  if (!track.description?.trim()) {
    issues.push({ severity: "info", field: "description", message: "Add concise release context and a human CTA when SoundCloud saves this field." });
  }

  if (track.permalinkUrl && !track.permalinkUrl.includes("soundcloud.com")) {
    issues.push({ severity: "warning", field: "permalinkUrl", message: "Permalink URL should be a canonical SoundCloud URL." });
  }

  return issues;
}
