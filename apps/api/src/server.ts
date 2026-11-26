import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { buildApp } from './app';
import { loadConfig } from './config/env';
import { FakeStoreProductRepository } from './adapters/fake-store-product-repository';
import { CatalogService } from './services/catalog-service';
import { consoleLogger } from './http/request-logger';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

const config = loadConfig();
const repository = new FakeStoreProductRepository(config);
const catalogService = new CatalogService(
  repository,
  config.featuredProductIds,
);

buildApp({
  catalogService,
  logger: consoleLogger,
  webOrigin: config.webOrigin,
}).listen(config.port, () => {
  process.stdout.write(`API listening on port ${config.port}\n`);
});
