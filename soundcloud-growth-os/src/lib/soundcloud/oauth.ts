import { getSoundCloudConfig } from "./config";
import { createCodeChallenge, createCodeVerifier, createState } from "./pkce";
import type { SoundCloudTokenResponse } from "./types";
import { z } from "zod";

const OAUTH_TIMEOUT_MS = 10_000;
const MAX_OAUTH_RESPONSE_BYTES = 16_384;
const tokenResponseSchema = z.object({
  access_token: z.string().min(1).max(8_192),
  refresh_token: z.string().max(8_192).optional(),
  expires_in: z.number().int().min(1).max(31 * 24 * 60 * 60),
  token_type: z.string().min(1).max(64),
  scope: z.string().max(2_048).optional()
});

export class SoundCloudOAuthError extends Error {
  constructor(message = "SoundCloud OAuth request failed.") {
    super(message);
    this.name = "SoundCloudOAuthError";
  }
}

export type OAuthStart = {
  authorizationUrl: string;
  codeVerifier: string;
  state: string;
};

export function createAuthorizationUrl(): OAuthStart {
  const config = getSoundCloudConfig();
  const codeVerifier = createCodeVerifier();
  const state = createState();

  const url = new URL(config.authBaseUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("code_challenge", createCodeChallenge(codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);

  return {
    authorizationUrl: url.toString(),
    codeVerifier,
    state
  };
}

async function readBoundedTokenResponse(response: Response): Promise<SoundCloudTokenResponse> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && (!/^[0-9]+$/u.test(contentLength) || Number(contentLength) > MAX_OAUTH_RESPONSE_BYTES)) {
    throw new SoundCloudOAuthError();
  }

  if (!response.body) throw new SoundCloudOAuthError();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_OAUTH_RESPONSE_BYTES) {
        await reader.cancel();
        throw new SoundCloudOAuthError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  let body: string;
  try {
    body = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
  } catch {
    throw new SoundCloudOAuthError();
  }
  let candidate: unknown;
  try {
    candidate = JSON.parse(body);
  } catch {
    throw new SoundCloudOAuthError();
  }

  const parsed = tokenResponseSchema.safeParse(candidate);
  if (!parsed.success) throw new SoundCloudOAuthError();
  return parsed.data;
}

async function requestToken(body: URLSearchParams) {
  const config = getSoundCloudConfig();
  let response: Response;
  try {
    response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS)
    });
  } catch {
    throw new SoundCloudOAuthError();
  }

  if (!response.ok) {
    await response.body?.cancel();
    throw new SoundCloudOAuthError(`SoundCloud OAuth request failed (${response.status}).`);
  }
  return readBoundedTokenResponse(response);
}

export async function exchangeCodeForToken(code: string, codeVerifier: string) {
  if (!code || code.length > 2_048 || !codeVerifier || codeVerifier.length > 256) {
    throw new SoundCloudOAuthError();
  }

  const config = getSoundCloudConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code,
    code_verifier: codeVerifier
  });

  if (config.clientSecret) {
    body.set("client_secret", config.clientSecret);
  }

  return requestToken(body);
}

export async function refreshAccessToken(refreshToken: string) {
  if (!refreshToken || refreshToken.length > 8_192) throw new SoundCloudOAuthError();

  const config = getSoundCloudConfig();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    refresh_token: refreshToken
  });

  if (config.clientSecret) {
    body.set("client_secret", config.clientSecret);
  }

  return requestToken(body);
}
