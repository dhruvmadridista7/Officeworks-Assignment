import request from 'supertest';
import categoriesFixture from '../test/fixtures/categories.json';
import productsFixture from '../test/fixtures/products.json';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from './app';
import { UpstreamError } from './domain/errors';
import type { ProductRepository } from './domain/product-repository';
import type { Category, Product } from './domain/product';
import { consoleLogger, type RequestLogger } from './http/request-logger';
import { CatalogService } from './services/catalog-service';

const categories: Category[] = categoriesFixture.map((name) => ({
  name,
  slug: name.toLowerCase().replace(/[’']/g, '').replace(/\s+/g, '-'),
}));
const categoryByName = new Map(
  categories.map((category) => [category.name, category]),
);
const products: Product[] = productsFixture.map((product) => {
  const category = categoryByName.get(product.category);
  if (!category)
    throw new Error(`Missing fixture category: ${product.category}`);
  return { ...product, category };
});

function makeApp(
  options: { repository?: ProductRepository; logger?: RequestLogger } = {},
) {
  const repository = options.repository ?? {
    list: vi.fn(async () => products),
    getById: vi.fn(
      async (id: number) =>
        products.find((product) => product.id === id) ?? null,
    ),
    listCategories: vi.fn(async () => categories),
  };
  return buildApp({
    catalogService: new CatalogService(repository, '5,2,4,1,3'),
    logger: options.logger ?? consoleLogger,
    webOrigin: 'http://localhost:5173',
  });
}

function expectJson(response: request.Response, status: number): void {
  expect(response.status).toBe(status);
  expect(response.headers['content-type']).toMatch(/application\/json/);
}

describe('catalogue HTTP API', () => {
  it('returns the health contract without upstream data', async () => {
    const response = await request(makeApp()).get('/api/health');

    expectJson(response, 200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('returns exactly five featured products in configured order with all domain fields', async () => {
    const response = await request(makeApp()).get('/api/products/featured');

    expectJson(response, 200);
    expect(response.body).toEqual({
      products: [5, 2, 4, 1, 3].map((id) => products[id - 1]),
    });
    expect(response.body.products).toHaveLength(5);
  });

  it('returns the categories and category detail contract', async () => {
    const listResponse = await request(makeApp()).get('/api/categories');
    expectJson(listResponse, 200);
    expect(listResponse.body).toEqual({ categories });

    const detailResponse = await request(makeApp()).get(
      '/api/categories/mens-clothing',
    );
    expectJson(detailResponse, 200);
    expect(detailResponse.body).toEqual({
      category: categories.find(
        (category) => category.slug === 'mens-clothing',
      ),
      topRated: [products[3], products[5], products[1]],
      others: [products[6]],
    });
  });

  it('returns trimmed search query and exact matching products', async () => {
    const response = await request(makeApp())
      .get('/api/products')
      .query({ q: '  cotton  ' });

    expectJson(response, 200);
    expect(response.body).toEqual({
      query: 'cotton',
      products: [products[1], products[5]],
    });
  });

  it('returns the complete product object for a valid id', async () => {
    const response = await request(makeApp()).get('/api/products/3');

    expectJson(response, 200);
    expect(response.body).toEqual({ product: products[2] });
  });

  it.each(['abc', '0', '-2', '1.5', '9007199254740992'])(
    'returns the shared validation error for invalid product id %s',
    async (id) => {
      const response = await request(makeApp()).get(`/api/products/${id}`);

      expectJson(response, 400);
      expect(response.body).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          details: [{ field: 'id', message: expect.any(String) }],
        },
      });
    },
  );

  it('returns 400 for empty or overlong search queries', async () => {
    const empty = await request(makeApp())
      .get('/api/products')
      .query({ q: '  ' });
    expectJson(empty, 400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const long = await request(makeApp())
      .get('/api/products')
      .query({ q: 'x'.repeat(101) });
    expectJson(long, 400);
    expect(long.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns consistent not-found errors for unknown product, category, and route', async () => {
    const product = await request(makeApp()).get('/api/products/999');
    expectJson(product, 404);
    expect(product.body).toEqual({
      error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' },
    });

    const category = await request(makeApp()).get(
      '/api/categories/unknown-category',
    );
    expectJson(category, 404);
    expect(category.body).toEqual({
      error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found.' },
    });

    const route = await request(makeApp()).get('/api/not-a-route');
    expectJson(route, 404);
    expect(route.body).toEqual({
      error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found.' },
    });
  });

  it('maps upstream failures to a clean 502 response', async () => {
    const repository: ProductRepository = {
      list: vi.fn(async () => {
        throw new UpstreamError('private upstream detail');
      }),
      getById: vi.fn(async () => null),
      listCategories: vi.fn(async () => categories),
    };
    const response = await request(makeApp({ repository })).get(
      '/api/products/featured',
    );

    expectJson(response, 502);
    expect(response.body).toEqual({
      error: {
        code: 'UPSTREAM_ERROR',
        message: 'The product service is temporarily unavailable.',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain(
      'private upstream detail',
    );
  });

  it('hides unexpected error details and logs a structured request summary', async () => {
    const logger: RequestLogger = { info: vi.fn(), error: vi.fn() };
    const repository: ProductRepository = {
      list: vi.fn(async () => {
        throw new Error('database password detail');
      }),
      getById: vi.fn(async () => null),
      listCategories: vi.fn(async () => categories),
    };
    const response = await request(makeApp({ repository, logger })).get(
      '/api/products/featured',
    );

    expectJson(response, 500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain(
      'database password detail',
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/products/featured',
        status: 500,
      }),
      'HTTP request completed',
    );
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('allows the configured web origin and omits CORS permission for other origins', async () => {
    const allowed = await request(makeApp())
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );

    const rejected = await request(makeApp())
      .get('/api/health')
      .set('Origin', 'https://not-allowed.example');
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });
});
