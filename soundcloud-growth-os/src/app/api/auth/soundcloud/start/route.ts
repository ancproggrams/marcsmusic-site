import { createAuthorizationUrl } from "@/lib/soundcloud/oauth";
import { requireAdminApiAuth } from "@/lib/security/adminAuth";
import { assertSoundCloudTokenEncryptionConfigured } from "@/lib/security/tokenEncryption";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const authenticationFailure = requireAdminApiAuth(request);
  if (authenticationFailure) return authenticationFailure;

  let oauthStart;
  try {
    assertSoundCloudTokenEncryptionConfigured();
    oauthStart = createAuthorizationUrl();
  } catch {
    return NextResponse.json(
      { error: "SoundCloud OAuth is not configured." },
      { status: 503 }
    );
  }

  const { authorizationUrl, codeVerifier, state } = oauthStart;
  const cookieStore = await cookies();

  // Remove cookies from the historical root path before writing the narrower
  // callback-scoped values, avoiding duplicate-name ambiguity during rollout.
  for (const name of ["sc_pkce_verifier", "sc_oauth_state"]) {
    cookieStore.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0
    });
  }

  cookieStore.set("sc_pkce_verifier", codeVerifier, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/soundcloud",
    maxAge: 10 * 60
  });
  cookieStore.set("sc_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/soundcloud",
    maxAge: 10 * 60
  });

  return NextResponse.redirect(authorizationUrl);
}
