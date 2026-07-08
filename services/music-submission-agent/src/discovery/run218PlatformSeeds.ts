import type { PlatformInput } from '../models/types.js';
import { run218BaseSeedPlatforms } from './run218BasePlatformSeeds.js';
import { run219SeedPlatforms } from './run219PlatformSeeds.js';

export const run218SeedPlatforms: PlatformInput[] = [
  ...run218BaseSeedPlatforms,
  ...run219SeedPlatforms
];
