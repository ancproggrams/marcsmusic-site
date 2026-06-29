import { prisma } from "@/lib/db/prisma";
import { getSoundCloudConfig } from "@/lib/soundcloud/config";
import { exchangeCodeForToken } from "@/lib/soundcloud/oauth";
import { SoundCloudClient } from "@/lib/soundcloud/client";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("sc_oauth_state")?.value;
  const codeVerifier = cookieStore.get("sc_pkce_verifier")?.value;

  if (!code || !state || !expectedState || !codeVerifier || state !== expectedState) {
    return NextResponse.json({ error: "Invalid OAuth callback state." }, { status: 400 });
  }

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

  await prisma.soundCloudToken.upsert({
    where: { artistId: artist.id },
    update: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? "",
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      scope: token.scope
    },
    create: {
      artistId: artist.id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? "",
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      scope: token.scope
    }
  });

  cookieStore.delete("sc_pkce_verifier");
  cookieStore.delete("sc_oauth_state");

  return NextResponse.redirect(new URL("/dashboard", getSoundCloudConfig().appUrl));
}
