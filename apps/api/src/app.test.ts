import request from 'supertest';
import categoriesFixture from '../test/fixtures/categories.json';
import productsFixture from '../test/fixtures/products.json';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from './app';
import { UpstreamError } from './domain/errors';
import type { EmailSender } from './domain/email-sender';
import type { ProductRepository } from './domain/product-repository';
import type { Category, Product } from './domain/product';
import { consoleLogger, type RequestLogger } from './http/request-logger';
import { CatalogService } from './services/catalog-service';
import { EnquiryService } from './services/enquiry-service';

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
  options: {
    repository?: ProductRepository;
    logger?: RequestLogger;
    emailSender?: EmailSender;
    rateLimit?: number;
  } = {},
) {
  const repository = options.repository ?? {
    list: vi.fn(async () => products),
    getById: vi.fn(
      async (id: number) =>
        products.find((product) => product.id === id) ?? null,
    ),
    listCategories: vi.fn(async () => categories),
  };
  const logger = options.logger ?? consoleLogger;
  const emailSender = options.emailSender ?? {
    send: vi.fn(async () => undefined),
  };
  return buildApp({
    catalogService: new CatalogService(repository, '5,2,4,1,3'),
    enquiryService: new EnquiryService(
      repository,
      emailSender,
      'sales@example.com',
      'catalogue@example.com',
      logger,
    ),
    enquiryRateLimit: { limit: options.rateLimit ?? 5, windowMs: 60_000 },
    logger,
    webOrigin: 'http://localhost:5173',
  });
}

function expectJson(response: request.Response, status: number): void {
  expect(response.status).toBe(status);
  expect(response.headers['content-type']).toMatch(/application\/json/);
}

