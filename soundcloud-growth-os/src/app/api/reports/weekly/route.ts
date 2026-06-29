import { prisma } from "@/lib/db/prisma";
import { buildWeeklyGrowthReport } from "@/lib/growth/weeklyReport";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(await buildWeeklyGrowthReport(prisma));
}
