import { randomUUID } from "node:crypto";
import { audit } from "../../infrastructure/storage/json-store.mjs";

const DEFAULT_LANGUAGES = ["nl", "en", "de", "fr", "es"];

export function createNewMusicCampaignService({ store, contactSegmentService, emailProvider, mailProvider }) {
  if (!store || !contactSegmentService) {
    throw new TypeError("campaign service requires store and contactSegmentService");
  }
  const provider = emailProvider ?? mailProvider;

  return Object.freeze({
    async previewCampaign({ release, playerEntry, artist, input }) {
      const templates = normalizeTemplates(input);
      const segment = await contactSegmentService.selectRecipients({
        ...input,
        artistSlug: artist?.slug
      });
      const campaign = createCampaignRecord(release, input, segment);
      const previews = segment.recipients.slice(0, 10).map((recipient) =>
        renderRecipientMessage({ recipient, release, playerEntry, artist, templates, campaignId: campaign.id })
      );

      return Object.freeze({
        campaign,
        recipientCount: segment.count,
        languageBreakdown: segment.languageBreakdown,
        typeBreakdown: segment.typeBreakdown,
        skippedCount: segment.skipped.length,
        sampleRecipients: Object.freeze(segment.recipients.slice(0, 10)),
        previews: Object.freeze(previews)
      });
    },

    async sendTest({ release, playerEntry, artist, input }) {
      if (!provider || typeof provider.sendMessage !== "function") {
        throw Object.assign(new Error("Email provider is not configured"), {
          statusCode: 503,
          code: "EMAIL_PROVIDER_NOT_CONFIGURED"
        });
      }

      const testRecipient = requireString(input.testRecipient, "testRecipient");
      const preview = await this.previewCampaign({ release, playerEntry, artist, input });
      const message = renderRecipientMessage({
        recipient: {
          email: testRecipient,
          language: input.testLanguage ?? "en",
          type: "test"
        },
        release,
        playerEntry,
        artist,
        templates: normalizeTemplates(input),
        campaignId: preview.campaign.id
      });
      const result = await provider.sendMessage(message);
      return Object.freeze({
        campaign: preview.campaign,
        result
      });
    },

    async sendCampaign({ release, playerEntry, artist, input }) {
      if (!provider || typeof provider.sendMessage !== "function") {
        throw Object.assign(new Error("Email provider is not configured"), {
          statusCode: 503,
          code: "EMAIL_PROVIDER_NOT_CONFIGURED"
        });
      }

      const templates = normalizeTemplates(input);
      const segment = await contactSegmentService.selectRecipients({
        ...input,
        artistSlug: artist?.slug
      });
      const campaign = createCampaignRecord(release, input, segment);
      const recipients = [];

      for (const recipient of segment.recipients) {
        const message = renderRecipientMessage({
          recipient,
          release,
          playerEntry,
          artist,
          templates,
          campaignId: campaign.id
        });

        try {
          const result = await provider.sendMessage(message);
          recipients.push({
            id: `campaign_recipient_${randomUUID()}`,
            campaignId: campaign.id,
            contactId: recipient.id,
            email: recipient.email,
            language: recipient.language,
            status: "sent",
            provider: result.provider ?? "email",
            providerMessageId: result.providerMessageId ?? result.id,
            idempotencyKey: result.idempotencyKey ?? message.idempotencyKey ?? message.correlationId,
            sentAt: new Date().toISOString()
          });
        } catch (error) {
          const outcomeUncertain = error?.outcomeUncertain === true || error?.deliveryUnknown === true;
          recipients.push({
            id: `campaign_recipient_${randomUUID()}`,
            campaignId: campaign.id,
            contactId: recipient.id,
            email: recipient.email,
            language: recipient.language,
            status: outcomeUncertain ? "reconcile_required" : "failed",
            outcomeUncertain,
            errorMessage: error.message
          });
        }
      }

      const reconciliationRequired = recipients.filter((recipient) => recipient.status === "reconcile_required").length;
      const campaignStatus = reconciliationRequired > 0 ? "sent_with_uncertainty" : "sent";

      await store.update((state) => {
        state.emailCampaigns.push({ ...campaign, status: campaignStatus });
        state.emailCampaignRecipients.push(...recipients);
        audit(state, "campaign.sent", { campaignId: campaign.id, releaseId: release.id, count: recipients.length });
      });

      return Object.freeze({
        campaign: Object.freeze({ ...campaign, status: campaignStatus }),
        recipients: Object.freeze(recipients),
        sent: recipients.filter((recipient) => recipient.status === "sent").length,
        failed: recipients.filter((recipient) => recipient.status === "failed").length,
        reconciliationRequired
      });
    },

    async getCampaign(campaignId) {
      const state = await store.read();
      const campaign = state.emailCampaigns.find((entry) => entry.id === campaignId);
      if (!campaign) {
        throw Object.assign(new Error(`Campaign not found: ${campaignId}`), {
          statusCode: 404,
          code: "CAMPAIGN_NOT_FOUND"
        });
      }
      return campaign;
    },

    async getCampaignRecipients(campaignId) {
      const state = await store.read();
      return state.emailCampaignRecipients.filter((entry) => entry.campaignId === campaignId);
    }
  });
}

