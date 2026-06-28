import { z } from 'zod';

const booleanEnv = z
  .string()
  .optional()
  .transform((value) => value === 'true');

const integerEnv = (defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value.trim() === '') {
        return defaultValue;
      }

      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed) || parsed < 0) {
        return defaultValue;
      }

      return parsed;
    });

const envSchema = z.object({
  DATABASE_PATH: z.string().default('./data/submissions.sqlite'),
  EXPORT_DIR: z.string().default('./data/exports'),
  PORT: integerEnv(3000),
  HOST: z.string().default('0.0.0.0'),
  AUTO_SUBMIT_ENABLED: booleanEnv,
  EMAIL_SMTP_VERIFY_ENABLED: booleanEnv,
  WORKER_MODE: z.string().default('all'),
  ARTIST_NAME: z.string().optional(),
  ARTIST_EMAIL: z.string().optional(),
  TRACK_TITLE: z.string().optional(),
  TRACK_SPOTIFY_URL: z.string().optional(),
  TRACK_SOUNDCLOUD_URL: z.string().optional(),
  TRACK_MP3_URL: z.string().optional(),
  TRACK_WAV_URL: z.string().optional(),
  ARTWORK_URL: z.string().optional(),
  PRESS_PHOTO_URL: z.string().optional(),
  EPK_URL: z.string().optional(),
  ARTIST_BIO: z.string().optional(),
  MAX_BROWSER_CONCURRENCY: integerEnv(1),
  DISCOVERY_INTERVAL: integerEnv(1_800_000),
  VERIFICATION_INTERVAL: integerEnv(3_600_000),
  SUBMISSION_INTERVAL: integerEnv(15_000),
  DISCOVERY_INTERVAL_MS: z.string().optional(),
  VERIFICATION_INTERVAL_MS: z.string().optional(),
  SUBMISSION_IDLE_SLEEP_MS: z.string().optional(),
  AFTERSHIP_EMAIL_VERIFIER_BIN: z.string().default('bin/aftership-email-verifier')
});

export interface RuntimeConfig {
  databasePath: string;
  exportDir: string;
  port: number;
  host: string;
  autoSubmitEnabled: boolean;
  emailSmtpVerifyEnabled: boolean;
  workerMode: string;
  maxBrowserConcurrency: number;
  discoveryIntervalMs: number;
  verificationIntervalMs: number;
  submissionIntervalMs: number;
  afterShipEmailVerifierBin: string;
  requiredAssets: {
    artistName?: string;
    artistEmail?: string;
    trackTitle?: string;
    trackSpotifyUrl?: string;
    trackSoundcloudUrl?: string;
    trackMp3Url?: string;
    trackWavUrl?: string;
    artworkUrl?: string;
    pressPhotoUrl?: string;
    epkUrl?: string;
    artistBio?: string;
  };
}

function optionalInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 0 ? fallback : parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const parsed = envSchema.parse(env);
  const discoveryIntervalMs = optionalInteger(parsed.DISCOVERY_INTERVAL_MS, parsed.DISCOVERY_INTERVAL);
  const verificationIntervalMs = optionalInteger(parsed.VERIFICATION_INTERVAL_MS, parsed.VERIFICATION_INTERVAL);
  const submissionIntervalMs = optionalInteger(parsed.SUBMISSION_IDLE_SLEEP_MS, parsed.SUBMISSION_INTERVAL);

  return {
    databasePath: parsed.DATABASE_PATH,
    exportDir: parsed.EXPORT_DIR,
    port: parsed.PORT,
    host: parsed.HOST,
    autoSubmitEnabled: parsed.AUTO_SUBMIT_ENABLED,
    emailSmtpVerifyEnabled: parsed.EMAIL_SMTP_VERIFY_ENABLED,
    workerMode: parsed.WORKER_MODE,
    maxBrowserConcurrency: Math.max(1, parsed.MAX_BROWSER_CONCURRENCY),
    discoveryIntervalMs,
    verificationIntervalMs,
    submissionIntervalMs,
    afterShipEmailVerifierBin: parsed.AFTERSHIP_EMAIL_VERIFIER_BIN,
    requiredAssets: {
      artistName: parsed.ARTIST_NAME,
      artistEmail: parsed.ARTIST_EMAIL,
      trackTitle: parsed.TRACK_TITLE,
      trackSpotifyUrl: parsed.TRACK_SPOTIFY_URL,
      trackSoundcloudUrl: parsed.TRACK_SOUNDCLOUD_URL,
      trackMp3Url: parsed.TRACK_MP3_URL,
      trackWavUrl: parsed.TRACK_WAV_URL,
      artworkUrl: parsed.ARTWORK_URL,
      pressPhotoUrl: parsed.PRESS_PHOTO_URL,
      epkUrl: parsed.EPK_URL,
      artistBio: parsed.ARTIST_BIO
    }
  };
}

export const config = loadConfig();
