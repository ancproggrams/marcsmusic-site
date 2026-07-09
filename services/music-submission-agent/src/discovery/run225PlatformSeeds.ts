import type { PlatformInput } from '../models/types.js';
import { run225BaseSeedPlatforms } from './run225BasePlatformSeeds.js';
import { run226SeedPlatforms } from './run226PlatformSeeds.js';

export const run225SeedPlatforms: PlatformInput[] = [
  ...run225BaseSeedPlatforms,
  ...run226SeedPlatforms
];
