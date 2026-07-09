import type { PlatformInput } from '../models/types.js';
import { run234BaseSeedPlatforms } from './run234BasePlatformSeeds.js';
import { run235SeedPlatforms } from './run235PlatformSeeds.js';

export const run234SeedPlatforms: PlatformInput[] = [
  ...run234BaseSeedPlatforms,
  ...run235SeedPlatforms
];
