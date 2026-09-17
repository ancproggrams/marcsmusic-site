export type OutreachTemplateId =
  | "playlist-curator"
  | "blog-channel"
  | "radio-dj"
  | "label-sync"
  | "follow-up";

export type OutreachTemplateValues = {
  nameOrTeam?: string;
  relevance?: string;
  playlistUrl?: string;
  spotifyProfileUrl?: string;
  soundcloudDownloadsUrl?: string;
  mp3Note?: string;
};

export type OutreachTemplate = {
  id: OutreachTemplateId;
  title: string;
  audience: string;
  defaultCampaign: string;
  subject: string;
  body: string;
};

export const defaultOutreachLinks = {
  playlistUrl: "https://open.spotify.com/playlist/7MAFBX5fE0YFGY1bS3auhy?si=UrVl321CSfGOvy84_axqKQ",
  spotifyProfileUrl: "https://open.spotify.com/user/ueam9loyqz4wk2b024yip9qwm?si=9ae6507f86744d31",
  soundcloudDownloadsUrl: "https://soundcloud.com/artists"
} as const;

export const outreachTemplates: OutreachTemplate[] = [
  {
    id: "playlist-curator",
    title: "Playlist curator",
    audience: "Playlist owners, independent curators, small editorial channels.",
    defaultCampaign: "playlist-outreach",
    subject: "MarcsMusic playlist submission",
    body: `Hello {{nameOrTeam}},

I came across your platform because of {{relevance}}.

I am Marc Rene, releasing music as MarcsMusic.
I put together a playlist of my own tracks and thought a few of them might genuinely fit your lane.
The sound sits around reggae, latin, world and adjacent grooves.
If something clicks for your playlist, coverage or channel, I would love that. If not, no problem.

Playlist:
{{playlistUrl}}

Spotify profile:
{{spotifyProfileUrl}}

SoundCloud downloads:
{{soundcloudDownloadsUrl}}

MP3 files:
{{mp3Note}}

If you prefer, I can also send over the 2 or 3 strongest fits instead of the full playlist.

If this is not relevant for your inbox, just let me know and I will leave you out from future playlist mails.

Best,
Marc Rene
MarcsMusic
marc@marcsmusic.nl`
  },
  {
    id: "blog-channel",
    title: "Blog or channel",
    audience: "Music blogs, YouTube channels, newsletter editors, culture sites.",
    defaultCampaign: "coverage-outreach",
    subject: "MarcsMusic for possible coverage",
    body: `Hello {{nameOrTeam}},

I came across your platform because of {{relevance}}.

I am Marc Rene, releasing music as MarcsMusic.
My current tracks sit around reggae, latin, world and adjacent grooves, with a warm independent sound rather than a heavy commercial push.

I put together a playlist with the strongest current fits here:
{{playlistUrl}}

Spotify profile:
{{spotifyProfileUrl}}

SoundCloud downloads:
{{soundcloudDownloadsUrl}}

MP3 files:
{{mp3Note}}

If one of the tracks feels right for a short feature, playlist mention, channel post or newsletter pick, I would be grateful.
If you prefer a tighter pitch, I can send the 2 or 3 tracks that best match your format.

If this is not relevant for your inbox, just let me know and I will leave you out from future mails.

Best,
Marc Rene
MarcsMusic
marc@marcsmusic.nl`
  },
  {
    id: "radio-dj",
    title: "Radio or DJ",
    audience: "Radio hosts, DJs, selectors, mix curators.",
    defaultCampaign: "radio-dj-outreach",
    subject: "MarcsMusic tracks for possible radio or DJ support",
    body: `Hello {{nameOrTeam}},

I came across your work because of {{relevance}}.

I am Marc Rene, releasing music as MarcsMusic.
I make tracks around reggae, latin, world and adjacent grooves, with a focus on feel, rhythm and melodic accessibility.

I thought a few tracks might fit your radio programming, DJ selections or online mixes.

Playlist:
{{playlistUrl}}

Spotify profile:
{{spotifyProfileUrl}}

SoundCloud downloads:
{{soundcloudDownloadsUrl}}

MP3 files:
{{mp3Note}}

If it helps, I can send only the strongest 2 or 3 tracks for your lane instead of the full playlist.
If this is not relevant, no problem. Just let me know and I will leave you out from future mails.

Best,
Marc Rene
MarcsMusic
marc@marcsmusic.nl`
  },
  {
    id: "label-sync",
    title: "Label or sync",
    audience: "Small labels, sync contacts, licensing scouts, catalog partners.",
    defaultCampaign: "label-sync-outreach",
    subject: "MarcsMusic catalog for possible fit",
    body: `Hello {{nameOrTeam}},

I came across your work because of {{relevance}}.

I am Marc Rene, releasing music as MarcsMusic.
I have a small catalog of tracks around reggae, latin, world and adjacent grooves, and I thought there may be a fit for your roster, catalog needs or sync direction.

Playlist:
{{playlistUrl}}

Spotify profile:
{{spotifyProfileUrl}}

SoundCloud downloads:
{{soundcloudDownloadsUrl}}

MP3 files:
{{mp3Note}}

If useful, I can send a shorter selection with notes on mood, tempo and best-use context.
If this is not relevant for your inbox, just let me know and I will leave you out from future mails.

Best,
Marc Rene
MarcsMusic
marc@marcsmusic.nl`
  },
  {
    id: "follow-up",
    title: "Short follow-up",
    audience: "A light second touch after a previous playlist or coverage pitch.",
    defaultCampaign: "outreach-follow-up",
    subject: "Quick follow-up on MarcsMusic",
    body: `Hello {{nameOrTeam}},

Just a quick follow-up on my previous note.

I reached out because of {{relevance}}, and I thought a few MarcsMusic tracks might fit your lane around reggae, latin, world and adjacent grooves.

Playlist:
{{playlistUrl}}

MP3 files:
{{mp3Note}}

If there is no fit, no problem at all.
If you prefer, I can send only the 2 or 3 strongest tracks instead of the full playlist.

Best,
Marc Rene
MarcsMusic
marc@marcsmusic.nl`
  }
];

export function getOutreachTemplate(id: OutreachTemplateId) {
  return outreachTemplates.find((template) => template.id === id) ?? outreachTemplates[0];
}

function templateValue(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized || fallback;
}

export function renderOutreachTemplate(template: OutreachTemplate, values: OutreachTemplateValues = {}) {
  const replacements = {
    nameOrTeam: templateValue(values.nameOrTeam, "there"),
    relevance: templateValue(values.relevance, "your work with independent music"),
    playlistUrl: templateValue(values.playlistUrl, defaultOutreachLinks.playlistUrl),
    spotifyProfileUrl: templateValue(values.spotifyProfileUrl, defaultOutreachLinks.spotifyProfileUrl),
    soundcloudDownloadsUrl: templateValue(values.soundcloudDownloadsUrl, defaultOutreachLinks.soundcloudDownloadsUrl),
    mp3Note: templateValue(values.mp3Note, "I can send direct MP3 files for review, or attach a smaller selection if that is easier for you.")
  };

  const replace = (text: string) =>
    Object.entries(replacements).reduce((rendered, [key, value]) => rendered.replaceAll(`{{${key}}}`, value), text);

  return {
    subject: replace(template.subject),
    text: replace(template.body),
    campaign: template.defaultCampaign
  };
}
