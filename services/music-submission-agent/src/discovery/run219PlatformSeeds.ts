import type { PlatformInput } from '../models/types.js';
import { run219BaseSeedPlatforms } from './run219BasePlatformSeeds.js';
import { run220SeedPlatforms } from './run220PlatformSeeds.js';

export const run219SeedPlatforms: PlatformInput[] = [
  ...run219BaseSeedPlatforms,
  ...run220SeedPlatforms
];