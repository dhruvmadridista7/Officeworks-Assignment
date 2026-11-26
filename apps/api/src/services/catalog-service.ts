import {
  CategoryNotFoundError,
  ProductNotFoundError,
  ValidationError,
} from '../domain/errors';
import type { ProductRepository } from '../domain/product-repository';
import type { Category, Product } from '../domain/product';
import { FeaturedPolicy } from './featured-policy';

const MAX_SEARCH_LENGTH = 100;
const TOP_RATED_COUNT = 3;

function compareRating(left: Product, right: Product): number {
  return (
    right.rating.rate - left.rating.rate ||
    right.rating.count - left.rating.count ||
    left.id - right.id
  );
}

export class CatalogService {
  constructor(
    private readonly repository: ProductRepository,
    private readonly featuredProductIds?: string,
    private readonly featuredPolicy: FeaturedPolicy = new FeaturedPolicy(),
  ) {}

  async getFeatured(): Promise<Product[]> {
    const products = await this.repository.list();
    return this.featuredPolicy.select(products, this.featuredProductIds);
  }

  listCategories(): Promise<Category[]> {
    return this.repository.listCategories();
  }

  async getCategory(slug: string): Promise<{
    category: Category;
    topRated: Product[];
    others: Product[];
  }> {
    const categories = await this.repository.listCategories();
    const category = categories.find((candidate) => candidate.slug === slug);
    if (!category) throw new CategoryNotFoundError(slug);

    const products = (await this.repository.list()).filter(
      (product) => product.category.slug === slug,
    );
    const ranked = [...products].sort(compareRating);
    const topRated = ranked.slice(0, TOP_RATED_COUNT);
    const topRatedIds = new Set(topRated.map((product) => product.id));
    const others = products
      .filter((product) => !topRatedIds.has(product.id))
      .sort((left, right) => left.id - right.id);

    return { category, topRated, others };
  }

  async search(query: string): Promise<{ query: string; products: Product[] }> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      throw new ValidationError('Search query cannot be empty.');
    }
    if (normalizedQuery.length > MAX_SEARCH_LENGTH) {
      throw new ValidationError(
        `Search query must be ${MAX_SEARCH_LENGTH} characters or fewer.`,
      );
    }

    const needle = normalizedQuery.toLocaleLowerCase();
    const products = (await this.repository.list()).filter((product) =>
      [product.title, product.description, product.category.name].some((value) =>
        value.toLocaleLowerCase().includes(needle),
      ),
    );

    return { query: normalizedQuery, products };
  }

  async getProduct(id: number): Promise<Product> {
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new ValidationError('Product ID must be a positive integer.');
    }

    const product = await this.repository.getById(id);
    if (!product) throw new ProductNotFoundError(id);
    return product;
  }
}
