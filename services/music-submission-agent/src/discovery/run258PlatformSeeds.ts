import type { PlatformInput } from '../models/types.js';
import { run258BaseSeedPlatforms } from './run258BasePlatformSeeds.js';
import { run259SeedPlatforms } from './run259PlatformSeeds.js';

export const run258SeedPlatforms: PlatformInput[] = [
  ...run258BaseSeedPlatforms,
  ...run259SeedPlatforms
];
