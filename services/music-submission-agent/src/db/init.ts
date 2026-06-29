import { config } from '../config/runtime.js';
import { createInitializedDatabase } from './database.js';

const database = createInitializedDatabase(config.databasePath);
database.close();
