import type { PlatformInput } from '../models/types.js';
import { run223BaseSeedPlatforms } from './run223BasePlatformSeeds.js';
import { run224SeedPlatforms } from './run224PlatformSeeds.js';

export const run223SeedPlatforms: PlatformInput[] = [
  ...run223BaseSeedPlatforms,
  ...run224SeedPlatforms
];
