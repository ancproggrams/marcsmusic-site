import type { PlatformInput } from '../models/types.js';
import { run250BaseSeedPlatforms } from './run250BasePlatformSeeds.js';
import { run251SeedPlatforms } from './run251PlatformSeeds.js';

export const run250SeedPlatforms: PlatformInput[] = [
  ...run250BaseSeedPlatforms,
  ...run251SeedPlatforms
];