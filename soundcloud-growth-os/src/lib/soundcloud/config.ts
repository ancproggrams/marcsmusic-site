import { z } from "zod";

const envSchema = z.object({
  SOUNDCLOUD_CLIENT_ID: z.string().min(1).max(512),
  SOUNDCLOUD_CLIENT_SECRET: z.union([z.literal(""), z.string().min(1).max(2_048)]).optional(),
  SOUNDCLOUD_REDIRECT_URI: z.string().url().max(2_048),
  NEXT_PUBLIC_APP_URL: z.string().url().max(2_048).default("http://localhost:3000")
});

export class SoundCloudConfigurationError extends Error {
  constructor() {
    super("SoundCloud integration is not configured securely.");
    this.name = "SoundCloudConfigurationError";
  }
}

export type SoundCloudConfigEnv = Record<string, string | undefined>;

export function getSoundCloudConfig(env: SoundCloudConfigEnv = process.env) {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) throw new SoundCloudConfigurationError();

  const appUrl = new URL(parsed.data.NEXT_PUBLIC_APP_URL);
  const redirectUri = new URL(parsed.data.SOUNDCLOUD_REDIRECT_URI);
  if (
    appUrl.username ||
    appUrl.password ||
    appUrl.search ||
    appUrl.hash ||
    (appUrl.pathname !== "/" && appUrl.pathname !== "") ||
    redirectUri.username ||
    redirectUri.password ||
    redirectUri.search ||
    redirectUri.hash ||
    redirectUri.pathname !== "/api/auth/soundcloud/callback" ||
    redirectUri.origin !== appUrl.origin ||
    (env.NODE_ENV === "production" && (appUrl.protocol !== "https:" || redirectUri.protocol !== "https:"))
  ) {
    throw new SoundCloudConfigurationError();
  }

  return {
    clientId: parsed.data.SOUNDCLOUD_CLIENT_ID,
    clientSecret: parsed.data.SOUNDCLOUD_CLIENT_SECRET || undefined,
    redirectUri: redirectUri.toString(),
    appUrl: appUrl.toString(),
    authBaseUrl: "https://secure.soundcloud.com/authorize",
    tokenUrl: "https://secure.soundcloud.com/oauth/token",
    apiBaseUrl: "https://api.soundcloud.com"
  };
}
