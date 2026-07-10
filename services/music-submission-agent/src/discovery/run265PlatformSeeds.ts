import type { PlatformInput } from '../models/types.js';
import { run265BaseSeedPlatforms } from './run265BasePlatformSeeds.js';
import { run266SeedPlatforms } from './run266PlatformSeeds.js';

export const run265SeedPlatforms: PlatformInput[] = [
  ...run265BaseSeedPlatforms,
  ...run266SeedPlatforms
];
