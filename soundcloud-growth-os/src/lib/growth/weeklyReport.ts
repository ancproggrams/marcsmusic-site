import type { DailyTrackMetric, Experiment, PrismaClient, Track } from "@prisma/client";
import { momentumScore, roundScore } from "./scoring";

export type WeeklyTrackSummary = {
  trackId: string;
  title: string;
  permalinkUrl: string;
  playsDelta: number;
  likesDelta: number;
  commentsDelta: number;
  repostsDelta: number;
  lastSnapshotPlaysDelta: number;
  latestEngagementScore: number;
  momentumScore: number;
};

export type WeeklyGrowthReport = {
  period: {
    since: string;
    until: string;
  };
  totals: {
    playsDelta: number;
    likesDelta: number;
    commentsDelta: number;
    repostsDelta: number;
  };
  topTracks: WeeklyTrackSummary[];
  openReplies: number;
  activeExperiments: Experiment[];
  nextActions: string[];
};

type MetricWithTrack = DailyTrackMetric & {
  track: Track;
};

function groupMetricsByTrack(metrics: MetricWithTrack[]) {
  const grouped = new Map<string, MetricWithTrack[]>();

  for (const metric of metrics) {
    const existing = grouped.get(metric.trackId) ?? [];
    existing.push(metric);
    grouped.set(metric.trackId, existing);
  }

  return grouped;
}

function buildTrackSummary(trackMetrics: MetricWithTrack[]): WeeklyTrackSummary {
  const sorted = [...trackMetrics].sort((a, b) => a.date.getTime() - b.date.getTime());
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  const playsDelta = Math.max(latest.plays - first.plays, 0);
  const playDeltas = sorted.slice(1).map((metric, index) => Math.max(metric.plays - sorted[index].plays, 0));
  const lastSnapshotPlaysDelta = playDeltas.at(-1) ?? playsDelta;
  const baselineDeltas = playDeltas.length > 1 ? playDeltas.slice(0, -1) : [];
  const averageDailyPlays = baselineDeltas.length
    ? baselineDeltas.reduce((sum, delta) => sum + delta, 0) / baselineDeltas.length
    : Math.max(playsDelta / Math.max(sorted.length - 1, 1), 1);

  return {
    trackId: latest.trackId,
    title: latest.track.title,
    permalinkUrl: latest.track.permalinkUrl,
    playsDelta,
    likesDelta: Math.max(latest.likes - first.likes, 0),
    commentsDelta: Math.max(latest.comments - first.comments, 0),
    repostsDelta: Math.max(latest.reposts - first.reposts, 0),
    lastSnapshotPlaysDelta,
    latestEngagementScore: latest.engagementScore,
    momentumScore: roundScore(momentumScore({ playsLast24h: lastSnapshotPlaysDelta, averageDailyPlaysLast14d: averageDailyPlays }))
  };
}

export async function buildWeeklyGrowthReport(prisma: PrismaClient, now = new Date()): Promise<WeeklyGrowthReport> {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const metrics = await prisma.dailyTrackMetric.findMany({
    where: { date: { gte: since } },
    include: { track: true },
    orderBy: [{ trackId: "asc" }, { date: "asc" }]
  });
  const summaries = [...groupMetricsByTrack(metrics).values()]
    .filter((trackMetrics) => trackMetrics.length > 0)
    .map(buildTrackSummary)
    .sort((a, b) => b.momentumScore - a.momentumScore || b.latestEngagementScore - a.latestEngagementScore || b.playsDelta - a.playsDelta);
  const openReplies = await prisma.comment.count({ where: { needsReply: true } });
  const activeExperiments = await prisma.experiment.findMany({
    where: {
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }]
    },
    orderBy: { startDate: "desc" },
    take: 5
  });

  return {
    period: {
      since: since.toISOString(),
      until: now.toISOString()
    },
    totals: summaries.reduce(
      (totals, summary) => ({
        playsDelta: totals.playsDelta + summary.playsDelta,
        likesDelta: totals.likesDelta + summary.likesDelta,
        commentsDelta: totals.commentsDelta + summary.commentsDelta,
        repostsDelta: totals.repostsDelta + summary.repostsDelta
      }),
      { playsDelta: 0, likesDelta: 0, commentsDelta: 0, repostsDelta: 0 }
    ),
    topTracks: summaries.slice(0, 5),
    openReplies,
    activeExperiments,
    nextActions: [
      "Review open comments and approve reply drafts manually.",
      "Pick one weekly experiment with a single primary metric.",
      "Update SoundCloud metadata manually only when the metadata linter flags a concrete issue.",
      "Research related SoundCloud scenes and save outreach targets without auto-following, auto-commenting, or auto-DMing."
    ]
  };
}

export function formatWeeklyGrowthReport(report: WeeklyGrowthReport) {
  const topTracks = report.topTracks.length
    ? report.topTracks
        .map(
          (track, index) =>
            `${index + 1}. ${track.title} - +${track.playsDelta} plays, +${track.likesDelta} likes, +${track.commentsDelta} comments, momentum ${track.momentumScore}`
        )
        .join("\n")
    : "No track snapshots in this period.";

  return `# SoundCloud Weekly Growth Report

Period: ${report.period.since.slice(0, 10)} to ${report.period.until.slice(0, 10)}

## Totals
- Plays delta: ${report.totals.playsDelta}
- Likes delta: ${report.totals.likesDelta}
- Comments delta: ${report.totals.commentsDelta}
- Reposts delta: ${report.totals.repostsDelta}
- Open manual replies: ${report.openReplies}
- Active experiments: ${report.activeExperiments.length}

## Top Tracks
${topTracks}

## Next Actions
${report.nextActions.map((action) => `- ${action}`).join("\n")}
`;
}
