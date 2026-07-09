import type { PlatformInput } from '../models/types.js';
import { run230BaseSeedPlatforms } from './run230BasePlatformSeeds.js';
import { run231SeedPlatforms } from './run231PlatformSeeds.js';

export const run230SeedPlatforms: PlatformInput[] = [
  ...run230BaseSeedPlatforms,
  ...run231SeedPlatforms
];
