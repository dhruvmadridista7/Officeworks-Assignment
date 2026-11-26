import categoriesFixture from '../../test/fixtures/categories.json';
import productsFixture from '../../test/fixtures/products.json';
import {
  CategoryNotFoundError,
  ProductNotFoundError,
  ValidationError,
} from '../domain/errors';
import type { ProductRepository } from '../domain/product-repository';
import type { Category, Product } from '../domain/product';
import { CatalogService } from './catalog-service';
import { FeaturedPolicy } from './featured-policy';
import { describe, expect, it, vi } from 'vitest';

const categories: Category[] = categoriesFixture.map((name) => ({
  name,
  slug: name.toLowerCase().replace(/[’']/g, '').replace(/\s+/g, '-'),
}));

const categoryByName = new Map(categories.map((category) => [category.name, category]));
const products: Product[] = productsFixture.map((product) => {
  const category = categoryByName.get(product.category);
  if (!category) throw new Error(`Missing fixture category: ${product.category}`);
  return { ...product, category };
});

function makeRepository(productList = products): ProductRepository {
  return {
    list: vi.fn(async () => productList),
    getById: vi.fn(async (id) => productList.find((product) => product.id === id) ?? null),
    listCategories: vi.fn(async () => categories),
  };
}

describe('CatalogService', () => {
  it('returns configured featured products in configured order', async () => {
    const service = new CatalogService(makeRepository(), '5,2,4,1,3');

    expect((await service.getFeatured()).map((product) => product.id)).toEqual([
      5, 2, 4, 1, 3,
    ]);
  });

  it('falls back for malformed or duplicate IDs and warns', async () => {
    const warn = vi.fn();
    const service = new CatalogService(
      makeRepository(),
      '1,1,2,3,4',
      new FeaturedPolicy(warn),
    );

    expect((await service.getFeatured()).map((product) => product.id)).toEqual([
      5, 4, 6, 1, 3,
    ]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('falls back when a configured product ID is absent', async () => {
    const service = new CatalogService(makeRepository(), '1,2,3,4,99');

    expect((await service.getFeatured()).map((product) => product.id)).toEqual([
      5, 4, 6, 1, 3,
    ]);
  });

  it('orders category top-rated products by rating and puts the rest in others', async () => {
    const service = new CatalogService(makeRepository());
    const result = await service.getCategory('mens-clothing');

    expect(result.topRated.map((product) => product.id)).toEqual([4, 6, 2]);
    expect(result.others.map((product) => product.id)).toEqual([7]);
    expect(
      result.topRated.every(
        (product) => !result.others.some((other) => other.id === product.id),
      ),
    ).toBe(true);
  });

  it('searches title, description, and category without changing source order', async () => {
    const service = new CatalogService(makeRepository());

    expect((await service.search('COTTON')).products.map((product) => product.id)).toEqual([
      2, 6,
    ]);
    expect(
      (await service.search('comfortable fit')).products.map((product) => product.id),
    ).toEqual([4]);
    expect(
      (await service.search("MEN'S CLOTHING")).products.map((product) => product.id),
    ).toEqual([2, 4, 6, 7]);
    expect((await service.search('no matching item')).products).toEqual([]);
  });

  it('trims valid search phrases and rejects empty or overlong phrases', async () => {
    const service = new CatalogService(makeRepository());

    expect((await service.search('  cotton  ')).query).toBe('cotton');
    await expect(service.search('   ')).rejects.toBeInstanceOf(ValidationError);
    await expect(service.search('x'.repeat(101))).rejects.toBeInstanceOf(ValidationError);
  });

  it('returns categories and a known product', async () => {
    const service = new CatalogService(makeRepository());

    expect(await service.listCategories()).toEqual(categories);
    expect((await service.getProduct(4)).title).toBe('Classic Denim Jacket');
  });

  it('raises typed errors for unknown categories, products, and invalid IDs', async () => {
    const service = new CatalogService(makeRepository());

    await expect(service.getCategory('not-a-category')).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
    await expect(service.getProduct(99)).rejects.toBeInstanceOf(ProductNotFoundError);
    await expect(service.getProduct(0)).rejects.toBeInstanceOf(ValidationError);
  });
});
