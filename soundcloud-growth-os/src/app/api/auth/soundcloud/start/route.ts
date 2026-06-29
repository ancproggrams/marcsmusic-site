import { createAuthorizationUrl } from "@/lib/soundcloud/oauth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  let oauthStart;
  try {
    oauthStart = createAuthorizationUrl();
  } catch (error) {
    return NextResponse.json(
      {
        error: "SoundCloud OAuth is not configured.",
        detail: error instanceof Error ? error.message : "Set SoundCloud OAuth variables in Railway."
      },
      { status: 503 }
    );
  }

  const { authorizationUrl, codeVerifier, state } = oauthStart;
  const cookieStore = await cookies();

  cookieStore.set("sc_pkce_verifier", codeVerifier, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60
  });
  cookieStore.set("sc_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60
  });

  return NextResponse.redirect(authorizationUrl);
}
