import { config } from '../config/runtime.js';
import { seedDiscoveryPlatforms } from '../discovery/seedPlatforms.js';
import { createInitializedDatabase } from './database.js';
import { createRepositories } from './repositories.js';

const database = createInitializedDatabase(config.databasePath);
const repositories = createRepositories(database);
seedDiscoveryPlatforms(repositories);
database.close();
