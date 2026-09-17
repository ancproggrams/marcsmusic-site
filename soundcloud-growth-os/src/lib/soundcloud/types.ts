export type SoundCloudTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

export type SoundCloudCollection<T> = {
  collection: T[];
  next_href?: string | null;
};

export type SoundCloudTrack = {
  id: number;
  urn?: string;
  title: string;
  permalink_url: string;
  genre?: string;
  tag_list?: string;
  duration?: number;
  created_at?: string;
  release_date?: string;
  playback_count?: number;
  favoritings_count?: number;
  comment_count?: number;
  reposts_count?: number;
  download_count?: number;
};

export type SoundCloudComment = {
  id: number;
  urn?: string;
  body: string;
  timestamp?: number;
  created_at?: string;
  user?: {
    id: number;
    urn?: string;
    username: string;
    permalink_url?: string;
  };
};

export type SoundCloudUser = {
  id: number;
  urn?: string;
  username: string;
  permalink_url: string;
  avatar_url?: string;
  followers_count?: number;
};
