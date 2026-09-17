const SOUNDCLOUD_RESERVED_ROUTES = new Set([
  "charts", "discover", "jobs", "messages", "mobile", "notifications", "pages", "search",
  "settings", "stations", "stream", "terms-of-use", "upload", "you"
]);

export function normalizeLinkedInAccount(value) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./u, "");
    const segments = url.pathname.split("/").filter(Boolean);
    if (
      url.protocol !== "https:" || url.username || url.password || url.port ||
      host !== "linkedin.com" || segments.length !== 2 || segments[0].toLowerCase() !== "in"
    ) return undefined;
    const handle = decodeURIComponent(segments[1]).normalize("NFKC").toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$/u.test(handle)) return undefined;
    return handle;
  } catch {
    return undefined;
  }
}

export function canonicalLinkedInUrl(value) {
  const handle = normalizeLinkedInAccount(value);
  return handle ? `https://www.linkedin.com/in/${handle}/` : undefined;
}

export function normalizeSoundCloudAccount(value) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./u, "");
    const segments = url.pathname.split("/").filter(Boolean);
    if (
      url.protocol !== "https:" || url.username || url.password || url.port ||
      host !== "soundcloud.com" || segments.length !== 1
    ) return undefined;
    const handle = decodeURIComponent(segments[0]).normalize("NFKC").toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,98}[a-z0-9]$/u.test(handle) && !/^[a-z0-9]$/u.test(handle)) return undefined;
    if (SOUNDCLOUD_RESERVED_ROUTES.has(handle)) return undefined;
    return handle;
  } catch {
    return undefined;
  }
}

export function canonicalSoundCloudUrl(value) {
  const handle = normalizeSoundCloudAccount(value);
  return handle ? `https://soundcloud.com/${handle}` : undefined;
}
