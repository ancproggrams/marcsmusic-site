import type { PlatformInput } from '../models/types.js';
import { run237BaseSeedPlatforms } from './run237BasePlatformSeeds.js';
import { run238SeedPlatforms } from './run238PlatformSeeds.js';

export const run237SeedPlatforms: PlatformInput[] = [
  ...run237BaseSeedPlatforms,
  ...run238SeedPlatforms
];
