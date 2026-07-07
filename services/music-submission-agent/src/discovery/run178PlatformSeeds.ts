import type { PlatformInput } from '../models/types.js';
import { run178BaseSeedPlatforms } from './run178BasePlatformSeeds.js';
import { run179SeedPlatforms } from './run179PlatformSeeds.js';

export const run178SeedPlatforms: PlatformInput[] = run179SeedPlatforms.concat(run178BaseSeedPlatforms);
