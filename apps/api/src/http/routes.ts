import { Router } from 'express';
import type { CatalogService } from '../services/catalog-service';
import { createCatalogController } from './catalog-controller';

export function createApiRouter(service: CatalogService): Router {
  const router = Router();
  const controller = createCatalogController(service);

  router.get('/health', controller.health);
  router.get('/products/featured', controller.featured);
  router.get('/products', controller.search);
  router.get('/products/:id', controller.product);
  router.get('/categories', controller.categories);
  router.get('/categories/:slug', controller.category);

  return router;
}
