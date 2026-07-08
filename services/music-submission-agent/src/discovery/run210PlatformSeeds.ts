import type { PlatformInput } from '../models/types.js';
import { run211SeedPlatforms } from './run211PlatformSeeds.js';
import { run210BaseSeedPlatforms } from './run210BasePlatformSeeds.js';

export const run210SeedPlatforms: PlatformInput[] = [
  ...run211SeedPlatforms,
  ...run210BaseSeedPlatforms,
];
