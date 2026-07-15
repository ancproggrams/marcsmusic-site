import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { SoundCloudConnectionRequiredError, syncTracksForLatestToken } from "@/lib/growth/soundcloudSync";
import { requireAdminApiAuth } from "@/lib/security/adminAuth";
import { TokenDecryptionError, TokenEncryptionConfigurationError } from "@/lib/security/tokenEncryption";
import { SoundCloudConfigurationError } from "@/lib/soundcloud/config";
import { SoundCloudRefreshBusyError } from "@/lib/soundcloud/refreshLease";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const authenticationFailure = requireAdminApiAuth(request);
  if (authenticationFailure) return authenticationFailure;

  try {
    return NextResponse.json(await syncTracksForLatestToken(prisma));
  } catch (error) {
    if (error instanceof SoundCloudConnectionRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof SoundCloudRefreshBusyError) {
      return NextResponse.json(
        { error: "SoundCloud credential refresh is busy. Retry shortly." },
        { status: 503, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    if (
      error instanceof TokenEncryptionConfigurationError ||
      error instanceof TokenDecryptionError ||
      error instanceof SoundCloudConfigurationError
    ) {
      return NextResponse.json({ error: "Secure credential storage is unavailable." }, { status: 503 });
    }

    throw error;
  }
}
