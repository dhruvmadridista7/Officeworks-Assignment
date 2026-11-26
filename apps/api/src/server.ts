import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { buildApp } from './app';
import { loadConfig } from './config/env';
import { FakeStoreProductRepository } from './adapters/fake-store-product-repository';
import { CatalogService } from './services/catalog-service';
import { consoleLogger } from './http/request-logger';
import { SmtpEmailSender } from './adapters/smtp-email-sender';
import { ConsoleEmailSender } from './adapters/console-email-sender';
import { EnquiryService } from './services/enquiry-service';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

const config = loadConfig();
const repository = new FakeStoreProductRepository(config);
const catalogService = new CatalogService(
  repository,
  config.featuredProductIds,
);
const emailSender = config.smtpHost
  ? new SmtpEmailSender({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      user: config.smtpUser,
      pass: config.smtpPass,
    })
  : new ConsoleEmailSender();
const enquiryService = new EnquiryService(
  repository,
  emailSender,
  config.salesInbox,
  config.emailFrom,
  consoleLogger,
);

buildApp({
  catalogService,
  enquiryService,
  enquiryRateLimit: {
    limit: config.enquiryRateLimitMax,
    windowMs: config.enquiryRateLimitWindowMs,
  },
  logger: consoleLogger,
  webOrigin: config.webOrigin,
}).listen(config.port, () => {
  process.stdout.write(`API listening on port ${config.port}\n`);
});
