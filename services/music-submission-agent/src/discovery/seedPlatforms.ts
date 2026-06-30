import type { Repositories } from '../db/repositories.js';
import { platformCanonicalKey } from '../utils/ids.js';
import { seedPlatforms } from './platformSeeds.js';
import { run5SeedPlatforms } from './run5PlatformSeeds.js';
import { run6SeedPlatforms } from './run6PlatformSeeds.js';
import { run7SeedPlatforms } from './run7PlatformSeeds.js';
import { run8SeedPlatforms } from './run8PlatformSeeds.js';
import { run9SeedPlatforms } from './run9PlatformSeeds.js';
import { run10SeedPlatforms } from './run10PlatformSeeds.js';
import { run11SeedPlatforms } from './run11PlatformSeeds.js';
import { run12SeedPlatforms } from './run12PlatformSeeds.js';
import { run13SeedPlatforms } from './run13PlatformSeeds.js';
import { run14SeedPlatforms } from './run14PlatformSeeds.js';
import { run15SeedPlatforms } from './run15PlatformSeeds.js';
import { run16SeedPlatforms } from './run16PlatformSeeds.js';
import { run17SeedPlatforms } from './run17PlatformSeeds.js';
import { run18SeedPlatforms } from './run18PlatformSeeds.js';
import { run19SeedPlatforms } from './run19PlatformSeeds.js';
import { run20SeedPlatforms } from './run20PlatformSeeds.js';
import { run21SeedPlatforms } from './run21PlatformSeeds.js';

const allSeedPlatforms = [
  ...seedPlatforms,
  ...run5SeedPlatforms,
  ...run6SeedPlatforms,
  ...run7SeedPlatforms,
  ...run8SeedPlatforms,
  ...run9SeedPlatforms,
  ...run10SeedPlatforms,
  ...run11SeedPlatforms,
  ...run12SeedPlatforms,
  ...run13SeedPlatforms,
  ...run14SeedPlatforms,
  ...run15SeedPlatforms,
  ...run16SeedPlatforms,
  ...run17SeedPlatforms,
  ...run18SeedPlatforms,
  ...run19SeedPlatforms,
  ...run20SeedPlatforms,
  ...run21SeedPlatforms
];

export function seedDiscoveryPlatforms(repositories: Repositories): { discovered: number; queued: number } {
  let discovered = 0;
  let queued = 0;

  for (const seed of allSeedPlatforms) {
    const platform = repositories.platforms.upsert(seed);
    discovered += 1;

    repositories.events.record({
      platformId: platform.id,
      eventType: 'platform_discovered',
      message: `Seed platform discovered: ${platform.name}`,
      data: { sourceType: seed.sourceType ?? 'seed' }
    });

    repositories.queue.enqueue({
      platformId: platform.id,
      submissionUrl: platform.submissionUrl ?? platform.websiteUrl,
      jobType: 'verify_platform',
      priority: seed.manualReviewRequired ? 40 : 70,
      idempotencyKey: `verify:${platformCanonicalKey(platform.name, platform.websiteUrl, platform.submissionUrl ?? undefined)}`,
      payload: { source: seed.sourceType ?? 'seed' }
    });
    queued += 1;
  }

  return { discovered, queued };
}

export class DiscoveryWorker {
  public constructor(private readonly repositories: Repositories) {}

  public runOnce(): { discovered: number; queued: number } {
    return seedDiscoveryPlatforms(this.repositories);
  }
}
