#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  buildFaqMarkup,
  buildHeadMarkup,
  FAQ_REGION,
  HEAD_REGION,
  readRegion,
  replaceRegion
} from "../src/seo/page-markup.mjs";
import { faqEntriesForPage, SITE_PAGES } from "../src/seo/site-seo.mjs";

/**
 * Keeps the generated regions of the public pages in sync with the entity data.
 * `--check` is the default so the test suite and CI fail on drift; `--write` is
 * the deliberate update step after changing titles, descriptions, tracks,
 * services or FAQ answers.
 */
export const PRODUCTION_ORIGIN = "https://www.marcsmusic.nl";

export function generatedRegions(pageId) {
  const regions = [{ region: HEAD_REGION, markup: buildHeadMarkup({ pageId, siteOrigin: PRODUCTION_ORIGIN }) }];
  if (faqEntriesForPage(pageId).length) {
    regions.push({ region: FAQ_REGION, markup: buildFaqMarkup({ pageId }) });
  }
  return regions;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const write = process.argv.includes("--write");
  const drifted = [];

  for (const page of SITE_PAGES) {
    const path = join(process.cwd(), page.file);
    let html = await readFile(path, "utf8");
    let changed = false;

    for (const { region, markup } of generatedRegions(page.id)) {
      if (readRegion(html, region) === markup) continue;
      changed = true;
      html = replaceRegion(html, region, markup);
    }

    if (!changed) continue;

    if (!write) {
      drifted.push(page.file);
      continue;
    }

    await writeFile(path, html, "utf8");
    process.stdout.write(`${page.file}: generated SEO regions updated\n`);
  }

  if (drifted.length) {
    process.stderr.write(
      `Generated SEO regions are out of sync: ${drifted.join(", ")}. Run "npm run seo:sync" and review the diff.\n`
    );
    process.exitCode = 1;
  } else if (!write) {
    process.stdout.write("Generated SEO regions match src/seo/site-seo.mjs.\n");
  }
}
