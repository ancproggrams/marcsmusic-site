import { getSoundCloudConfig } from "./config";
import { createCodeChallenge, createCodeVerifier, createState } from "./pkce";
import type { SoundCloudTokenResponse } from "./types";

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

export async function exchangeCodeForToken(code: string, codeVerifier: string) {
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

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    throw new Error(`SoundCloud token exchange failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as SoundCloudTokenResponse;
}

export async function refreshAccessToken(refreshToken: string) {
  const config = getSoundCloudConfig();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    refresh_token: refreshToken
  });

  if (config.clientSecret) {
    body.set("client_secret", config.clientSecret);
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    throw new Error(`SoundCloud token refresh failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as SoundCloudTokenResponse;
}
