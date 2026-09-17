import { prisma } from "@/lib/db/prisma";
import { requireAdminApiAuth } from "@/lib/security/adminAuth";
import {
  assertSoundCloudTokenEncryptionConfigured,
  TokenEncryptionConfigurationError
} from "@/lib/security/tokenEncryption";
import { getSoundCloudConfig, SoundCloudConfigurationError } from "@/lib/soundcloud/config";
import { exchangeCodeForToken } from "@/lib/soundcloud/oauth";
import { SoundCloudClient } from "@/lib/soundcloud/client";
import { upsertEncryptedSoundCloudToken } from "@/lib/soundcloud/tokenStore";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";

function safeStateEqual(actual: string, expected: string) {
  const actualDigest = createHash("sha256").update(actual, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

function clearOAuthCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  for (const name of ["sc_pkce_verifier", "sc_oauth_state"]) {
    for (const path of ["/api/auth/soundcloud", "/"]) {
      cookieStore.set(name, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path,
        maxAge: 0
      });
    }
  }
}

export async function GET(request: NextRequest) {
  const authenticationFailure = requireAdminApiAuth(request);
  if (authenticationFailure) return authenticationFailure;

  const url = new URL(request.url);
  const codes = url.searchParams.getAll("code");
  const states = url.searchParams.getAll("state");
  const code = codes.length === 1 ? codes[0] : null;
  const state = states.length === 1 ? states[0] : null;
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("sc_oauth_state")?.value;
  const codeVerifier = cookieStore.get("sc_pkce_verifier")?.value;
  clearOAuthCookies(cookieStore);

  if (
    !code ||
    code.length > 2_048 ||
    !state ||
    state.length > 256 ||
    !expectedState ||
    expectedState.length > 256 ||
    !codeVerifier ||
    codeVerifier.length > 256 ||
    !safeStateEqual(state, expectedState)
  ) {
    return NextResponse.json({ error: "Invalid OAuth callback state." }, { status: 400 });
  }

  try {
    assertSoundCloudTokenEncryptionConfigured();
    const token = await exchangeCodeForToken(code, codeVerifier);
    const client = new SoundCloudClient({ accessToken: token.access_token });
    const me = await client.getMe();
    const artistUrn = me.urn ?? String(me.id);

    const artist = await prisma.artist.upsert({
      where: { soundcloudUrn: artistUrn },
      update: {
        username: me.username,
        permalinkUrl: me.permalink_url,
        avatarUrl: me.avatar_url
      },
      create: {
        soundcloudUrn: artistUrn,
        username: me.username,
        permalinkUrl: me.permalink_url,
        avatarUrl: me.avatar_url
      }
    });

    await upsertEncryptedSoundCloudToken(prisma, artist.id, token);

    return NextResponse.redirect(new URL("/dashboard", getSoundCloudConfig().appUrl));
  } catch (error) {
    const status = error instanceof TokenEncryptionConfigurationError || error instanceof SoundCloudConfigurationError ? 503 : 502;
    return NextResponse.json(
      { error: status === 503 ? "Secure credential storage is unavailable." : "SoundCloud connection failed." },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
