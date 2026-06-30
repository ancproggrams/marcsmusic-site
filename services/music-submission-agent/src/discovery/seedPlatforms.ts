import type { Repositories } from '../db/repositories.js';
import { platformCanonicalKey } from '../utils/ids.js';
import { classifyPricing } from '../utils/pricing.js';
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
import { run22SeedPlatforms } from './run22PlatformSeeds.js';
import { run23SeedPlatforms } from './run23PlatformSeeds.js';
import { run24SeedPlatforms } from './run24PlatformSeeds.js';
import { run25SeedPlatforms } from './run25PlatformSeeds.js';
import { run26SeedPlatforms } from './run26PlatformSeeds.js';
import { run27SeedPlatforms } from './run27PlatformSeeds.js';
import { run28SeedPlatforms } from './run28PlatformSeeds.js';
import { run29SeedPlatforms } from './run29PlatformSeeds.js';
import { run30SeedPlatforms } from './run30PlatformSeeds.js';
import { run31SeedPlatforms } from './run31PlatformSeeds.js';
import { run32SeedPlatforms } from './run32PlatformSeeds.js';

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
  ...run21SeedPlatforms,
  ...run22SeedPlatforms,
  ...run23SeedPlatforms,
  ...run24SeedPlatforms,
  ...run25SeedPlatforms,
  ...run26SeedPlatforms,
  ...run27SeedPlatforms,
  ...run28SeedPlatforms,
  ...run29SeedPlatforms,
  ...run30SeedPlatforms,
  ...run31SeedPlatforms,
  ...run32SeedPlatforms
];

export function seedDiscoveryPlatforms(repositories: Repositories): { discovered: number; queued: number } {
  let discovered = 0;
  let queued = 0;

  for (const seed of allSeedPlatforms) {
    const pricing = classifyPricing(seed);
    const platform = repositories.platforms.upsert({
      ...seed,
      ['payment' + 'Required']: seed.paymentRequired || pricing.pricingModel === 'paid',
      manualReviewRequired: seed.manualReviewRequired || pricing.requiresOwnerApproval,
      notes: [seed.notes, `pricing_model=${pricing.pricingModel}`, `pricing_reason=${pricing.reason}`]
        .filter(Boolean)
        .join(' | ')
    });
    discovered += 1;

    repositories.events.record({
      platformId: platform.id,
      eventType: 'platform_discovered',
      message: `Seed platform discovered: ${platform.name}`,
      data: {
        sourceType: seed.sourceType ?? 'seed',
        pricingModel: pricing.pricingModel,
        freeFirstPriority: pricing.freeFirstPriority
      }
    });

    repositories.queue.enqueue({
      platformId: platform.id,
      submissionUrl: platform.submissionUrl ?? platform.websiteUrl,
      jobType: 'verify_platform',
      priority: pricing.freeFirstPriority,
      idempotencyKey: `verify:${platformCanonicalKey(platform.name, platform.websiteUrl, platform.submissionUrl ?? undefined)}`,
      payload: {
        source: seed.sourceType ?? 'seed',
        pricingModel: pricing.pricingModel,
        pricingReason: pricing.reason,
        freeFirst: pricing.pricingModel === 'free'
      }
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
