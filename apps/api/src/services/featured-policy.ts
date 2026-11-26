import type { Product } from '../domain/product';

type WarningLogger = (message: string) => void;

function compareRating(left: Product, right: Product): number {
  return (
    right.rating.rate - left.rating.rate ||
    right.rating.count - left.rating.count ||
    left.id - right.id
  );
}

function parseProductIds(rawIds: string | undefined): number[] | null {
  if (!rawIds) return null;

  const values = rawIds.split(',').map((value) => value.trim());
  if (values.length !== 5 || values.some((value) => !/^[1-9]\d*$/.test(value))) {
    return null;
  }

  const ids = values.map(Number);
  if (ids.some((id) => !Number.isSafeInteger(id)) || new Set(ids).size !== 5) {
    return null;
  }

  return ids;
}

export class FeaturedPolicy {
  private hasWarned = false;

  constructor(
    private readonly warn: WarningLogger = (message) => console.warn(message),
  ) {}

  select(products: Product[], configuredIds?: string): Product[] {
    const ids = parseProductIds(configuredIds);
    if (ids) {
      const productsById = new Map(products.map((product) => [product.id, product]));
      const selected = ids.map((id) => productsById.get(id));
      if (selected.every((product): product is Product => product !== undefined)) {
        return selected;
      }
    }

    if (!this.hasWarned) {
      this.warn(
        'FEATURED_PRODUCT_IDS is missing or invalid; using the five highest-rated products.',
      );
      this.hasWarned = true;
    }

    return [...products].sort(compareRating).slice(0, 5);
  }
}
