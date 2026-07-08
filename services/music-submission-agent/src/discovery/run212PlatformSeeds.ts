import type { PlatformInput } from '../models/types.js';
import { run213SeedPlatforms } from './run213PlatformSeeds.js';
import { run212BaseSeedPlatforms } from './run212BasePlatformSeeds.js';

export const run212SeedPlatforms: PlatformInput[] = [
  ...run213SeedPlatforms,
  ...run212BaseSeedPlatforms,
];
