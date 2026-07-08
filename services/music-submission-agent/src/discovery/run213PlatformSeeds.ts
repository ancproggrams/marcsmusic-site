import type { PlatformInput } from '../models/types.js';
import { run214SeedPlatforms } from './run214PlatformSeeds.js';
import { run213BaseSeedPlatforms } from './run213BasePlatformSeeds.js';

export const run213SeedPlatforms: PlatformInput[] = [
  ...run214SeedPlatforms,
  ...run213BaseSeedPlatforms,
];
