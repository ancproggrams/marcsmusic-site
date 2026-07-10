import type { PlatformInput } from '../models/types.js';
import { run264BaseSeedPlatforms } from './run264BasePlatformSeeds.js';
import { run265SeedPlatforms } from './run265PlatformSeeds.js';

export const run264SeedPlatforms: PlatformInput[] = [
  ...run264BaseSeedPlatforms,
  ...run265SeedPlatforms
];
