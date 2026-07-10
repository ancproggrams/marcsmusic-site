import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rm, symlink } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryEscapeLinkPath = resolve(projectRoot, "public", "assets", "outside-source.js");
const assetNamespaceEscapeLinkPath = resolve(projectRoot, "public", "assets", "outside-assets.html");
const blockedPaths = [
  "/.env",
  "/.git/config",
  "/server.js",
  "/public/index.html",
  "/package.json",
  "/railway.json",
  "/data/film-director-leads-2026-07-06.csv",
  "/services/release-os/.env.example",
  "/soundcloud-growth-os/prisma/schema.prisma",
  "/assets/%2e%2e/server.js",
  "/assets/%2e%2e%2fserver.js",
  "/assets/%2e%2e%2findex.html",
  "/assets/%2e%2e%2fadmin.html",
  "/assets/%2e%2e%2fbooking.html",
  "/%E0%A4%A"
];

let application;

before(async () => {
  application = await startApplication();
});

after(async () => {
  await rm(repositoryEscapeLinkPath, { force: true });
  await rm(assetNamespaceEscapeLinkPath, { force: true });
  await stopApplication(application?.process);
});

test("serves the existing public pages and allowlisted assets", async () => {
  const expected = [
    ["/", "text/html"],
    ["/index.html", "text/html"],
    ["/booking", "text/html"],
    ["/booking/", "text/html"],
    ["/booking.html", "text/html"],
    ["/booking/success", "text/html"],
    ["/booking/cancelled", "text/html"],
    ["/admin", "text/html"],
    ["/admin.html", "text/html"],
    ["/assets/marcsmusic-logo-black.png", "image/png"],
    ["/soundcloud-growth-os/outreach-mp3/01%20Door%20de%20Storm/Door%20de%20Storm.mp3", "audio/mpeg"]
  ];

  for (const [path, contentType] of expected) {
    const response = await request(path, { method: "HEAD" });
    assert.equal(response.status, 200, `${path} should remain public`);
    assert.match(response.headers.get("content-type") || "", new RegExp(`^${contentType}`));
  }

  const home = await request("/");
  assert.equal(home.status, 200);
  assert.match(await home.text(), /<title>MarcsMusic/u);

  const booking = await request("/booking/");
  assert.equal(booking.status, 200);
  assert.match(await booking.text(), /src="\/assets\/marcsmusic-logo-white\.png"/u);
});

test("does not expose source, configuration, data, or dotfiles", async () => {
  for (const path of blockedPaths) {
    const response = await request(path, { method: "HEAD" });
    assert.equal(response.status, 404, `${path} must not be public`);
  }
});

test("rejects asset symlinks that leave the approved asset root", async () => {
  await rm(repositoryEscapeLinkPath, { force: true });
  await rm(assetNamespaceEscapeLinkPath, { force: true });
  await symlink(resolve(projectRoot, "server.js"), repositoryEscapeLinkPath);
  await symlink(resolve(projectRoot, "public", "index.html"), assetNamespaceEscapeLinkPath);

  try {
    const repositoryEscape = await request("/assets/outside-source.js", { method: "HEAD" });
    const namespaceEscape = await request("/assets/outside-assets.html", { method: "HEAD" });
    assert.equal(repositoryEscape.status, 404);
    assert.equal(namespaceEscape.status, 404);
  } finally {
    await rm(repositoryEscapeLinkPath, { force: true });
    await rm(assetNamespaceEscapeLinkPath, { force: true });
  }
});

test("keeps download behavior for allowlisted audio", async () => {
  const response = await request(
    "/soundcloud-growth-os/outreach-mp3/06%20Carnival/Carnival.mp3?download=1&filename=Carnival",
    { method: "HEAD" }
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="Carnival.mp3"');
});

function request(path, options) {
  return fetch(`${application.baseUrl}${path}`, options);
}

async function startApplication() {
  const port = await findAvailablePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      APP_BASE_URL: `http://127.0.0.1:${port}`,
      PORT: String(port),
      PRIVACY_HASH_SALT: "static-boundary-test-salt",
      RAILWAY_ENVIRONMENT: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  const ready = new Promise((resolveReady, rejectReady) => {
    const timeout = setTimeout(() => rejectReady(new Error(`Server did not start. ${output}`)), 5_000);
    const capture = (chunk) => {
      output += chunk.toString();
      if (output.includes("MarcsMusic site listening")) {
        clearTimeout(timeout);
        resolveReady();
      }
    };

    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      rejectReady(new Error(`Server exited with code ${code}. ${output}`));
    });
  });

  await ready;
  return { process: child, baseUrl: `http://127.0.0.1:${port}` };
}

async function findAvailablePort() {
  const probe = createServer();
  await new Promise((resolveListen, rejectListen) => {
    probe.once("error", rejectListen);
    probe.listen(0, "127.0.0.1", resolveListen);
  });

  const address = probe.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolveClose, rejectClose) => probe.close((error) => (error ? rejectClose(error) : resolveClose())));
  return port;
}

async function stopApplication(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  await new Promise((resolveExit) => child.once("exit", resolveExit));
}
