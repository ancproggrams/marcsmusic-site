import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { SoundCloudConnectionRequiredError, syncTracksForLatestToken } from "@/lib/growth/soundcloudSync";

export async function POST() {
  try {
    return NextResponse.json(await syncTracksForLatestToken(prisma));
  } catch (error) {
    if (error instanceof SoundCloudConnectionRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    throw error;
  }
}
