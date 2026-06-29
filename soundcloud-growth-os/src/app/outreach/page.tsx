import { OutreachMailForm } from "./OutreachMailForm";

export const dynamic = "force-dynamic";

function mailgunStatus() {
  const configured = Boolean(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN && process.env.OUTREACH_FROM_EMAIL && process.env.OUTREACH_MAIL_TOKEN);
  const domain = process.env.MAILGUN_DOMAIN || "Not configured";
  const baseUrl = process.env.MAILGUN_BASE_URL || "https://api.mailgun.net";

  return { configured, domain, baseUrl };
}

export default function OutreachPage() {
  const status = mailgunStatus();

  return (
    <section>
      <div className="page-head">
        <p className="eyebrow">Outreach</p>
        <h1>Send approved outreach through Mailgun.</h1>
        <p className="lead">Use reusable templates, personalize the relevance, then send one plain-text recipient at a time. Tracking stays off by default.</p>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <article className="card metric">
          <p className="eyebrow">Mailgun</p>
          <strong className={status.configured ? "good" : "warning"}>{status.configured ? "Configured" : "Pending"}</strong>
          <p className="muted">Domain: {status.domain}</p>
        </article>
        <article className="card metric">
          <p className="eyebrow">Endpoint</p>
          <strong>{status.baseUrl.replace(/^https?:\/\//, "")}</strong>
          <p className="muted">API key is only read by the server.</p>
        </article>
      </div>

      <OutreachMailForm />
    </section>
  );
}
