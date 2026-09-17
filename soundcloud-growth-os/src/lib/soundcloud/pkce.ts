import { createHash, randomBytes } from "node:crypto";

function base64Url(input: Buffer) {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function createCodeVerifier() {
  return base64Url(randomBytes(64));
}

export function createCodeChallenge(verifier: string) {
  return base64Url(createHash("sha256").update(verifier).digest());
}

export function createState() {
  return base64Url(randomBytes(32));
}
