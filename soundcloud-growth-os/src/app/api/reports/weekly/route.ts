import { prisma } from "@/lib/db/prisma";
import { buildWeeklyGrowthReport } from "@/lib/growth/weeklyReport";
import { requireAdminApiAuth } from "@/lib/security/adminAuth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const authenticationFailure = requireAdminApiAuth(request);
  if (authenticationFailure) return authenticationFailure;

  return NextResponse.json(await buildWeeklyGrowthReport(prisma));
}
