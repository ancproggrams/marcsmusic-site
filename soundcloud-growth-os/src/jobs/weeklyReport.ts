import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "../lib/db/prisma";
import { buildWeeklyGrowthReport, formatWeeklyGrowthReport } from "../lib/growth/weeklyReport";

async function main() {
  const report = await buildWeeklyGrowthReport(prisma);
  const markdown = formatWeeklyGrowthReport(report);
  const reportsDir = join(process.cwd(), "reports");
  const reportPath = join(reportsDir, `weekly-${report.period.until.slice(0, 10)}.md`);

  await mkdir(reportsDir, { recursive: true });
  await writeFile(reportPath, markdown, "utf8");

  console.log(markdown);
  console.log(`Saved report: ${reportPath}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
