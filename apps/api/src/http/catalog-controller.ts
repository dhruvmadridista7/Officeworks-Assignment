import { z } from 'zod';
import type { RequestHandler } from 'express';
import { asyncHandler } from './async-handler';
import type { CatalogService } from '../services/catalog-service';

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const productIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.number().safe());
const searchQuerySchema = z.string().trim().min(1).max(100);

function parseOrThrow<T>(
  schema: z.ZodType<T>,
  value: unknown,
  field: string,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new z.ZodError(
      result.error.issues.map((issue) => ({
        ...issue,
        path: [field, ...issue.path],
      })),
    );
  }
  return result.data;
}

export function createCatalogController(service: CatalogService) {
  const health: RequestHandler = (_request, response) => {
    response.status(200).json({ status: 'ok' });
  };
  return {
    health,
    featured: asyncHandler(async (_request, response) => {
      response.status(200).json({ products: await service.getFeatured() });
    }),
    categories: asyncHandler(async (_request, response) => {
      response.status(200).json({ categories: await service.listCategories() });
    }),
    category: asyncHandler(async (request, response) => {
      const slug = parseOrThrow(slugSchema, request.params.slug, 'slug');
      response.status(200).json(await service.getCategory(slug));
    }),
    search: asyncHandler(async (request, response) => {
      const query = parseOrThrow(searchQuerySchema, request.query.q, 'q');
      response.status(200).json(await service.search(query));
    }),
    product: asyncHandler(async (request, response) => {
      const id = parseOrThrow(productIdSchema, request.params.id, 'id');
      response.status(200).json({ product: await service.getProduct(id) });
    }),
  };
}
