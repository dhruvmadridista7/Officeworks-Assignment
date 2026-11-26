import { Router } from 'express';
import type { CatalogService } from '../services/catalog-service';
import type { EnquiryService } from '../services/enquiry-service';
import { createCatalogController } from './catalog-controller';
import { createEnquiryController } from './enquiry-controller';
import { createEnquiryRateLimiter } from './enquiry-rate-limiter';

export type EnquiryRateLimit = { limit: number; windowMs: number };

export function createApiRouter(
  service: CatalogService,
  enquiryService: EnquiryService,
  enquiryRateLimit: EnquiryRateLimit,
): Router {
  const router = Router();
  const controller = createCatalogController(service);

  router.get('/health', controller.health);
  router.get('/products/featured', controller.featured);
  router.get('/products', controller.search);
  router.get('/products/:id', controller.product);
  router.get('/categories', controller.categories);
  router.get('/categories/:slug', controller.category);
  router.post(
    '/enquiries',
    createEnquiryRateLimiter(enquiryRateLimit.limit, enquiryRateLimit.windowMs),
    createEnquiryController(enquiryService),
  );

  return router;
}
