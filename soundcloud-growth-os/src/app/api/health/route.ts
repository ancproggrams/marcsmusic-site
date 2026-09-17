import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isSoundCloudServiceReady } from "@/lib/soundcloud/readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ready = await isSoundCloudServiceReady(prisma);
  return NextResponse.json({
    status: ready ? "ready" : "not_ready",
    service: "soundcloud-growth-os"
  }, {
    status: ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" }
  });
}
