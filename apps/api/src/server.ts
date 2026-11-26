import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { buildApp } from './app';
import { loadConfig } from './config/env';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

const config = loadConfig();

buildApp().listen(config.port, () => {
  process.stdout.write(`API listening on port ${config.port}\n`);
});
