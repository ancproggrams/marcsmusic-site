import { describe, expect, it } from "vitest";
import { lintTrackMetadata } from "../lib/growth/metadata";
import { parseSoundCloudTagList } from "../lib/growth/soundcloudSync";

describe("track metadata guardrails", () => {
  it("parses SoundCloud tag lists with quoted multi-word tags", () => {
    expect(parseSoundCloudTagList('Electronic House "Feel Good" Summer')).toEqual(["Electronic", "House", "Feel Good", "Summer"]);
  });

  it("flags spam-like metadata instead of recommending manipulation", () => {
    const issues = lintTrackMetadata({
      title: "Weekend Mode",
      artistName: "MarcsMusic",
      genre: "Electronic",
      tags: ["EDM", "free plays", "party"],
      permalinkUrl: "https://soundcloud.com/marcsmusic-557850401/weekend-mode"
    });

    expect(issues.some((issue) => issue.severity === "error" && issue.field === "tags")).toBe(true);
  });
});
