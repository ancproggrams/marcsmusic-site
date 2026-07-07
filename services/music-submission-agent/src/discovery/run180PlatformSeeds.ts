import type { PlatformInput } from '../models/types.js';
import { run180BaseSeedPlatforms } from './run180BasePlatformSeeds.js';
import { run181SeedPlatforms } from './run181PlatformSeeds.js';

export const run180SeedPlatforms: PlatformInput[] = run181SeedPlatforms.concat(run180BaseSeedPlatforms);
