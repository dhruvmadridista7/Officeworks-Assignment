import { z } from 'zod';
import type { AppConfig } from '../config/env';
import { UpstreamError } from '../domain/errors';
import type { ProductRepository } from '../domain/product-repository';
import type { Category, Product } from '../domain/product';

const upstreamProductSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  price: z.number().nonnegative(),
  description: z.string(),
  image: z.string().url(),
  category: z.string().min(1),
  rating: z.object({
    rate: z.number().min(0).max(5),
    count: z.number().int().nonnegative(),
  }),
});

const upstreamProductsSchema = z.array(upstreamProductSchema);
const upstreamCategoriesSchema = z.array(z.string().min(1));
type UpstreamProduct = z.infer<typeof upstreamProductSchema>;

type CacheEntry = { expiresAt: number; value: unknown | null };
type FetchImplementation = typeof fetch;
type Sleep = (milliseconds: number) => Promise<void>;

type FakeStoreOptions = Pick<
  AppConfig,
  'fakeStoreBaseUrl' | 'upstreamTimeoutMs' | 'upstreamRetries' | 'cacheTtlSeconds'
> & {
  fetchImplementation?: FetchImplementation;
  sleep?: Sleep;
  now?: () => number;
};

function toCategorySlug(name: string): string {
  return name
    .toLocaleLowerCase()
    .replace(/[’']/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export class FakeStoreProductRepository implements ProductRepository {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly baseUrl: string;
  private readonly fetchImplementation: FetchImplementation;
  private readonly sleep: Sleep;
  private readonly now: () => number;

  constructor(private readonly options: FakeStoreOptions) {
    this.baseUrl = options.fakeStoreBaseUrl.replace(/\/+$/, '');
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.sleep =
      options.sleep ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.now = options.now ?? Date.now;
  }

  async list(): Promise<Product[]> {
    const [payload, categories] = await Promise.all([
      this.fetchJson('/products'),
      this.listCategories(),
    ]);
    if (payload === null) {
      throw new UpstreamError('Fake Store returned an empty product list.');
    }

    const parsed = upstreamProductsSchema.safeParse(payload);
    if (!parsed.success) {
      throw new UpstreamError('Fake Store returned invalid product data.', {
        cause: parsed.error,
      });
    }
    this.assertUniqueProductIds(parsed.data);

    return parsed.data.map((product) => this.mapProduct(product, categories));
  }

  async getById(id: number): Promise<Product | null> {
    const payload = await this.fetchJson(`/products/${id}`, true);
    if (payload === null) return null;

    const parsed = upstreamProductSchema.safeParse(payload);
    if (!parsed.success) {
      throw new UpstreamError('Fake Store returned invalid product data.', {
        cause: parsed.error,
      });
    }

    const categories = await this.listCategories();
    return this.mapProduct(parsed.data, categories);
  }

  async listCategories(): Promise<Category[]> {
    const payload = await this.fetchJson('/products/categories');
    const parsed = upstreamCategoriesSchema.safeParse(payload);
    if (!parsed.success) {
      throw new UpstreamError('Fake Store returned invalid category data.', {
        cause: parsed.error,
      });
    }

    const categories = parsed.data.map((name) => ({
      slug: toCategorySlug(name),
      name,
    }));
    const slugs = categories.map((category) => category.slug);
    if (new Set(slugs).size !== slugs.length || slugs.includes('')) {
      throw new UpstreamError('Fake Store returned duplicate or invalid categories.');
    }

    return categories;
  }

  private async fetchJson(path: string, notFoundIsEmpty = false): Promise<unknown | null> {
    const url = `${this.baseUrl}${path}`;
    const cached = this.cache.get(url);
    if (cached && cached.expiresAt > this.now()) return cached.value;

    for (let attempt = 0; attempt <= this.options.upstreamRetries; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchImplementation(url, {
          signal: AbortSignal.timeout(this.options.upstreamTimeoutMs),
        });
      } catch (cause) {
        if (attempt === this.options.upstreamRetries) {
          throw new UpstreamError('Fake Store request failed or timed out.', { cause });
        }
        await this.sleep(100 * 2 ** attempt);
        continue;
      }

      if (response.status === 404 && notFoundIsEmpty) {
        this.cacheValue(url, null);
        return null;
      }

      if (!response.ok) {
        const error = new UpstreamError(
          `Fake Store returned HTTP ${response.status}.`,
          { retryable: response.status >= 500 },
        );
        if (!error.retryable || attempt === this.options.upstreamRetries) throw error;
        await this.sleep(100 * 2 ** attempt);
        continue;
      }

      let body: string;
      try {
        body = await response.text();
      } catch (cause) {
        if (attempt === this.options.upstreamRetries) {
          throw new UpstreamError('Fake Store response could not be read.', { cause });
        }
        await this.sleep(100 * 2 ** attempt);
        continue;
      }

      if (!body.trim()) {
        this.cacheValue(url, null);
        return null;
      }

      let value: unknown;
      try {
        value = JSON.parse(body) as unknown;
      } catch (cause) {
        throw new UpstreamError('Fake Store returned invalid JSON.', { cause });
      }

      this.cacheValue(url, value);
      return value;
    }

    throw new UpstreamError('Fake Store request failed.');
  }

  private cacheValue(url: string, value: unknown | null): void {
    this.cache.set(url, {
      value,
      expiresAt: this.now() + this.options.cacheTtlSeconds * 1000,
    });
  }

  private assertUniqueProductIds(products: UpstreamProduct[]): void {
    const ids = products.map((product) => product.id);
    if (new Set(ids).size !== ids.length) {
      throw new UpstreamError('Fake Store returned duplicate product IDs.');
    }
  }

  private mapProduct(product: UpstreamProduct, categories: Category[]): Product {
    const category = categories.find((candidate) => candidate.name === product.category);
    if (!category) {
      throw new UpstreamError('Fake Store product referenced an unknown category.');
    }

    return { ...product, category };
  }
}
