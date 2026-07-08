import type { PlatformInput } from '../models/types.js';
import { run208SeedPlatforms } from './run208PlatformSeeds.js';
import { run207BaseSeedPlatforms } from './run207BasePlatformSeeds.js';

export const run207SeedPlatforms: PlatformInput[] = [
  ...run208SeedPlatforms,
  ...run207BaseSeedPlatforms,
];
