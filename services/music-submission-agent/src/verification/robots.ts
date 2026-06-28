import { HttpClient } from './httpClient.js';

interface RuleSet {
  userAgents: string[];
  disallow: string[];
}

function parseRobots(content: string): RuleSet[] {
  const groups: RuleSet[] = [];
  let current: RuleSet | null = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (!line) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (key === 'user-agent') {
      current = { userAgents: [value.toLowerCase()], disallow: [] };
      groups.push(current);
      continue;
    }

    if (!current) {
      continue;
    }

    if (key === 'disallow') {
      current.disallow.push(value);
    }
  }

  return groups;
}

export async function isRobotsAllowed(
  url: string,
  httpClient = new HttpClient(8_000)
): Promise<{ allowed: boolean; reason?: string }> {
  const target = new URL(url);
  const robotsUrl = `${target.origin}/robots.txt`;

  try {
    const robots = await httpClient.fetchText(robotsUrl);
    if (robots.status === 404 || robots.status === 410) {
      return { allowed: true };
    }

    if (!robots.ok) {
      return { allowed: true };
    }

    const path = `${target.pathname}${target.search}`;
    const groups = parseRobots(robots.text);
    const applicable = groups.filter(
      (group) => group.userAgents.includes('*') || group.userAgents.includes('marcsmusicsubmissionagent')
    );

    for (const group of applicable) {
      for (const disallow of group.disallow) {
        if (disallow === '') {
          continue;
        }

        if (path.startsWith(disallow)) {
          return { allowed: false, reason: `robots.txt disallows ${disallow}` };
        }
      }
    }

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}