function expectErrorEnvelope(
  response: request.Response,
  status: number,
  code: string,
): void {
  expectJson(response, status);
  expect(Object.keys(response.body)).toEqual(['error']);
  expect(response.body.error).toEqual(
    expect.objectContaining({ code, message: expect.any(String) }),
  );
  if (response.body.error.details !== undefined) {
    expect(Array.isArray(response.body.error.details)).toBe(true);
    for (const detail of response.body.error.details) {
      expect(detail).toEqual({
        field: expect.any(String),
        message: expect.any(String),
      });
    }
  }
  expect(JSON.stringify(response.body)).not.toMatch(/\bat\s+\S+\(.*:\d+:\d+\)/);
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

  it('accepts a valid enquiry, sends email once, and returns the exact 201 body', async () => {
    const emailSender: EmailSender = { send: vi.fn(async () => undefined) };
    const response = await request(makeApp({ emailSender }))
      .post('/api/enquiries')
      .send({
        productId: 1,
        name: ' Jane Doe ',
        email: 'jane@example.com',
        phone: '+91 98765 43210',
        message: 'Please contact me.',
        website: '',
      });

    expectJson(response, 201);
    expect(response.body).toEqual({ status: 'received' });
    expect(emailSender.send).toHaveBeenCalledOnce();
    expect(emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'sales@example.com',
        from: 'catalogue@example.com',
        replyTo: 'jane@example.com',
        subject: `New enquiry: ${products[0].title} (#1)`,
      }),
    );
  });

  it('returns validation details for invalid enquiry fields', async () => {
    const response = await request(makeApp())
      .post('/api/enquiries')
      .send({
        productId: 0,
        name: '   ',
        email: 'not-an-email',
        phone: '123456x',
        message: 'x'.repeat(1001),
      });

    expectJson(response, 400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(
      response.body.error.details.map(
        (detail: { field: string }) => detail.field,
      ),
    ).toEqual(['productId', 'name', 'email', 'phone', 'message']);
  });

  it('rejects JSON bodies larger than the 10 KB request limit', async () => {
    const response = await request(makeApp())
      .post('/api/enquiries')
      .send({
        productId: 1,
        name: 'Jane Doe',
        email: 'jane@example.com',
        message: 'x'.repeat(11_000),
      });

    expectJson(response, 400);
    expect(response.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request body.' },
    });
  });

  it('responds 201 for a filled honeypot without sending email', async () => {
    const emailSender: EmailSender = { send: vi.fn(async () => undefined) };
    const logger: RequestLogger = { info: vi.fn(), error: vi.fn() };
    const response = await request(makeApp({ emailSender, logger }))
      .post('/api/enquiries')
      .send({ website: 'filled-by-bot' });

    expectJson(response, 201);
    expect(response.body).toEqual({ status: 'received' });
    expect(emailSender.send).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      { honeypotTriggered: true },
      'Enquiry honeypot triggered',
    );
  });

  it('returns 404 for an unknown enquiry product and 502 for email delivery failure', async () => {
    const missingRepository: ProductRepository = {
      list: vi.fn(async () => products),
      listCategories: vi.fn(async () => categories),
      getById: vi.fn(async () => null),
    };
    const missing = await request(makeApp({ repository: missingRepository }))
      .post('/api/enquiries')
      .send({ productId: 999, name: 'Jane', email: 'jane@example.com' });
    expectJson(missing, 404);
    expect(missing.body).toEqual({
      error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' },
    });

    const failingSender: EmailSender = {
      send: vi.fn(async () => {
        throw new Error('private SMTP detail');
      }),
    };
    const failed = await request(makeApp({ emailSender: failingSender }))
      .post('/api/enquiries')
      .send({ productId: 1, name: 'Jane', email: 'jane@example.com' });
    expectJson(failed, 502);
    expect(failed.body).toEqual({
      error: {
        code: 'EMAIL_DELIVERY_FAILED',
        message: 'Your enquiry could not be sent. Please try again later.',
      },
    });
    expect(JSON.stringify(failed.body)).not.toContain('private SMTP detail');
  });

  it('rate limits only the enquiry route and returns the shared 429 error', async () => {
    const app = makeApp({ rateLimit: 1 });
    const body = { productId: 1, name: 'Jane', email: 'jane@example.com' };
    const first = await request(app).post('/api/enquiries').send(body);
    expectJson(first, 201);

    const second = await request(app).post('/api/enquiries').send(body);
    expectJson(second, 429);
    expect(second.body).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many enquiries. Please try again later.',
      },
    });

    const health = await request(app).get('/api/health');
    expectJson(health, 200);
    expect(health.body).toEqual({ status: 'ok' });
  });

  it('keeps one JSON error envelope across validation, not-found, rate-limit, email, and internal errors', async () => {
    const validation = await request(makeApp()).get('/api/products');
    expectErrorEnvelope(validation, 400, 'VALIDATION_ERROR');

    const notFound = await request(makeApp()).get('/api/products/999');
    expectErrorEnvelope(notFound, 404, 'PRODUCT_NOT_FOUND');

    const rateLimitedApp = makeApp({ rateLimit: 1 });
    const validEnquiry = {
      productId: 1,
      name: 'Jane',
      email: 'jane@example.com',
    };
    await request(rateLimitedApp).post('/api/enquiries').send(validEnquiry);
    const rateLimited = await request(rateLimitedApp)
      .post('/api/enquiries')
      .send(validEnquiry);
    expectErrorEnvelope(rateLimited, 429, 'RATE_LIMITED');

    const failingSender: EmailSender = {
      send: vi.fn(async () => {
        throw new Error('SMTP secret details');
      }),
    };
    const deliveryFailure = await request(
      makeApp({ emailSender: failingSender }),
    )
      .post('/api/enquiries')
      .send(validEnquiry);
    expectErrorEnvelope(deliveryFailure, 502, 'EMAIL_DELIVERY_FAILED');

    const failingRepository: ProductRepository = {
      list: vi.fn(async () => {
        throw new Error('internal secret details');
      }),
      getById: vi.fn(async () => null),
      listCategories: vi.fn(async () => categories),
    };
    const internalFailure = await request(
      makeApp({
        repository: failingRepository,
        logger: { info: vi.fn(), error: vi.fn() },
      }),
    ).get('/api/products/featured');
    expectErrorEnvelope(internalFailure, 500, 'INTERNAL_ERROR');
    expect(JSON.stringify(internalFailure.body)).not.toContain(
      'internal secret details',
    );
  });
});