function createCampaignRecord(release, input, segment) {
  return Object.freeze({
    id: input.campaignId ?? `campaign_${randomUUID()}`,
    releaseId: release.id,
    status: "previewed",
    selectedTags: Object.freeze([...(input.selectedTags ?? [])]),
    selectedTypes: Object.freeze([...(input.selectedTypes ?? [])]),
    selectedLanguages: Object.freeze([...(input.selectedLanguages ?? [])]),
    recipientCount: segment.count,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function normalizeTemplates(input) {
  const subjectByLanguage = input.subjectByLanguage ?? defaultSubjects();
  const messageByLanguage = input.messageByLanguage ?? defaultMessages();

  if (!subjectByLanguage.en || !messageByLanguage.en) {
    throw Object.assign(new Error("English subject and message templates are required for fallback"), {
      statusCode: 400,
      code: "ENGLISH_TEMPLATE_REQUIRED"
    });
  }

  return Object.freeze({
    subjectByLanguage,
    messageByLanguage
  });
}

function renderRecipientMessage({ recipient, release, playerEntry, artist, templates, campaignId }) {
  const language = DEFAULT_LANGUAGES.includes(recipient.language) ? recipient.language : "en";
  const subjectTemplate = templates.subjectByLanguage[language] ?? templates.subjectByLanguage.en;
  const bodyTemplate = templates.messageByLanguage[language] ?? templates.messageByLanguage.en;
  const values = {
    artistName: artist?.displayName ?? release.artistDisplayName ?? release.artist,
    releaseTitle: release.title,
    releaseGenre: release.genre ?? "",
    releaseDate: release.releaseDate ?? "",
    primaryReleaseUrl: release.primaryReleaseUrl ?? playerEntry?.playerUrl ?? "",
    playerUrl: playerEntry?.playerUrl ?? "",
    mp3DownloadUrl: playerEntry?.mp3DownloadUrl ?? "",
    wavDownloadUrl: playerEntry?.wavDownloadUrl ?? "",
    artistWebsiteUrl: artist?.websiteUrl ?? ""
  };
  const text = `${renderTemplate(bodyTemplate, values)}\n\n${footer(language)}`;

  return Object.freeze({
    to: recipient.email,
    subject: renderTemplate(subjectTemplate, values),
    text,
    tags: [
      "new-music",
      `release:${release.id}`,
      `campaign:${campaignId}`,
      `type:${recipient.type ?? "unknown"}`,
      `language:${language}`
    ],
    variables: {
      releaseId: release.id,
      campaignId,
      contactId: recipient.id
    },
    correlationId: `${campaignId}:${recipient.id ?? recipient.email}`
  });
}

function renderTemplate(template, values) {
  return String(template).replace(/\{\{([a-zA-Z0-9_]+)\}\}/gu, (_, key) => values[key] ?? "");
}

function defaultSubjects() {
  return {
    nl: "Nieuwe muziek: {{artistName}} - {{releaseTitle}}",
    en: "New music: {{artistName}} - {{releaseTitle}}",
    de: "Neue Musik: {{artistName}} - {{releaseTitle}}",
    fr: "Nouvelle musique : {{artistName}} - {{releaseTitle}}",
    es: "Nueva musica: {{artistName}} - {{releaseTitle}}"
  };
}

function defaultMessages() {
  return {
    nl: "Hoi,\n\n{{artistName}} heeft een nieuwe release: {{releaseTitle}}.\n\nLuister: {{playerUrl}}\nMP3: {{mp3DownloadUrl}}\nWAV: {{wavDownloadUrl}}",
    en: "Hi,\n\n{{artistName}} has a new release: {{releaseTitle}}.\n\nListen: {{playerUrl}}\nMP3: {{mp3DownloadUrl}}\nWAV: {{wavDownloadUrl}}",
    de: "Hallo,\n\n{{artistName}} hat eine neue Veroeffentlichung: {{releaseTitle}}.\n\nHoeren: {{playerUrl}}\nMP3: {{mp3DownloadUrl}}\nWAV: {{wavDownloadUrl}}",
    fr: "Bonjour,\n\n{{artistName}} a une nouvelle sortie : {{releaseTitle}}.\n\nEcouter : {{playerUrl}}\nMP3 : {{mp3DownloadUrl}}\nWAV : {{wavDownloadUrl}}",
    es: "Hola,\n\n{{artistName}} tiene un nuevo lanzamiento: {{releaseTitle}}.\n\nEscuchar: {{playerUrl}}\nMP3: {{mp3DownloadUrl}}\nWAV: {{wavDownloadUrl}}"
  };
}

function footer(language) {
  if (language === "nl") return "Afmelden: gebruik de unsubscribe-link of antwoord met AFMELDEN.";
  if (language === "de") return "Abmelden: Nutze den Unsubscribe-Link oder antworte mit ABMELDEN.";
  if (language === "fr") return "Desinscription : utilisez le lien unsubscribe ou repondez STOP.";
  if (language === "es") return "Baja: usa el enlace de unsubscribe o responde BAJA.";
  return "Unsubscribe: use the unsubscribe link or reply with UNSUBSCRIBE.";
}

function requireString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw Object.assign(new Error(`${fieldName} is required`), {
      statusCode: 400,
      code: "VALIDATION_ERROR"
    });
  }
  return value.trim();
}
