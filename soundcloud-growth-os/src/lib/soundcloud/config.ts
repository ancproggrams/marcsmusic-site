import { z } from "zod";

const envSchema = z.object({
  SOUNDCLOUD_CLIENT_ID: z.string({ required_error: "SOUNDCLOUD_CLIENT_ID is required" }).min(1, "SOUNDCLOUD_CLIENT_ID is required"),
  SOUNDCLOUD_CLIENT_SECRET: z.string().optional(),
  SOUNDCLOUD_REDIRECT_URI: z.string({ required_error: "SOUNDCLOUD_REDIRECT_URI is required" }).url("SOUNDCLOUD_REDIRECT_URI must be a valid URL"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000")
});

export function getSoundCloudConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "));
  }

  return {
    clientId: parsed.data.SOUNDCLOUD_CLIENT_ID,
    clientSecret: parsed.data.SOUNDCLOUD_CLIENT_SECRET,
    redirectUri: parsed.data.SOUNDCLOUD_REDIRECT_URI,
    appUrl: parsed.data.NEXT_PUBLIC_APP_URL,
    authBaseUrl: "https://secure.soundcloud.com/authorize",
    tokenUrl: "https://secure.soundcloud.com/oauth/token",
    apiBaseUrl: "https://api.soundcloud.com"
  };
}
