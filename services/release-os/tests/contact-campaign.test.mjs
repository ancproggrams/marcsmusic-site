import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createContactSegmentService } from "../src/application/contacts/contact-segment-service.mjs";
import { createNewMusicCampaignService } from "../src/application/email/new-music-campaign-service.mjs";
import { EspoCrmClient } from "../src/infrastructure/espocrm/espocrm-client.mjs";
import { JsonStore, createDefaultState } from "../src/infrastructure/storage/json-store.mjs";

describe("contacts and campaigns", () => {
  it("selects EspoCRM recipients by segment and excludes suppressed/duplicates", async () => {
    const segmentService = createContactSegmentService({
      espocrmClient: new EspoCrmClient({
        contacts: fixtureContacts()
      })
    });

    const segment = await segmentService.selectRecipients({
      selectedTypes: ["radio_station", "dj"],
      selectedTags: ["pop"],
      selectedLanguages: ["nl", "en"],
      artistSlug: "marc-rene"
    });

    assert.equal(segment.count, 2);
    assert.deepEqual(
      segment.recipients.map((recipient) => recipient.email).sort(),
      ["dj@example.com", "radio@example.com"]
    );
    assert.ok(segment.skipped.some((entry) => entry.reason === "unsubscribed"));
    assert.ok(segment.skipped.some((entry) => entry.reason === "duplicate_email"));
  });

  it("previews and sends Mailgun campaign messages with tags and English fallback", async () => {
    const dir = await mkdtemp(join(tmpdir(), "marcsmusic-campaign-"));
    const store = new JsonStore({ filePath: join(dir, "store.json"), initialState: createDefaultState() });
    const sentMessages = [];
    const campaignService = createNewMusicCampaignService({
      store,
      contactSegmentService: createContactSegmentService({
        espocrmClient: new EspoCrmClient({ contacts: fixtureContacts() })
      }),
      mailProvider: {
        async sendMessage(message) {
          sentMessages.push(message);
          return { id: `msg-${sentMessages.length}`, message: "Queued" };
        }
      }
    });
    const release = {
      id: "rel-test",
      title: "New Track",
      artistDisplayName: "Marc Rene",
      genre: "Pop"
    };
    const artist = { id: "artist_marc_rene", slug: "marc-rene", displayName: "Marc Rene" };
    const playerEntry = {
      playerUrl: "https://www.marcsmusic.nl/#listen",
      mp3DownloadUrl: "/assets/audio/new-track.mp3"
    };

    const preview = await campaignService.previewCampaign({
      release,
      playerEntry,
      artist,
      input: {
        selectedTypes: ["radio_station", "dj"],
        selectedTags: ["pop"]
      }
    });

    assert.equal(preview.recipientCount, 2);
    assert.equal(preview.languageBreakdown.nl, 1);
    assert.equal(preview.languageBreakdown.en, 1);

    const result = await campaignService.sendCampaign({
      release,
      playerEntry,
      artist,
      input: {
        selectedTypes: ["radio_station", "dj"],
        selectedTags: ["pop"]
      }
    });

    assert.equal(result.sent, 2);
    assert.ok(sentMessages.every((message) => message.tags.includes("new-music")));
    assert.ok(sentMessages.every((message) => message.tags.includes("release:rel-test")));
  });

  it("fails when English fallback templates are missing", async () => {
    const campaignService = createNewMusicCampaignService({
      store: new JsonStore({ filePath: join(await mkdtemp(join(tmpdir(), "marcsmusic-campaign-")), "store.json") }),
      contactSegmentService: createContactSegmentService({
        espocrmClient: new EspoCrmClient({ contacts: [] })
      })
    });

    await assert.rejects(
      () =>
        campaignService.previewCampaign({
          release: { id: "rel", title: "Track", artistDisplayName: "Artist" },
          artist: { slug: "artist", displayName: "Artist" },
          input: {
            subjectByLanguage: { nl: "Hallo" },
            messageByLanguage: { nl: "Body" }
          }
        }),
      /English subject and message/u
    );
  });
});

function fixtureContacts() {
  return [
    {
      id: "1",
      email: "radio@example.com",
      name: "Radio",
      type: "radio_station",
      language: "nl",
      tags: ["pop"],
      artistAudiences: ["marc-rene"],
      status: "active"
    },
    {
      id: "2",
      email: "dj@example.com",
      name: "DJ",
      type: "dj",
      language: "en",
      tags: ["pop"],
      artistAudiences: ["marc-rene"],
      status: "active"
    },
    {
      id: "3",
      email: "dj@example.com",
      type: "dj",
      language: "en",
      tags: ["pop"],
      artistAudiences: ["marc-rene"],
      status: "active"
    },
    {
      id: "4",
      email: "old@example.com",
      type: "dj",
      language: "en",
      tags: ["pop"],
      artistAudiences: ["marc-rene"],
      unsubscribed: true
    }
  ];
}

