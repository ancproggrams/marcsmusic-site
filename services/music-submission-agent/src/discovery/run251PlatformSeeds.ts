import type { PlatformInput } from '../models/types.js';
import { run251BaseSeedPlatforms } from './run251BasePlatformSeeds.js';
import { run252SeedPlatforms } from './run252PlatformSeeds.js';

export const run251SeedPlatforms: PlatformInput[] = [
  ...run251BaseSeedPlatforms,
  ...run252SeedPlatforms
];
