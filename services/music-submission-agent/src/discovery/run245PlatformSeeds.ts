import type { PlatformInput } from '../models/types.js';
import { run245BaseSeedPlatforms } from './run245BasePlatformSeeds.js';
import { run246SeedPlatforms } from './run246PlatformSeeds.js';

export const run245SeedPlatforms: PlatformInput[] = [
  ...run245BaseSeedPlatforms,
  ...run246SeedPlatforms
];
