import type { PlatformInput } from '../models/types.js';
import { run226BaseSeedPlatforms } from './run226BasePlatformSeeds.js';
import { run227SeedPlatforms } from './run227PlatformSeeds.js';

export const run226SeedPlatforms: PlatformInput[] = [
  ...run226BaseSeedPlatforms,
  ...run227SeedPlatforms
];