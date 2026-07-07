import type { PlatformInput } from '../models/types.js';
import { run177BaseSeedPlatforms } from './run177BasePlatformSeeds.js';
import { run178SeedPlatforms } from './run178PlatformSeeds.js';

export const run177SeedPlatforms: PlatformInput[] = run178SeedPlatforms.concat(run177BaseSeedPlatforms);
