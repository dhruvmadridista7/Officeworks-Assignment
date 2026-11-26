import categoriesFixture from '../../test/fixtures/categories.json';
import productsFixture from '../../test/fixtures/products.json';
import { UpstreamError } from '../domain/errors';
import { FakeStoreProductRepository } from './fake-store-product-repository';
import { describe, expect, it, vi } from 'vitest';

const BASE_URL = 'https://fakestoreapi.com';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeRepository(
  fetchImplementation: typeof fetch,
  overrides: { timeoutMs?: number; retries?: number } = {},
): FakeStoreProductRepository {
  return new FakeStoreProductRepository({
    fakeStoreBaseUrl: BASE_URL,
    upstreamTimeoutMs: overrides.timeoutMs ?? 1000,
    upstreamRetries: overrides.retries ?? 2,
    cacheTtlSeconds: 300,
    fetchImplementation,
    sleep: vi.fn(async () => undefined),
  });
}

function fixtureFetch(): ReturnType<typeof vi.fn<typeof fetch>> {
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url.endsWith('/products/categories')) return jsonResponse(categoriesFixture);
    if (url.endsWith('/products')) return jsonResponse(productsFixture);
    const productId = Number(url.split('/').pop());
    const product = productsFixture.find((candidate) => candidate.id === productId);
    return product ? jsonResponse(product) : new Response('', { status: 200 });
  });
}

describe('FakeStoreProductRepository', () => {
  it('validates and maps products and runtime category slugs', async () => {
    const fetchMock = fixtureFetch();
    const repository = makeRepository(fetchMock);
    const result = await repository.list();

    expect(result).toHaveLength(7);
    expect(result.find((product) => product.id === 2)?.category).toEqual({
      name: "men's clothing",
      slug: 'mens-clothing',
    });
    expect(result.find((product) => product.id === 3)?.category.slug).toBe('jewelery');
  });

  it('times out and raises UpstreamError', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Timed out', 'TimeoutError')),
            { once: true },
          );
        }),
    );
    const repository = makeRepository(fetchMock, { timeoutMs: 5, retries: 0 });

    await expect(repository.getById(1)).rejects.toBeInstanceOf(UpstreamError);
  });

  it('retries a network failure and succeeds on the next attempt', async () => {
    const fetchMock = fixtureFetch();
    fetchMock.mockRejectedValueOnce(new Error('temporary network failure'));
    const repository = makeRepository(fetchMock);

    expect((await repository.getById(1))?.title).toBe('Portable Sound Speaker');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries upstream 5xx responses and then raises UpstreamError', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({}, 503));
    const repository = makeRepository(fetchMock, { retries: 2 });

    await expect(repository.getById(1)).rejects.toBeInstanceOf(UpstreamError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('maps invalid upstream product payloads to UpstreamError', async () => {
    const fetchMock = fixtureFetch();
    fetchMock.mockImplementation(async (input) => {
      if (String(input).endsWith('/products')) return jsonResponse([{ id: 'invalid' }]);
      return jsonResponse(categoriesFixture);
    });
    const repository = makeRepository(fetchMock);

    await expect(repository.list()).rejects.toBeInstanceOf(UpstreamError);
  });

  it('treats an empty response for an unknown product as not found', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response('', { status: 200 }));
    const repository = makeRepository(fetchMock);

    await expect(repository.getById(999)).resolves.toBeNull();
  });

  it('caches product and category responses for the TTL', async () => {
    const fetchMock = fixtureFetch();
    const repository = makeRepository(fetchMock);

    await repository.getById(1);
    await repository.getById(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
