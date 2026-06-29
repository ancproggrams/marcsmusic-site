import { prisma } from "@/lib/db/prisma";
import { lintTrackMetadata } from "@/lib/growth/metadata";

export const dynamic = "force-dynamic";

export default async function TracksPage() {
  const hasDatabaseConfig = Boolean(process.env.DATABASE_URL);
  const tracks = hasDatabaseConfig
    ? await prisma.track
        .findMany({
          orderBy: { createdAt: "desc" },
          include: {
            dailyMetrics: {
              orderBy: { date: "desc" },
              take: 1
            }
          }
        })
        .catch(() => [])
    : [];

  if (!hasDatabaseConfig) {
    return (
      <section>
        <div className="page-head">
          <p className="eyebrow">Tracks</p>
          <h1>Metadata, ratios, and next actions.</h1>
          <p className="lead">
            Keep track metadata truthful, specific, and measurable. Misleading tags and automated engagement are blocked by policy.
          </p>
        </div>

        <article className="card stack">
          <h2>Database is not configured yet.</h2>
          <p className="muted">Copy `.env.example` to `.env`, set `DATABASE_URL`, then run Prisma generate and migrate before syncing tracks.</p>
        </article>
      </section>
    );
  }

  return (
    <section>
      <div className="page-head">
        <p className="eyebrow">Tracks</p>
        <h1>Metadata, ratios, and next actions.</h1>
        <p className="lead">
          Keep track metadata truthful, specific, and measurable. Misleading tags and automated engagement are blocked by policy.
        </p>
      </div>

      {tracks.length ? (
        <div className="stack">
          {tracks.map((track) => {
            const issues = lintTrackMetadata({
              title: track.title,
              artistName: "MarcsMusic",
              genre: track.genre,
              tags: track.tags,
              permalinkUrl: track.permalinkUrl
            });
            const latest = track.dailyMetrics[0];

            return (
              <article className="card stack" key={track.id}>
                <div className="grid-2">
                  <div className="stack">
                    <div>
                      <p className="eyebrow">{track.genre || "No genre"}</p>
                      <h2>{track.title}</h2>
                    </div>
                    <a className="button" href={track.permalinkUrl} target="_blank" rel="noreferrer">
                      Open on SoundCloud
                    </a>
                    <div className="pill-row">
                      {track.tags.map((tag) => (
                        <span className="pill" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="stack">
                    <p className="muted">
                      Latest: {latest ? `${latest.plays} plays · ${latest.likes} likes · ${latest.comments} comments · ${latest.reposts} reposts` : "No metrics yet"}
                    </p>
                    {issues.length ? (
                      <ul>
                        {issues.map((issue) => (
                          <li className={issue.severity === "error" ? "danger" : issue.severity === "warning" ? "warning" : "muted"} key={`${issue.field}-${issue.message}`}>
                            {issue.message}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="good">Metadata passes the current linter.</p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <article className="card stack">
          <h2>No tracks synced yet.</h2>
          <p className="muted">Connect SoundCloud and call the sync endpoint to import your own tracks through the official API.</p>
        </article>
      )}
    </section>
  );
}
