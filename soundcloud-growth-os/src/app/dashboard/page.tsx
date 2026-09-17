import { MetricCard } from "@/components/MetricCard";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const hasDatabaseConfig = Boolean(process.env.DATABASE_URL);
  const [trackCount, experimentCount, openReplies, latestMetrics] = hasDatabaseConfig
    ? await Promise.all([
        prisma.track.count().catch(() => 0),
        prisma.experiment.count().catch(() => 0),
        prisma.comment.count({ where: { needsReply: true } }).catch(() => 0),
        prisma.dailyTrackMetric
          .findMany({
            orderBy: { date: "desc" },
            take: 5,
            include: { track: true }
          })
          .catch(() => [])
      ])
    : [0, 0, 0, []];

  return (
    <section>
      <div className="page-head">
        <p className="eyebrow">MVP dashboard</p>
        <h1>Find real SoundCloud momentum before it fades.</h1>
        <p className="lead">
          This dashboard is intentionally white-hat: it measures, prioritizes, drafts, and reports. It does not automate plays,
          follows, likes, reposts, comments, or DMs.
        </p>
      </div>

      <div className="grid">
        <MetricCard label="Tracks" value={trackCount} note="Imported through the official SoundCloud API." />
        <MetricCard label="Open replies" value={openReplies} note="Draft replies only; posting is manual." />
        <MetricCard label="Experiments" value={experimentCount} note="Weekly growth hypotheses and decisions." />
      </div>

      {!hasDatabaseConfig ? (
        <div className="card stack" style={{ marginTop: 24 }}>
          <div>
            <p className="eyebrow">Setup required</p>
            <h2>Database is not configured yet.</h2>
          </div>
          <p className="muted">
            Copy `.env.example` to `.env`, set `DATABASE_URL`, then run Prisma generate and migrate before syncing SoundCloud.
          </p>
        </div>
      ) : null}

      <div className="card stack" style={{ marginTop: 24 }}>
        <div>
          <p className="eyebrow">Latest snapshots</p>
          <h2>Recent track metrics</h2>
        </div>
        {latestMetrics.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Track</th>
                <th>Date</th>
                <th>Plays</th>
                <th>Likes</th>
                <th>Comments</th>
                <th>Reposts</th>
                <th>Engagement</th>
              </tr>
            </thead>
            <tbody>
              {latestMetrics.map((metric) => (
                <tr key={metric.id}>
                  <td>{metric.track.title}</td>
                  <td>{metric.date.toISOString().slice(0, 10)}</td>
                  <td>{metric.plays}</td>
                  <td>{metric.likes}</td>
                  <td>{metric.comments}</td>
                  <td>{metric.reposts}</td>
                  <td>{metric.engagementScore.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No metrics yet. Connect SoundCloud, sync tracks, then run the daily snapshot job.</p>
        )}
      </div>
    </section>
  );
}
