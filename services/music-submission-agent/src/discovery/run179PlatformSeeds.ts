import type { PlatformInput } from '../models/types.js';
import { run179BaseSeedPlatforms } from './run179BasePlatformSeeds.js';
import { run180SeedPlatforms } from './run180PlatformSeeds.js';

export const run179SeedPlatforms: PlatformInput[] = run180SeedPlatforms.concat(run179BaseSeedPlatforms);
