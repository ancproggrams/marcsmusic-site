"use client";

import { FormEvent, useState } from "react";
import {
  outreachAttachments,
  type OutreachAttachmentId
} from "@/lib/outreach/attachmentCatalog";
import {
  defaultOutreachLinks,
  getOutreachTemplate,
  outreachTemplates,
  renderOutreachTemplate,
  type OutreachTemplateId
} from "@/lib/outreach/templates";

type FormStatus =
  | { type: "idle"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

const defaultTemplateId: OutreachTemplateId = "playlist-curator";
const defaultRenderedTemplate = renderOutreachTemplate(getOutreachTemplate(defaultTemplateId));

function mp3NoteForSelectedTracks(selectedAttachmentIds: OutreachAttachmentId[]) {
  if (!selectedAttachmentIds.length) {
    return "I can send direct MP3 files for review, or attach a smaller selection if that is easier for you.";
  }

  const labels = outreachAttachments
    .filter((attachment) => selectedAttachmentIds.includes(attachment.id))
    .map((attachment) => attachment.label);

  return `I attached these MP3 files for direct review: ${labels.join(", ")}.`;
}

export function OutreachMailForm() {
  const [status, setStatus] = useState<FormStatus>({ type: "idle", message: "" });
  const [sending, setSending] = useState(false);
  const [templateId, setTemplateId] = useState<OutreachTemplateId>(defaultTemplateId);
  const [nameOrTeam, setNameOrTeam] = useState("");
  const [relevance, setRelevance] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState<string>(defaultOutreachLinks.playlistUrl);
  const [spotifyProfileUrl, setSpotifyProfileUrl] = useState<string>(defaultOutreachLinks.spotifyProfileUrl);
  const [soundcloudDownloadsUrl, setSoundcloudDownloadsUrl] = useState<string>(defaultOutreachLinks.soundcloudDownloadsUrl);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<OutreachAttachmentId[]>([]);
  const [campaign, setCampaign] = useState(defaultRenderedTemplate.campaign);
  const [subject, setSubject] = useState(defaultRenderedTemplate.subject);
  const [text, setText] = useState(defaultRenderedTemplate.text);

  const selectedTemplate = getOutreachTemplate(templateId);

  function applySelectedTemplate() {
    const rendered = renderOutreachTemplate(selectedTemplate, {
      nameOrTeam,
      relevance,
      playlistUrl,
      spotifyProfileUrl,
      soundcloudDownloadsUrl,
      mp3Note: mp3NoteForSelectedTracks(selectedAttachmentIds)
    });

    setCampaign(rendered.campaign);
    setSubject(rendered.subject);
    setText(rendered.text);
  }

  function resetTemplateState() {
    setTemplateId(defaultTemplateId);
    setNameOrTeam("");
    setRelevance("");
    setPlaylistUrl(defaultOutreachLinks.playlistUrl);
    setSpotifyProfileUrl(defaultOutreachLinks.spotifyProfileUrl);
    setSoundcloudDownloadsUrl(defaultOutreachLinks.soundcloudDownloadsUrl);
    setSelectedAttachmentIds([]);
    setCampaign(defaultRenderedTemplate.campaign);
    setSubject(defaultRenderedTemplate.subject);
    setText(defaultRenderedTemplate.text);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const token = String(formData.get("token") || "");

    setSending(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch("/api/outreach/email", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          toEmail: formData.get("toEmail"),
          toName: formData.get("toName") || undefined,
          subject: formData.get("subject"),
          text: formData.get("text"),
          campaign: formData.get("campaign") || undefined,
          attachmentIds: selectedAttachmentIds,
          approved: formData.get("approved") === "on"
        })
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Outreach email could not be queued.");
      }

      form.reset();
      resetTemplateState();
      setStatus({ type: "success", message: payload.message || "Queued for delivery by Mailgun." });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Outreach email could not be queued." });
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="card stack form" onSubmit={handleSubmit}>
      <div className="template-panel stack">
        <div className="form-grid">
          <label className="field">
            Template
            <select value={templateId} onChange={(event) => setTemplateId(event.target.value as OutreachTemplateId)}>
              {outreachTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Relevance
            <input
              value={relevance}
              onChange={(event) => setRelevance(event.target.value)}
              type="text"
              placeholder="your reggae/world playlist or recent coverage"
              maxLength={220}
            />
          </label>
        </div>
        <p className="muted">{selectedTemplate.audience}</p>
        <div className="form-grid">
          <label className="field">
            Playlist URL
            <input value={playlistUrl} onChange={(event) => setPlaylistUrl(event.target.value)} type="url" />
          </label>
          <label className="field">
            Spotify profile URL
            <input value={spotifyProfileUrl} onChange={(event) => setSpotifyProfileUrl(event.target.value)} type="url" />
          </label>
        </div>
        <label className="field">
          SoundCloud downloads URL
          <input value={soundcloudDownloadsUrl} onChange={(event) => setSoundcloudDownloadsUrl(event.target.value)} type="url" />
        </label>
        <div className="actions">
          <button className="button" type="button" onClick={applySelectedTemplate}>
            Apply template
          </button>
        </div>
      </div>

      <fieldset className="field-set">
        <legend>Optional MP3 attachments</legend>
        <div className="attachment-grid">
          {outreachAttachments.map((attachment) => (
            <label className="check-row" key={attachment.id}>
              <input
                type="checkbox"
                checked={selectedAttachmentIds.includes(attachment.id)}
                onChange={(event) => {
                  setSelectedAttachmentIds((current) =>
                    event.target.checked ? [...current, attachment.id] : current.filter((id) => id !== attachment.id)
                  );
                }}
              />
              {attachment.label}
            </label>
          ))}
        </div>
        <p className="muted">Select only the strongest fits. The server blocks oversized MP3 bundles.</p>
      </fieldset>

      <div className="form-grid">
        <label className="field">
          Admin token
          <input name="token" type="password" autoComplete="off" required />
        </label>
        <label className="field">
          Campaign
          <input name="campaign" type="text" value={campaign} onChange={(event) => setCampaign(event.target.value)} maxLength={80} />
        </label>
      </div>

      <div className="form-grid">
        <label className="field">
          Recipient email
          <input name="toEmail" type="email" autoComplete="email" required />
        </label>
        <label className="field">
          Recipient name or team
          <input name="toName" type="text" autoComplete="name" value={nameOrTeam} onChange={(event) => setNameOrTeam(event.target.value)} maxLength={120} />
        </label>
      </div>

      <label className="field">
        Subject
        <input name="subject" type="text" value={subject} onChange={(event) => setSubject(event.target.value)} minLength={3} maxLength={160} required />
      </label>

      <label className="field">
        Message
        <textarea name="text" value={text} onChange={(event) => setText(event.target.value)} minLength={20} maxLength={4000} rows={10} required />
      </label>

      <label className="check-row">
        <input name="approved" type="checkbox" required />
        Human-approved single-recipient outreach
      </label>

      <div className="actions">
        <button className="button button-primary" type="submit" disabled={sending}>
          {sending ? "Sending..." : "Send via Mailgun"}
        </button>
        {status.message ? <p className={status.type === "success" ? "good" : status.type === "error" ? "danger" : "muted"}>{status.message}</p> : null}
      </div>
    </form>
  );
}
