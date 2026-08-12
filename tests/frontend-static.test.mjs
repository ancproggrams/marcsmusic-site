import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
const bookingHtml = await readFile(new URL("../booking.html", import.meta.url), "utf8");
const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const bookingSource = await readFile(new URL("../booking.js", import.meta.url), "utf8");
const serverSource = await readFile(new URL("../server.js", import.meta.url), "utf8");

test("the new homepage and booking flow use the shared external design system", () => {
  assert.match(indexHtml, /Dit ben ik, maar dan in muziek\./);
  assert.match(indexHtml, /href="styles\.css"/);
  assert.match(indexHtml, /src="app\.js"/);
  assert.match(bookingHtml, /href="styles\.css"/);
  assert.match(bookingHtml, /src="booking\.js"/);
  assert.match(bookingHtml, /<form class="booking-form" id="booking-form"/);
  assert.equal((bookingHtml.match(/class="form-step"/g) || []).length, 3);
  assert.doesNotMatch(indexHtml + bookingHtml, /<style\b|<script(?![^>]*\bsrc=)/i);
});

test("the production server explicitly serves the new root assets and font MIME type", () => {
  for (const publicFile of ["/styles.css", "/app.js", "/booking.js"]) {
    assert.ok(serverSource.includes(`"${publicFile}"`), publicFile);
  }
  assert.match(serverSource, /"\.ttf": "font\/ttf"/);
});

test("the player serves all eight production MP3 files", async () => {
  const audioPaths = [...appSource.matchAll(/audio: "([^"]+)"/g)].map((match) => match[1]);
  assert.equal(audioPaths.length, 8);
  assert.equal(new Set(audioPaths).size, 8);

  for (const audioPath of audioPaths) {
    assert.match(audioPath, /^\/soundcloud-growth-os\/outreach-mp3\//);
    await access(new URL("../" + decodeURIComponent(audioPath.slice(1)), import.meta.url));
  }
});

test("all active covers, portrait, logo and font exist", async () => {
  const combinedSource = [indexHtml, bookingHtml, appSource].join("\n");
  const assetPaths = new Set(
    [...combinedSource.matchAll(/assets\/[a-z0-9_./-]+\.(?:jpg|png|svg|ttf)/gi)].map((match) => match[0])
  );
  assert.ok(assetPaths.size >= 10);

  for (const assetPath of assetPaths) {
    await access(new URL("../" + assetPath, import.meta.url));
  }
});

test("browser code uses the existing same-origin counter and booking contracts", () => {
  assert.match(appSource, /fetch\("\/api\/tracks\/plays"/);
  assert.match(bookingSource, /fetch\("\/api\/booking\/config"/);
  assert.match(bookingSource, /fetch\(`\/api\/booking\/availability\?/);
  assert.match(bookingSource, /fetch\("\/api\/booking\/create"/);
});
