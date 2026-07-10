import type { PlatformInput } from '../models/types.js';
import { run248BaseSeedPlatforms } from './run248BasePlatformSeeds.js';
import { run249SeedPlatforms } from './run249PlatformSeeds.js';

export const run248SeedPlatforms: PlatformInput[] = [
  ...run248BaseSeedPlatforms,
  ...run249SeedPlatforms
];