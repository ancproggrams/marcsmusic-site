import { createMusicApiServer } from "../src/interfaces/http/music-api-server.mjs";

const port = parsePort(process.env.MUSIC_API_PORT ?? "8787");
const host = process.env.MUSIC_API_HOST ?? "127.0.0.1";
const server = createMusicApiServer();

server.listen(port, host, () => {
  console.log(`MarcsMusic API listening on http://${host}:${port}`);
});

function parsePort(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    throw new TypeError("MUSIC_API_PORT must be a valid TCP port");
  }

  return parsed;
}

